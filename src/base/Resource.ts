import * as QueryString from "querystring";
import { LabelSelector } from "../core/types";
import { validate, _throw } from "../utils";
import { ClusterConnection } from "./ClusterConnection";

export interface CreatableMetadata {
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ExtraMetadata {
  readonly selfLink: string;
  readonly uid: string;
  readonly resourceVersion: string;
  readonly creationTimestamp: string;
  finalizers?: string[];
}

export interface BasicResourceSpec {
  finalizers?: string[];
}

export class Resource<MetadataT, SpecT, StatusT> {
  constructor(
    public metadata: CreatableMetadata & ExtraMetadata & MetadataT,
    public spec: SpecT & BasicResourceSpec,
    public status: StatusT
  ) {}

  protected static isNamespaced = false;
  protected static kind: string | null = null;
  protected static apiVersion: string | null = null;
  protected static apiPlural: string | null = null;

  private static parseRawObject: (
    conn: ClusterConnection,
    obj: any
  ) => Promise<Resource<any, any, any>>;

  protected async parseRawObject(
    conn: ClusterConnection,
    obj: any
  ): Promise<this> {
    return (await this.base.parseRawObject(conn, obj)) as this;
  }

  private get base() {
    return this.constructor as typeof Resource &
      StaticResource<
        MetadataT,
        SpecT,
        StatusT,
        Resource<MetadataT, SpecT, StatusT>
      >;
  }

  async delete() {
    const conn = ClusterConnection.current();
    const raw = await conn.delete(this.metadata.selfLink, {
      preconditions: {
        resourceVersion: this.metadata.resourceVersion,
        uid: this.metadata.uid,
      },
    });
    return await this.parseRawObject(conn, raw);
  }

  async reload() {
    const conn = ClusterConnection.current();
    const raw = await conn.get(this.metadata.selfLink);
    const obj = await this.parseRawObject(conn, raw);
    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async save() {
    const kind =
      this.base.kind ??
      _throw(new Error(`Please specify 'kind' for ${this.base.name}`));
    const apiVersion =
      this.base.apiVersion ??
      _throw(new Error(`Please specify 'apiVersion' for ${this.base.name}`));

    const conn = ClusterConnection.current();
    const raw = await conn.put(this.metadata.selfLink, {
      apiVersion,
      kind,
      metadata: this.metadata,
      spec: this.spec,
      status: this.status,
    });
    const obj = await this.parseRawObject(conn, raw);
    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }
}

type Selector = LabelSelector & {
  matchFields?: Record<string, string>;
  doesntMatchFields?: Record<string, string>;
};

export class NamespacedResource<MetadataT, SpecT, StatusT> extends Resource<
  MetadataT & { namespace: string },
  SpecT,
  StatusT
> {
  protected static isNamespaced = true;

  private get nsbase() {
    return this.constructor as typeof NamespacedResource &
      StaticNamespacedResource<
        MetadataT & { namespace: string },
        SpecT,
        StatusT,
        Resource<MetadataT & { namespace: string }, SpecT, StatusT>
      >;
  }
}

interface StaticResource<MetadataT, SpecT, StatusT, T> {
  get(name: string): Promise<T>;
  delete(name: string): Promise<T>;
  list(options?: { selector?: Selector; limit?: number }): Promise<T[]>;
  create: {} extends SpecT
    ? (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT &
          ({ generateName: string } | { name: string }),
        spec?: SpecT
      ) => Promise<T>
    : (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT &
          ({ generateName: string } | { name: string }),
        spec: SpecT
      ) => Promise<T>;
  apply: {} extends SpecT
    ? (metadata: CreatableMetadata & MetadataT, spec?: SpecT) => Promise<T>
    : (metadata: CreatableMetadata & MetadataT, spec: SpecT) => Promise<T>;
}

interface StaticNamespacedResource<MetadataT, SpecT, StatusT, T> {
  get(namespace: string, name: string): Promise<T>;
  delete(namespace: string, name: string): Promise<T>;
  list(options?: {
    namespace?: string;
    selector?: Selector;
    limit?: number;
  }): Promise<T[]>;
  create: {} extends SpecT
    ? (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT & { namespace: string } & (
            | { generateName: string }
            | { name: string }
          ),
        spec?: SpecT
      ) => Promise<T>
    : (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT & { namespace: string } & (
            | { generateName: string }
            | { name: string }
          ),
        spec: SpecT
      ) => Promise<T>;
  apply: {} extends SpecT
    ? (
        metadata: CreatableMetadata & MetadataT & { namespace: string },
        spec?: SpecT
      ) => Promise<T>
    : (
        metadata: CreatableMetadata & MetadataT & { namespace: string },
        spec: SpecT
      ) => Promise<T>;
}

function implementStaticMethods(
  klass: typeof Resource &
    StaticResource<any, any, any, Resource<any, any, any>> &
    StaticNamespacedResource<any, any, any, Resource<any, any, any>> & {
      isNamespaced: boolean;
      kind: string | null;
      apiVersion: string | null;
      apiPlural: string | null;
    }
) {
  const kind =
    klass.kind ?? _throw(new Error(`Please specify 'kind' for ${klass.name}`));
  const apiVersion =
    klass.apiVersion ??
    _throw(new Error(`Please specify 'apiVersion' for ${klass.name}`));
  const apiPlural =
    klass.apiPlural ??
    _throw(new Error(`Please specify 'apiPlural' for ${klass.name}`));

  async function parseRawObject(conn: ClusterConnection, obj: any) {
    if (conn.options.paranoid) {
      if (obj.kind !== kind || obj.apiVersion !== apiVersion) {
        throw new Error(
          `Expected to receive ${apiVersion} ${kind}, but got ${obj.apiVersion} ${obj.kind}`
        );
      }

      const schema = await conn.getSchemaForObject(kind, apiVersion);
      if (!schema) {
        throw new Error(`Unable to find schema for ${apiVersion} ${kind}`);
      }
      validate(schema, obj);
    }

    return new klass(obj.metadata, obj.spec || {}, obj.status || {});
  }

  (klass as any).parseRawObject = parseRawObject;

  klass.get = async (namespaceOrName: string, name?: string) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;
    if (klass.isNamespaced) {
      const namespace = namespaceOrName;
      if (!name) {
        throw new Error("Expected to receive resource name");
      }
      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(
        namespace
      )}/${apiPlural}/${encodeURIComponent(name)}`;
    } else {
      name = namespaceOrName;
      url = `/${base}/${apiVersion}/${apiPlural}/${encodeURIComponent(name)}`;
    }
    const raw = await conn.get(url);
    return await parseRawObject(conn, raw);
  };

  klass.delete = async (namespaceOrName: string, name?: string) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;
    if (klass.isNamespaced) {
      const namespace = namespaceOrName;
      if (!name) {
        throw new Error("Expected to receive resource name");
      }
      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(
        namespace
      )}/${apiPlural}/${encodeURIComponent(name)}`;
    } else {
      name = namespaceOrName;
      url = `/${base}/${apiVersion}/${apiPlural}/${encodeURIComponent(name)}`;
    }
    const raw = await conn.delete(url);
    return await parseRawObject(conn, raw);
  };

  klass.list = async (
    options: {
      namespace?: string;
      selector?: Selector;
      limit?: number;
    } = {}
  ) => {
    const base = apiVersion.includes("/") ? `apis` : "api";
    const apiUrl = `/${base}/${apiVersion}/${
      klass.isNamespaced && options.namespace
        ? `namespaces/${encodeURIComponent(options.namespace)}/`
        : ``
    }${apiPlural}`;

    const qs: Record<string, string> = {};

    if (options.limit) {
      qs.limit = `${options.limit}`;
    }

    {
      const labelSelector: string[] = [];
      if (options.selector?.matchLabels) {
        for (const key in options.selector?.matchLabels) {
          labelSelector.push(`${key}=${options.selector?.matchLabels[key]}`);
        }
      }
      if (options.selector?.matchExpressions) {
        for (const expression of options.selector?.matchExpressions) {
          switch (expression.operator) {
            case "Exists":
              labelSelector.push(`${expression.key}`);
              break;
            case "DoesNotExist":
              labelSelector.push(`!${expression.key}`);
              break;
            case "In":
              labelSelector.push(
                `${expression.key} in (${expression.values.join(",")})`
              );
              break;
            case "NotIn":
              labelSelector.push(
                `${expression.key} notin (${expression.values.join(",")})`
              );
              break;
          }
        }
      }
      if (labelSelector.length > 0) {
        qs.labelSelector = labelSelector.join(",");
      }
    }
    {
      const fieldSelector: string[] = [];
      if (options.selector?.matchFields) {
        for (const key in options.selector?.matchFields) {
          fieldSelector.push(`${key}==${options.selector?.matchFields[key]}`);
        }
      }
      if (options.selector?.doesntMatchFields) {
        for (const key in options.selector?.doesntMatchFields) {
          fieldSelector.push(
            `${key}!=${options.selector?.doesntMatchFields[key]}`
          );
        }
      }
      if (fieldSelector.length > 0) {
        qs.fieldSelector = fieldSelector.join(",");
      }
    }

    const conn = ClusterConnection.current();
    const list: {
      kind: string;
      apiVersion: string;
      items: any[];
    } = await conn.get(`${apiUrl}?${QueryString.stringify(qs)}`);

    if (!list.kind.endsWith("List")) {
      throw new Error(`Expected ${list.kind} to end with 'List'`);
    }

    const innerKind = list.kind.replace(/List$/, "");

    return await Promise.all(
      list.items.map((raw) =>
        parseRawObject(conn, {
          kind: innerKind,
          apiVersion: list.apiVersion,
          ...raw,
        })
      )
    );
  };

  klass.create = async (
    metadata: CreatableMetadata & { namespace?: string },
    spec: any
  ) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;
    if (klass.isNamespaced) {
      const namespace = metadata.namespace;
      if (!namespace) {
        throw new Error("Expected namespaced object to have a namespace");
      }
      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(
        namespace
      )}/${apiPlural}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}`;
    }
    const raw = await conn.post(url, {
      apiVersion,
      kind,
      metadata,
      spec: spec ?? {},
    });
    return await parseRawObject(conn, raw);
  };

  (klass as StaticResource<any, any, any, Resource<any, any, any>> &
    StaticNamespacedResource<
      any,
      any,
      any,
      Resource<any, any, any>
    >).apply = async (
    metadata: CreatableMetadata & { namespace?: string },
    spec: any
  ) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;
    if (klass.isNamespaced) {
      const namespace = metadata.namespace;
      if (!namespace) {
        throw new Error("Expected namespaced object to have a namespace");
      }
      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(
        namespace
      )}/${apiPlural}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}`;
    }
    const raw = await conn.apply(
      `${url}/${metadata.name}?fieldManager=${encodeURIComponent(
        conn.options.name
      )}&force=true`,
      {
        apiVersion,
        kind,
        metadata,
        spec: spec ?? {},
      }
    );
    return await parseRawObject(conn, raw);
  };
}

export function wrapResource<
  MetadataT extends object,
  SpecT,
  StatusT,
  InstanceT extends Resource<MetadataT, SpecT, StatusT>,
  T extends {
    new (...args: any[]): InstanceT;
  }
>(
  klass: T
): StaticResource<MetadataT, SpecT, StatusT, InstanceT> & Omit<T, "apply"> {
  implementStaticMethods(klass as any);
  return klass as any;
}

export function wrapNamespacedResource<
  MetadataT extends object,
  SpecT,
  StatusT,
  InstanceT extends NamespacedResource<MetadataT, SpecT, StatusT>,
  T extends {
    new (...args: any[]): InstanceT;
  }
>(
  klass: T
): StaticNamespacedResource<MetadataT, SpecT, StatusT, InstanceT> &
  Omit<T, "apply"> {
  implementStaticMethods(klass as any);
  return klass as any;
}
