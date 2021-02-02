import { AsyncLocalStorage } from "async_hooks";
import { accessSync, readFileSync } from "fs";
import type { IncomingMessage, OutgoingHttpHeaders } from "http";
import { Agent } from "https";
import { homedir } from "os";
import { join } from "path";
import type { Readable } from "stream";
import { Transform } from "stream";

import Axios from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import * as AxiosLogger from "axios-logger";
import axiosRetry from "axios-retry";
import WebSocket from "ws";

import { sleep } from "../utils";
import { KubeConfig } from "./KubeConfig";
import { KubernetesError } from "./KubernetesError";

interface ClusterConnectionOptions {
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

function rethrowError(e: Error | AxiosError): never {
  if ("response" in e && e.response) {
    const retryAfterRaw = (e.response.headers as Record<string, string>)["retry-after"];
    let data = e.response.data as Record<string, unknown>;

    if (typeof data === "string") {
      data = { message: data };
    }

    data.code ??= e.response.status;
    throw KubernetesError.fromStatus(data, retryAfterRaw);
  }

  throw e;
}

export class WatchStream extends Transform {
  private previous: Buffer[] = [];

  constructor(private wrappedStream: Readable) {
    super({
      readableObjectMode: true,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void) {
    let current = chunk instanceof Buffer ? chunk : Buffer.from(chunk, encoding);

    for (;;) {
      const index = current.indexOf(10);

      if (index < 0) {
        this.previous.push(current);
        callback();
        return;
      }

      const data = Buffer.concat([...this.previous, current.slice(0, index)]).toString();

      this.previous = [];
      current = current.slice(index + 1);

      this.push(JSON.parse(data));
    }
  }

  _destroy() {
    this.wrappedStream.destroy();
  }
}

export class ClusterConnection {
  static asyncLocalStorage = new AsyncLocalStorage<ClusterConnection>();

  static defaultConnection: ClusterConnection | undefined;

  static current() {
    return this.asyncLocalStorage.getStore() ?? (this.defaultConnection ??= new ClusterConnection());
  }

  private client: AxiosInstance;

  public readonly options: Readonly<ClusterConnectionOptions>;

  public readonly namespace: string;

  constructor(
    options: (
      | {
          baseUrl: string;
          token: string;
          certificate?: Buffer;
          namespace?: string;
        }
      | {
          kubeconfigPath?: string;
          context?: string;
        }
    ) &
      Partial<ClusterConnectionOptions> = {},
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

      this.namespace = options.namespace ?? "default";
    } else {
      let kubeconfigPath = options.kubeconfigPath ?? process.env.KUBECONFIG;

      if (!kubeconfigPath) {
        kubeconfigPath = join(homedir(), ".kube", "config");

        try {
          accessSync(kubeconfigPath);
        } catch {
          kubeconfigPath = undefined;
        }
      }

      if (kubeconfigPath) {
        const kubeconfig = readFileSync(kubeconfigPath, "utf-8");

        const config = new KubeConfig(kubeconfig);
        const context = config.context(options.context);

        const headers = {} as Record<string, string | string[]>;

        if (context.user.token) {
          headers.Authorization = `Bearer ${context.user.token}`;
        } else if (context.user.username) {
          headers.Authorization = `Basic ${Buffer.from(
            `${context.user.username}:${unescape(encodeURIComponent(context.user.password ?? ""))}`,
          ).toString("base64")}`;
        }

        if (context.user.impersonateUser) {
          headers["Impersonate-User"] = context.user.impersonateUser;
        }

        if (context.user.impersonateGroups) {
          headers["Impersonate-Group"] = context.user.impersonateGroups;
        }

        if (context.user.impersonateExtra) {
          for (const [key, value] of context.user.impersonateExtra) {
            headers[`Impersonate-Extra-${key}`] = value;
          }
        }

        this.client = Axios.create({
          baseURL: context.cluster.server.toString(),
          headers,
          httpsAgent: new Agent({
            ...(context.cluster.certificateAuthorityData ? { ca: context.cluster.certificateAuthorityData } : {}),
            ...(context.user.clientCertificateData && context.user.clientKeyData
              ? {
                  cert: context.user.clientCertificateData,
                  key: context.user.clientKeyData,
                }
              : {}),
          }),
        });

        this.namespace = context.namespace ?? "default";
      } else {
        try {
          const token = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf-8");
          const ca = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");

          this.namespace = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace", "utf-8");

          this.client = Axios.create({
            baseURL: "https://kubernetes.default",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            httpsAgent: new Agent({
              ca,
            }),
          });
        } catch {
          throw new Error("Could not find a Kubernetes default credential to use");
        }
      }
    }

    axiosRetry(this.client, { retryDelay: axiosRetry.exponentialDelay, retries: 5 });

    this.options = {
      logRequests: options.logRequests ?? false,
      name: options.name ?? "kubesdk",
    };

    if (this.options.logRequests) {
      this.client.interceptors.request.use(AxiosLogger.requestLogger);
    }
  }

  use<T>(func: () => T) {
    return ClusterConnection.asyncLocalStorage.run(this, func);
  }

  private async request<T = object>(config: AxiosRequestConfig) {
    let attempt = 0;

    for (;;) {
      attempt += 1;
      try {
        return await this.client.request<T>(config).catch(rethrowError);
      } catch (err) {
        if (attempt > 5) {
          throw err;
        }

        if (err instanceof KubernetesError.InternalServerError || err instanceof KubernetesError.ServiceUnavailable) {
          await sleep(500 * Math.random() * Math.pow(2, attempt));
          continue;
        }

        if (err instanceof KubernetesError.TooManyRequests) {
          await sleep(err.retryAfter ?? 500 * Math.random() * Math.pow(2, attempt));
          continue;
        }

        throw err;
      }
    }
  }

  async get<T = object>(url: string) {
    return (
      await this.request<T>({
        url,
        method: "get",
      })
    ).data;
  }

  async post<T = object>(url: string, data: unknown) {
    return (
      await this.request<T>({
        url,
        method: "post",
        data,
      })
    ).data;
  }

  async put<T = object>(url: string, data: unknown) {
    return (
      await this.request<T>({
        url,
        method: "put",
        data,
      })
    ).data;
  }

  async patch<T = object>(url: string, data: unknown) {
    return (
      await this.request<T>({
        url,
        method: "patch",
        data,
      })
    ).data;
  }

  async apply<T = object>(url: string, data: unknown) {
    return (
      await this.request<T>({
        url,
        method: "patch",
        data,
        headers: {
          "Content-Type": "application/apply-patch+yaml",
        },
      })
    ).data;
  }

  async delete<T = object>(url: string, options?: DeleteOptions) {
    return (
      await this.request<T>({
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

  async watch(url: string, resourceVersion?: string) {
    const response = await this.request<IncomingMessage>({
      url: `${url}${url.includes("?") ? "&" : "?"}allowWatchBookmarks=true${
        resourceVersion ? `&resourceVersion=${resourceVersion}` : ""
      }`,
      method: "get",
      responseType: "stream",
      headers: {
        Accept: "application/json;stream=watch",
      },
    });

    return response.data.pipe(new WatchStream(response.data));
  }

  async websocket(url: string) {
    return new Promise<WebSocket>((resolve, reject) => {
      const wsUrl = ((this.client.defaults.baseURL?.replace(/\/$/u, "") ?? "") + url).replace(/^http/u, "ws");
      const ws = new WebSocket(wsUrl, ["v4.channel.k8s.io"], {
        headers: this.client.defaults.headers as OutgoingHttpHeaders,
        agent: this.client.defaults.httpsAgent as Agent,
      });

      function errorHandler(err: Error) {
        reject(err);
      }

      ws.on("open", () => {
        ws.removeListener("error", errorHandler);
        resolve(ws);
      });
      ws.on("error", errorHandler);
      ws.on("unexpected-response", (req, res) => {
        const data: Buffer[] = [];

        res.on("data", chunk => data.push(chunk));
        res.on("end", () => {
          let parsed = {};

          try {
            parsed = JSON.parse(Buffer.concat(data).toString()) as Record<string, unknown>;
          } catch (e) {
            // ignore
          }

          try {
            rethrowError(({
              response: {
                headers: res.headers,
                status: res.statusCode ?? 500,
                data: parsed,
              },
            } as unknown) as AxiosError);
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  }
}
