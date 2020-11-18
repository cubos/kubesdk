import * as QueryString from "querystring";
import { LabelSelector } from "../core/types";
import { has, throwError, validate } from "../utils";
import { ClusterConnection } from "./ClusterConnection";
import { ResourceListWatch } from "./ResourceListWatch";
import { ResourceWatch } from "./ResourceWatch";

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

export interface IResource<MetadataT, SpecT, StatusT> {
  metadata: CreatableMetadata & ExtraMetadata & MetadataT;
  spec: SpecT & BasicResourceSpec;
  status: StatusT;
  delete(): Promise<this>;
  reload(): Promise<void>;
  save(): Promise<void>;
  saveStatus(): Promise<void>;
  watch(): AsyncGenerator<"DELETED" | "ADDED" | "MODIFIED">;
}

export interface IStaticResource<InstanceT, MetadataT, SpecT, StatusT> {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new (
    metadata: CreatableMetadata & ExtraMetadata & MetadataT,
    spec: SpecT & BasicResourceSpec,
    status: StatusT,
  ): InstanceT;
}

export class Resource<MetadataT, SpecT, StatusT> implements IResource<MetadataT, SpecT, StatusT> {
  constructor(
    public metadata: CreatableMetadata & ExtraMetadata & MetadataT,
    public spec: SpecT & BasicResourceSpec,
    public status: StatusT,
  ) {}

  protected static isNamespaced = false;

  protected static kind: string | null = null;

  protected static apiVersion: string | null = null;

  protected static apiPlural: string | null = null;

  protected static hasInlineSpec = false;

  private static parseRawObject: (
    conn: ClusterConnection,
    obj: unknown,
  ) => Promise<Resource<unknown, unknown, unknown>>;

  protected async parseRawObject(conn: ClusterConnection, obj: unknown): Promise<this> {
    return (await this.base.parseRawObject(conn, obj)) as this;
  }

  private get base(): typeof Resource & StaticResource<MetadataT, SpecT, StatusT, Resource<MetadataT, SpecT, StatusT>> {
    return this.constructor as typeof Resource &
      StaticResource<MetadataT, SpecT, StatusT, Resource<MetadataT, SpecT, StatusT>>;
  }

  async delete() {
    const conn = ClusterConnection.current();
    const raw = await conn.delete(this.metadata.selfLink, {
      preconditions: {
        resourceVersion: this.metadata.resourceVersion,
        uid: this.metadata.uid,
      },
    });

    return this.parseRawObject(conn, raw);
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
    const kind = this.base.kind ?? throwError(new Error(`Please specify 'kind' for ${this.base.name}`));
    const apiVersion =
      this.base.apiVersion ?? throwError(new Error(`Please specify 'apiVersion' for ${this.base.name}`));

    const conn = ClusterConnection.current();
    const raw = await conn.put(this.metadata.selfLink, {
      apiVersion,
      kind,
      metadata: this.metadata,
      status: this.status,
      ...(this.base.hasInlineSpec ? this.spec : { spec: this.spec }),
    });
    const obj = await this.parseRawObject(conn, raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async saveStatus() {
    const kind = this.base.kind ?? throwError(new Error(`Please specify 'kind' for ${this.base.name}`));
    const apiVersion =
      this.base.apiVersion ?? throwError(new Error(`Please specify 'apiVersion' for ${this.base.name}`));

    const conn = ClusterConnection.current();
    const raw = await conn.put(`${this.metadata.selfLink}/status`, {
      apiVersion,
      kind,
      metadata: this.metadata,
      status: this.status,
      ...(this.base.hasInlineSpec ? this.spec : { spec: this.spec }),
    });
    const obj = await this.parseRawObject(conn, raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async *watch() {
    for await (const event of this.base.watch(this.metadata.name)) {
      if (event.type === "DELETED" || event.object.metadata.uid !== this.metadata.uid) {
        yield "DELETED";
        return;
      }

      if (event.type === "ADDED" || event.object.metadata.resourceVersion === this.metadata.resourceVersion) {
        continue;
      }

      this.metadata = event.object.metadata;
      this.spec = event.object.spec;
      this.status = event.object.status;
      yield event.type;
    }
  }
}

type Selector = LabelSelector & {
  matchFields?: Record<string, string>;
  doesntMatchFields?: Record<string, string>;
};

export interface INamespacedResource<MetadataT, SpecT, StatusT>
  extends IResource<MetadataT & { namespace: string }, SpecT, StatusT> {}

export interface IStaticNamespacedResource<InstanceT, MetadataT, SpecT, StatusT>
  extends IStaticResource<InstanceT, MetadataT & { namespace: string }, SpecT, StatusT> {}

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

  async *watch() {
    for await (const event of this.nsbase.watch(this.metadata.namespace, this.metadata.name)) {
      if (event.type === "DELETED" || event.object.metadata.uid !== this.metadata.uid) {
        yield "DELETED";
        return;
      }

      if (event.type === "ADDED" || event.object.metadata.resourceVersion === this.metadata.resourceVersion) {
        continue;
      }

      this.metadata = event.object.metadata;
      this.spec = event.object.spec;
      this.status = event.object.status;
      yield event.type;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface StaticResource<MetadataT, SpecT, StatusT, T extends IResource<MetadataT, SpecT, StatusT>> {
  get(name: string): Promise<T>;
  watch(name: string): ResourceWatch<T>;
  delete(name: string): Promise<T>;
  list(options?: { selector?: Selector; limit?: number }): Promise<T[]>;
  watchList(options?: { selector?: Selector }): ResourceListWatch<T>;
  create: {} extends SpecT
    ? (
        metadata: Omit<CreatableMetadata, "name"> & MetadataT & ({ generateName: string } | { name: string }),
        spec?: SpecT,
      ) => Promise<T>
    : (
        metadata: Omit<CreatableMetadata, "name"> & MetadataT & ({ generateName: string } | { name: string }),
        spec: SpecT,
      ) => Promise<T>;
  apply: {} extends SpecT
    ? (metadata: CreatableMetadata & MetadataT, spec?: SpecT) => Promise<T>
    : (metadata: CreatableMetadata & MetadataT, spec: SpecT) => Promise<T>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface StaticNamespacedResource<
  MetadataT,
  SpecT,
  StatusT,
  T extends INamespacedResource<MetadataT, SpecT, StatusT>
> {
  get(namespace: string, name: string): Promise<T>;
  watch(namespace: string, name: string): ResourceWatch<T>;
  delete(namespace: string, name: string): Promise<T>;
  list(options?: { namespace?: string; selector?: Selector; limit?: number }): Promise<T[]>;
  watchList(options?: { namespace?: string; selector?: Selector }): ResourceListWatch<T>;
  create: {} extends SpecT
    ? (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT & { namespace: string } & ({ generateName: string } | { name: string }),
        spec?: SpecT,
      ) => Promise<T>
    : (
        metadata: Omit<CreatableMetadata, "name"> &
          MetadataT & { namespace: string } & ({ generateName: string } | { name: string }),
        spec: SpecT,
      ) => Promise<T>;
  apply: {} extends SpecT
    ? (metadata: CreatableMetadata & MetadataT & { namespace: string }, spec?: SpecT) => Promise<T>
    : (metadata: CreatableMetadata & MetadataT & { namespace: string }, spec: SpecT) => Promise<T>;
}

function implementStaticMethods(
  klass: typeof Resource &
    StaticResource<unknown, unknown, unknown, IResource<unknown, unknown, unknown>> &
    StaticNamespacedResource<unknown, unknown, unknown, INamespacedResource<unknown, unknown, unknown>> & {
      isNamespaced: boolean;
      kind: string | null;
      apiVersion: string | null;
      apiPlural: string | null;
      hasInlineSpec: boolean;
    },
) {
  const kind = klass.kind ?? throwError(new Error(`Please specify 'kind' for ${klass.name}`));
  const apiVersion = klass.apiVersion ?? throwError(new Error(`Please specify 'apiVersion' for ${klass.name}`));
  const apiPlural = klass.apiPlural ?? throwError(new Error(`Please specify 'apiPlural' for ${klass.name}`));
  const { hasInlineSpec } = klass;

  async function parseRawObject(conn: ClusterConnection, obj: object) {
    if (!has(obj, "kind") || !has(obj, "apiVersion") || !has(obj, "metadata")) {
      throw new Error(`Expected to receive an object with "kind", "apiVersion" and "metadata"`);
    }

    if (conn.options.paranoid) {
      if (obj.kind !== kind || obj.apiVersion !== apiVersion) {
        throw new Error(
          `Expected to receive ${apiVersion} ${kind}, but got ${obj.apiVersion as string} ${obj.kind as string}`,
        );
      }

      const schema = await conn.getSchemaForObject(kind, apiVersion);

      if (!schema) {
        throw new Error(`Unable to find schema for ${apiVersion} ${kind}`);
      }

      validate(schema, obj);
    }

    let spec: any = {};

    if (hasInlineSpec) {
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }

        if (["kind", "apiVersion", "metadata", "status"].includes(key)) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        spec[key] = (obj as any)[key];
      }
    } else if (has(obj, "spec")) {
      ({ spec } = obj);
    }

    return new klass(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.metadata as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spec,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      has(obj, "status") ? (obj.status as any) : {},
    );
  }

  ((klass as unknown) as Record<string, unknown>).parseRawObject = parseRawObject;

  function selectorToQueryObject(selector?: Selector) {
    const qs: Record<string, string> = {};

    const labelSelector: string[] = [];

    if (selector?.matchLabels) {
      for (const [key, value] of Object.entries(selector.matchLabels)) {
        labelSelector.push(`${key}=${value}`);
      }
    }

    if (selector?.matchExpressions) {
      for (const expression of selector.matchExpressions) {
        switch (expression.operator) {
          case "Exists":
            labelSelector.push(`${expression.key}`);
            break;
          case "DoesNotExist":
            labelSelector.push(`!${expression.key}`);
            break;
          case "In":
            labelSelector.push(`${expression.key} in (${expression.values.join(",")})`);
            break;
          case "NotIn":
            labelSelector.push(`${expression.key} notin (${expression.values.join(",")})`);
            break;
          default:
            // Never
            break;
        }
      }
    }

    if (labelSelector.length > 0) {
      qs.labelSelector = labelSelector.join(",");
    }

    const fieldSelector: string[] = [];

    if (selector?.matchFields) {
      for (const [key, value] of Object.entries(selector.matchFields)) {
        fieldSelector.push(`${key}==${value}`);
      }
    }

    if (selector?.doesntMatchFields) {
      for (const [key, value] of Object.entries(selector.doesntMatchFields)) {
        fieldSelector.push(`${key}!=${value}`);
      }
    }

    if (fieldSelector.length > 0) {
      qs.fieldSelector = fieldSelector.join(",");
    }

    return qs;
  }

  klass.get = async (namespaceOrName: string, name?: string) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;

    if (klass.isNamespaced) {
      const namespace = namespaceOrName;

      if (!name) {
        throw new Error("Expected to receive resource name");
      }

      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(namespace)}/${apiPlural}/${encodeURIComponent(
        name,
      )}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}/${encodeURIComponent(namespaceOrName)}`;
    }

    const raw = await conn.get(url);

    return parseRawObject(conn, raw);
  };

  klass.watch = (namespaceOrName: string, name?: string) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;

    if (klass.isNamespaced) {
      const namespace = namespaceOrName;

      if (!name) {
        throw new Error("Expected to receive resource name");
      }

      url = `/${base}/${apiVersion}/watch/namespaces/${encodeURIComponent(namespace)}/${apiPlural}/${encodeURIComponent(
        name,
      )}`;
    } else {
      url = `/${base}/${apiVersion}/watch/${apiPlural}/${encodeURIComponent(namespaceOrName)}`;
    }

    return new ResourceWatch<typeof klass.prototype>(conn, url, async raw => parseRawObject(conn, raw));
  };

  klass.watchList = (
    options: {
      namespace?: string;
      selector?: Selector;
      limit?: number;
    } = {},
  ) => {
    const base = apiVersion.includes("/") ? `apis` : "api";
    const apiUrl = `/${base}/${apiVersion}/watch/${
      klass.isNamespaced && options.namespace ? `namespaces/${encodeURIComponent(options.namespace)}/` : ``
    }${apiPlural}`;

    const qs = selectorToQueryObject(options.selector);

    if (options.limit) {
      qs.limit = `${options.limit}`;
    }

    const conn = ClusterConnection.current();
    const url = `${apiUrl}?${QueryString.stringify(qs)}`;

    return new ResourceListWatch<typeof klass.prototype>(conn, url, async raw => parseRawObject(conn, raw));
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

      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(namespace)}/${apiPlural}/${encodeURIComponent(
        name,
      )}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}/${encodeURIComponent(namespaceOrName)}`;
    }

    const raw = await conn.delete(url);

    return parseRawObject(conn, raw);
  };

  klass.list = async (
    options: {
      namespace?: string;
      selector?: Selector;
      limit?: number;
    } = {},
  ) => {
    const base = apiVersion.includes("/") ? `apis` : "api";
    const apiUrl = `/${base}/${apiVersion}/${
      klass.isNamespaced && options.namespace ? `namespaces/${encodeURIComponent(options.namespace)}/` : ``
    }${apiPlural}`;

    const qs = selectorToQueryObject(options.selector);

    if (options.limit) {
      qs.limit = `${options.limit}`;
    }

    const conn = ClusterConnection.current();
    const list: {
      kind: string;
      apiVersion: string;
      items: object[];
    } = await conn.get(`${apiUrl}?${QueryString.stringify(qs)}`);

    if (!list.kind.endsWith("List")) {
      throw new Error(`Expected ${list.kind} to end with 'List'`);
    }

    const innerKind = list.kind.replace(/List$/u, "");

    return Promise.all(
      list.items.map(async raw =>
        parseRawObject(conn, {
          kind: innerKind,
          apiVersion: list.apiVersion,
          ...raw,
        }),
      ),
    );
  };

  klass.create = async (
    metadata: (Omit<CreatableMetadata, "name"> & ({ generateName: string } | { name: string })) & {
      namespace?: string;
    },
    spec: unknown,
  ) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;

    if (klass.isNamespaced) {
      const { namespace } = metadata;

      if (!namespace) {
        throw new Error("Expected namespaced object to have a namespace");
      }

      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(namespace)}/${apiPlural}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}`;
    }

    const raw = await conn.post(url, {
      apiVersion,
      kind,
      metadata,
      ...(hasInlineSpec ? (spec as any) ?? {} : { spec: spec ?? {} }),
    });

    return parseRawObject(conn, raw);
  };

  (klass as StaticResource<unknown, unknown, unknown, IResource<unknown, unknown, unknown>>).apply = async (
    metadata: CreatableMetadata & { namespace?: string },
    spec: unknown,
  ) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;

    if (klass.isNamespaced) {
      const { namespace } = metadata;

      if (!namespace) {
        throw new Error("Expected namespaced object to have a namespace");
      }

      url = `/${base}/${apiVersion}/namespaces/${encodeURIComponent(namespace)}/${apiPlural}`;
    } else {
      url = `/${base}/${apiVersion}/${apiPlural}`;
    }

    const raw = await conn.apply(
      `${url}/${metadata.name}?fieldManager=${encodeURIComponent(conn.options.name)}&force=true`,
      {
        apiVersion,
        kind,
        metadata,
        ...(hasInlineSpec ? (spec as any) ?? {} : { spec: spec ?? {} }),
      },
    );

    return parseRawObject(conn, raw);
  };
}

export function wrapResource<
  MetadataT,
  SpecT,
  StatusT,
  InstanceT extends IResource<MetadataT, SpecT, StatusT>,
  T extends new (...args: never[]) => InstanceT = IStaticResource<InstanceT, MetadataT, SpecT, StatusT>
>(klass: T): StaticResource<MetadataT, SpecT, StatusT, InstanceT> & Omit<T, "apply"> {
  implementStaticMethods(
    (klass as unknown) as typeof Resource &
      StaticResource<unknown, unknown, unknown, Resource<unknown, unknown, unknown>> &
      StaticNamespacedResource<unknown, unknown, unknown, NamespacedResource<unknown, unknown, unknown>> & {
        isNamespaced: boolean;
        kind: string | null;
        apiVersion: string | null;
        apiPlural: string | null;
        hasInlineSpec: boolean;
      },
  );
  return (klass as unknown) as StaticResource<MetadataT, SpecT, StatusT, InstanceT> & Omit<T, "apply">;
}

export function wrapNamespacedResource<
  MetadataT,
  SpecT,
  StatusT,
  InstanceT extends INamespacedResource<MetadataT, SpecT, StatusT>,
  T extends new (...args: never[]) => InstanceT = IStaticNamespacedResource<InstanceT, MetadataT, SpecT, StatusT>
>(klass: T): StaticNamespacedResource<MetadataT, SpecT, StatusT, InstanceT> & Omit<T, "apply"> {
  implementStaticMethods(
    (klass as unknown) as typeof Resource &
      StaticResource<unknown, unknown, unknown, Resource<unknown, unknown, unknown>> &
      StaticNamespacedResource<unknown, unknown, unknown, NamespacedResource<unknown, unknown, unknown>> & {
        isNamespaced: boolean;
        kind: string | null;
        apiVersion: string | null;
        apiPlural: string | null;
        hasInlineSpec: boolean;
      },
  );
  return (klass as unknown) as StaticNamespacedResource<MetadataT, SpecT, StatusT, InstanceT> & Omit<T, "apply">;
}
