import { AsyncLocalStorage } from "async_hooks";
import Axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as AxiosLogger from "axios-logger";
import { readFileSync } from "fs";
import { Agent } from "https";
import { homedir } from "os";
import { join } from "path";
import WebSocket from "ws";
import { sleep } from "../utils";
import { KubeConfig } from "./KubeConfig";
import { KubernetesError } from "./KubernetesError";

interface ClusterConnectionOptions {
  paranoid: boolean;
  logRequests: boolean;
  name: string;
}

interface DeleteOptions {
  dryRun?: string[]; // ???
  gracePeriodSeconds?: number;
  orphanDependents?: boolean;
  preconditions?: {
    resourceVersion: string;
    uid: string;
  };
  propagationPolicy?: "Orphan" | "Background" | "Foreground";
}

function rethrowError(e: any): never {
  if (e?.response?.data && typeof e.response.data === "object") {
    const retryAfterRaw = e.response.headers?.["retry-after"];
    e.response.data.code ??= e.response.status;
    throw KubernetesError.fromStatus(e.response.data, retryAfterRaw);
  }
  throw e;
}

export class ClusterConnection {
  static asyncLocalStorage = new AsyncLocalStorage<ClusterConnection>();

  static current() {
    const current = this.asyncLocalStorage.getStore();
    if (!current) {
      throw new Error("Expected to have a ClusterConnection in this context");
    }
    return current;
  }

  private client: AxiosInstance;
  public readonly options: Readonly<ClusterConnectionOptions>;

  constructor(
    options: (
      | {
          baseUrl: string;
          token: string;
          certificate?: Buffer;
        }
      | {
          kubeconfigPath?: string;
          context?: string;
        }
    ) &
      Partial<ClusterConnectionOptions> = {}
  ) {
    if ("baseUrl" in options) {
      this.client = Axios.create({
        baseURL: options.baseUrl,
        headers: {
          Authorization: `Bearer ${options.token}`,
        },
        ...(options.certificate
          ? {
              httpsAgent: new Agent({
                ca: options.certificate,
              }),
            }
          : {}),
      });
    } else {
      const kubeconfig = readFileSync(
        options.kubeconfigPath ??
          process.env.KUBECONFIG ??
          join(homedir(), ".kube", "config"),
        "utf-8"
      );

      const config = new KubeConfig(kubeconfig);
      const context = config.context(options.context);

      this.client = Axios.create({
        baseURL: context.cluster.server.toString(),
        headers: {
          ...(context.user.token
            ? { Authorization: `Bearer ${context.user.token}` }
            : context.user.username && context.user.password
            ? {
                Authorization: `Basic ${Buffer.from(
                  `${context.user.username}:${context.user.password}`
                ).toString("base64")}`,
              }
            : {}),
          ...(context.user.impersonateUser
            ? { "Impersonate-User": context.user.impersonateUser }
            : {}),
          ...(context.user.impersonateGroups
            ? { "Impersonate-Group": context.user.impersonateGroups }
            : {}),
          ...(context.user.impersonateExtra
            ? Object.fromEntries(
                [...context.user.impersonateExtra].map(([key, value]) => [
                  `Impersonate-Extra-${key}`,
                  value,
                ])
              )
            : {}),
        },
        httpsAgent: new Agent({
          ...(context.cluster.certificateAuthorityData
            ? { ca: context.cluster.certificateAuthorityData }
            : {}),
          ...(context.user.clientCertificateData && context.user.clientKeyData
            ? {
                cert: context.user.clientCertificateData,
                key: context.user.clientKeyData,
              }
            : {}),
        }),
      });
    }

    this.options = {
      paranoid: options.paranoid ?? true,
      logRequests: options.logRequests ?? false,
      name: options.name ?? "kubeoperator",
    };

    if (this.options.logRequests) {
      this.client.interceptors.request.use(AxiosLogger.requestLogger);
    }
  }

  use<T>(func: () => T) {
    return ClusterConnection.asyncLocalStorage.run(this, func);
  }

  private getOpenApi = () => {
    const result = this.client.get("/openapi/v2").then((res) => res.data);
    const previous = this.getOpenApi;
    this.getOpenApi = () => result;
    result.catch(() => (this.getOpenApi = previous));
    return result;
  };

  private objectSchemaMapping = new Map<string, object>();
  private async buildObjectSchemaMapping() {
    const openApi: any = await this.getOpenApi();
    for (const name in openApi.definitions) {
      const definition = openApi.definitions[name];
      const list = definition["x-kubernetes-group-version-kind"];
      if (list && Array.isArray(list)) {
        for (const entry of list) {
          const key =
            (entry.group ? `/${entry.group}/` : "/") +
            `${entry.version}/${entry.kind}`;
          this.objectSchemaMapping.set(key, {
            $ref: `#/definitions/${name}`,
            definitions: openApi.definitions,
          });
        }
      }
    }
  }

  async getSchemaForObject(kind: string, apiVersion: string) {
    if (this.objectSchemaMapping.size === 0) {
      await this.buildObjectSchemaMapping();
    }

    return this.objectSchemaMapping.get(`/${apiVersion}/${kind}`);
  }

  private async request(config: AxiosRequestConfig) {
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        return await this.client.request(config).catch(rethrowError);
      } catch (err) {
        if (attempt > 5) {
          throw err;
        }

        if (
          err instanceof KubernetesError.InternalServerError ||
          err instanceof KubernetesError.ServiceUnavailable
        ) {
          await sleep(500 * Math.random() * Math.pow(2, attempt));
          continue;
        }

        if (err instanceof KubernetesError.TooManyRequests) {
          await sleep(
            err.retryAfter ?? 500 * Math.random() * Math.pow(2, attempt)
          );
          continue;
        }

        throw err;
      }
    }
  }

  async get(url: string) {
    return (
      await this.request({
        url,
        method: "get",
      })
    ).data;
  }

  async post(url: string, data: any) {
    return (
      await this.request({
        url,
        method: "post",
        data,
      })
    ).data;
  }

  async put(url: string, data: any) {
    return (
      await this.request({
        url,
        method: "put",
        data,
      })
    ).data;
  }

  async patch(url: string, data: any) {
    return (
      await this.request({
        url,
        method: "patch",
        data,
      })
    ).data;
  }

  async apply(url: string, data: any) {
    return (
      await this.request({
        url,
        method: "patch",
        data,
        headers: { "Content-Type": "application/apply-patch+yaml" },
      })
    ).data;
  }

  async delete(url: string, options?: DeleteOptions) {
    return (
      await this.request({
        url,
        method: "delete",
        ...(options
          ? {
              data: {
                ...options,
                kind: "DeleteOptions",
                apiVersion: "meta/v1",
              },
            }
          : {}),
      })
    ).data;
  }

  async websocket(url: string) {
    return new Promise<WebSocket>((resolve, reject) => {
      const wsUrl = (
        this.client.defaults.baseURL?.replace(/\/$/, "") + url
      ).replace(/^http/, "ws");
      const ws = new WebSocket(wsUrl, ["v4.channel.k8s.io"], {
        headers: this.client.defaults.headers,
        agent: this.client.defaults.httpsAgent,
      });
      const errorHandler = (err: Error) => {
        reject(err);
      };
      ws.on("open", () => {
        ws.removeListener("error", errorHandler);
        resolve(ws);
      });
      ws.on("error", errorHandler);
      ws.on("unexpected-response", (req, res) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = JSON.parse(Buffer.concat(data).toString());
          } catch (e) {}
          try {
            rethrowError({
              response: {
                headers: res.headers,
                status: res.statusCode,
                data: parsed,
              },
            });
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  }
}
