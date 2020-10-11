import { AsyncLocalStorage } from "async_hooks";
import Axios, { AxiosInstance } from "axios";
import * as AxiosLogger from "axios-logger";
import { readFileSync } from "fs";
import { Agent } from "https";
import { homedir } from "os";
import { join } from "path";
import { KubeConfig } from "./KubeConfig";

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

export class KubernetesError extends Error {
  public details: any;
  public code: number;
  constructor(obj: any) {
    super(obj.message);
    this.details = obj.details;
    this.code = obj.code;
  }

  static BadRequest = class BadRequest extends KubernetesError {};
  static Unauthorized = class Unauthorized extends KubernetesError {};
  static Forbidden = class Forbidden extends KubernetesError {};
  static NotFound = class NotFound extends KubernetesError {};
  static MethodNotAllowed = class MethodNotAllowed extends KubernetesError {};
  static Conflict = class Conflict extends KubernetesError {};
  static Gone = class Gone extends KubernetesError {};
  static UnprocessableEntity = class UnprocessableEntity extends KubernetesError {};
  static TooManyRequests = class TooManyRequests extends KubernetesError {};
  static InternalServerError = class InternalServerError extends KubernetesError {};
  static ServiceUnavailable = class ServiceUnavailable extends KubernetesError {};
  static ServerTimeout = class ServerTimeout extends KubernetesError {};
}

function rethrowError(e: any): never {
  if (e?.response?.data?.message) {
    switch (e.response.data.code) {
      case 400:
        throw new KubernetesError.BadRequest(e.response.data);
      case 401:
        throw new KubernetesError.Unauthorized(e.response.data);
      case 403:
        throw new KubernetesError.Forbidden(e.response.data);
      case 404:
        throw new KubernetesError.NotFound(e.response.data);
      case 405:
        throw new KubernetesError.MethodNotAllowed(e.response.data);
      case 409:
        throw new KubernetesError.Conflict(e.response.data);
      case 410:
        throw new KubernetesError.Gone(e.response.data);
      case 422:
        throw new KubernetesError.UnprocessableEntity(e.response.data);
      case 429:
        throw new KubernetesError.TooManyRequests(e.response.data);
      case 500:
        throw new KubernetesError.InternalServerError(e.response.data);
      case 503:
        throw new KubernetesError.ServiceUnavailable(e.response.data);
      case 504:
        throw new KubernetesError.ServerTimeout(e.response.data);
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

  async delete(url: string, options?: DeleteOptions) {
    // Axios 0.20.0 can't call delete() with body.
    // Workaround: https://github.com/axios/axios/issues/3220#issuecomment-688566578
    const res = await this.client
      .request({
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
      .catch(rethrowError);
    return res.data;
  }
}
