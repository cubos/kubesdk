import { AsyncLocalStorage } from "async_hooks";
import Axios, { AxiosInstance } from "axios";
import { readFileSync } from "fs";
import { Agent } from "https";
import { homedir } from "os";
import { join } from "path";
import { KubeConfig } from "./KubeConfig";

interface ClusterConnectionOptions {
  paranoid: boolean;
  name: string;
}

export class KubernetesError extends Error {
  public details: any;
  public code: number;
  constructor(obj: any) {
    super(obj.message);
    this.details = obj.details;
    this.code = obj.code;
  }

  static NotFound = class NotFound extends KubernetesError {};
}

function rethrowError(e: any): never {
  if (e?.response?.data?.message) {
    switch (e.response.data.code) {
      case 404:
        throw new KubernetesError.NotFound(e.response.data);
      default:
        console.error("Unhandled error code", e.response.data);
        throw new KubernetesError(e.response.data);
    }
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
          Accept: "application/json",
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
          Accept: "application/json",
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
        ...(context.user.username && context.user.password
          ? {
              auth: {
                username: context.user.username,
                password: context.user.password,
              },
            }
          : {}),
      });
    }

    this.options = {
      paranoid: options.paranoid ?? true,
      name: options.name ?? "kubeoperator",
    };
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

  async get(url: string) {
    const res = await this.client.get(url).catch(rethrowError);
    return res.data;
  }

  async post(url: string, data: any) {
    const res = await this.client.post(url, data).catch(rethrowError);
    return res.data;
  }

  async put(url: string, data: any) {
    const res = await this.client.put(url, data).catch(rethrowError);
    return res.data;
  }

  async patch(url: string, data: any) {
    const res = await this.client.patch(url, data).catch(rethrowError);
    return res.data;
  }

  async apply(url: string, data: any) {
    const res = await this.client
      .patch(url, data, {
        headers: { "Content-Type": "application/apply-patch+yaml" },
      })
      .catch(rethrowError);
    return res.data;
  }
}
