import { AsyncLocalStorage } from "async_hooks";
import Axios, { AxiosInstance } from "axios";

interface ClusterConnectionOptions {
  paranoid: boolean;
}

class KubernetesError extends Error {
  public details: any;
  public code: number;
  constructor(obj: any) {
    super(obj.message);
    this.details = obj.details;
    this.code = obj.code;
  }
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
    options: {
      baseUrl: string;
      token: string;
    } & Partial<ClusterConnectionOptions>
  ) {
    this.client = Axios.create({
      baseURL: options.baseUrl,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
      },
    });

    this.options = {
      paranoid: options.paranoid ?? true,
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
    try {
      const res = await this.client.get(url);
      return res.data;
    } catch (e) {
      if (e?.response?.data?.message) {
        throw new KubernetesError(e.response.data);
      }
      throw e;
    }
  }

  async post(url: string, data: any) {
    try {
      const res = await this.client.post(url, data);
      return res.data;
    } catch (e) {
      if (e?.response?.data?.message) {
        throw new KubernetesError(e.response.data);
      }
      throw e;
    }
  }
}
