/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClusterConnection } from "./ClusterConnection";
import { KubernetesError } from "./KubernetesError";
import type { ListSelector } from "./ResourceList";
import { AsyncResourceList } from "./ResourceList";
import { ResourceWatch } from "./ResourceWatch";
import { has, sleep, throwError } from "../utils";

export interface CreatableMetadata {
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: Array<{
    apiVersion: string;
    blockOwnerDeletion?: boolean;
    controller?: boolean;
    kind: string;
    name: string;
    uid: string;
  }>;
}

export interface ExtraMetadata {
  readonly uid: string;
  readonly resourceVersion: string;
  readonly creationTimestamp: string;
  readonly deletionTimestamp?: string;
  readonly generation?: number;
  finalizers?: string[];
}

export interface BasicResourceSpec {
  finalizers?: string[];
}

export interface IResource<MetadataT, SpecT, StatusT> {
  metadata: CreatableMetadata & ExtraMetadata & MetadataT;
  spec: SpecT & BasicResourceSpec;
  status: StatusT;
  delete(options?: { wait?: boolean }): Promise<void>;
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

export type INamespacedResource<MetadataT, SpecT, StatusT> = IResource<
  MetadataT & { namespace: string },
  SpecT,
  StatusT
>;

export type IStaticNamespacedResource<InstanceT, MetadataT, SpecT, StatusT> = IStaticResource<
  InstanceT,
  MetadataT & { namespace: string },
  SpecT,
  StatusT
>;

export interface StaticResource<
  MetadataT,
  SpecT,
  StatusT,
  T extends IResource<MetadataT, SpecT, StatusT>,
  KindT extends string,
  ApiVersionT extends string,
> {
  kind: KindT;
  apiVersion: ApiVersionT;
  isNamespaced: false;
  fromRawObject(raw: object): T;
  get(name: string): Promise<T>;
  getIfExists(name: string): Promise<T | null>;
  watch(name: string, options?: { lastSeemResourceVersion?: string }): ResourceWatch<T>;
  delete(name: string, options?: { wait?: boolean }): Promise<void>;
  list(options?: {
    selector?: ListSelector<KindT, false>;
    pageSize?: number;
    resourceVersion?: string;
  }): AsyncResourceList<T>;
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
  export: {} extends SpecT
    ? (metadata: CreatableMetadata & MetadataT, spec?: SpecT) => any
    : (metadata: CreatableMetadata & MetadataT, spec: SpecT) => any;
}

export interface StaticNamespacedResource<
  MetadataT,
  SpecT,
  StatusT,
  T extends INamespacedResource<MetadataT, SpecT, StatusT>,
  KindT extends string,
  ApiVersionT extends string,
> {
  kind: KindT;
  apiVersion: ApiVersionT;
  isNamespaced: true;
  fromRawObject(raw: object): T;
  get(namespace: string, name: string): Promise<T>;
  getIfExists(namespace: string, name: string): Promise<T | null>;
  watch(namespace: string, name: string, options?: { lastSeemResourceVersion?: string }): ResourceWatch<T>;
  delete(namespace: string, name: string, options?: { wait?: boolean }): Promise<void>;
  list(options?: {
    namespace?: string;
    selector?: ListSelector<KindT, true>;
    pageSize?: number;
    resourceVersion?: string;
  }): AsyncResourceList<T>;
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
  export: {} extends SpecT
    ? (metadata: CreatableMetadata & MetadataT & { namespace: string }, spec?: SpecT) => any
    : (metadata: CreatableMetadata & MetadataT & { namespace: string }, spec: SpecT) => any;
}
export class Resource<MetadataT, SpecT, StatusT, KindT extends string, ApiVersionT extends string>
  implements IResource<MetadataT, SpecT, StatusT>
{
  constructor(
    public metadata: CreatableMetadata & ExtraMetadata & MetadataT,
    public spec: SpecT & BasicResourceSpec,
    public status: StatusT,
  ) {}

  protected static isNamespaced = false;

  static kind: string | null = null;

  static apiVersion: string | null = null;

  protected static apiPlural: string | null = null;

  protected static hasInlineSpec = false;

  protected get selfLink(): string {
    const base = this.base.apiVersion.includes("/") ? `apis` : "api";

    return `/${base}/${this.base.apiVersion}/${this.base.apiPlural}/${this.metadata.name}`;
  }

  private get base(): typeof Resource &
    StaticResource<
      MetadataT,
      SpecT,
      StatusT,
      Resource<MetadataT, SpecT, StatusT, KindT, ApiVersionT>,
      KindT,
      ApiVersionT
    > {
    return this.constructor as typeof Resource &
      StaticResource<
        MetadataT,
        SpecT,
        StatusT,
        Resource<MetadataT, SpecT, StatusT, KindT, ApiVersionT>,
        KindT,
        ApiVersionT
      >;
  }

  async delete(options?: { wait?: boolean }) {
    const conn = ClusterConnection.current();

    await conn.delete(this.selfLink, {
      preconditions: {
        resourceVersion: this.metadata.resourceVersion,
        uid: this.metadata.uid,
      },
    });

    if (options?.wait !== false) {
      for await (const event of this.watch()) {
        if (event === "DELETED") {
          break;
        }
      }
    }
  }

  async reload() {
    const conn = ClusterConnection.current();
    const raw = await conn.get(this.selfLink);
    const obj = this.base.fromRawObject(raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  toJSON() {
    const kind =
      (this.base.kind as string | null) ?? throwError(new Error(`Please specify 'kind' for ${this.base.name}`));
    const apiVersion =
      (this.base.apiVersion as string | null) ??
      throwError(new Error(`Please specify 'apiVersion' for ${this.base.name}`));

    return {
      apiVersion,
      kind,
      metadata: this.metadata,
      status: this.status,
      ...(this.base.hasInlineSpec ? this.spec : { spec: this.spec }),
    };
  }

  async save() {
    const conn = ClusterConnection.current();
    const raw = await conn.put(this.selfLink, this.toJSON());
    const obj = this.base.fromRawObject(raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async saveStatus() {
    const conn = ClusterConnection.current();
    const raw = await conn.put(`${this.selfLink}/status`, this.toJSON());
    const obj = this.base.fromRawObject(raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async *watch() {
    for await (const event of this.base.watch(this.metadata.name, {
      lastSeemResourceVersion: this.metadata.resourceVersion,
    })) {
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

export class NamespacedResource<
  MetadataT,
  SpecT,
  StatusT,
  KindT extends string,
  ApiVersionT extends string,
> extends Resource<MetadataT & { namespace: string }, SpecT, StatusT, KindT, ApiVersionT> {
  protected static isNamespaced = true;

  private get nsbase() {
    return this.constructor as typeof NamespacedResource &
      StaticNamespacedResource<
        MetadataT & { namespace: string },
        SpecT,
        StatusT,
        Resource<MetadataT & { namespace: string }, SpecT, StatusT, KindT, ApiVersionT>,
        KindT,
        ApiVersionT
      >;
  }

  protected get selfLink(): string {
    const base = this.nsbase.apiVersion.includes("/") ? `apis` : "api";

    return `/${base}/${this.nsbase.apiVersion}/namespaces/${this.metadata.namespace}/${this.nsbase.apiPlural}/${this.metadata.name}`;
  }

  async *watch() {
    for await (const event of this.nsbase.watch(this.metadata.namespace, this.metadata.name, {
      lastSeemResourceVersion: this.metadata.resourceVersion,
    })) {
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

function implementStaticMethods(
  klass: (typeof Resource &
    Omit<
      StaticResource<unknown, unknown, unknown, IResource<unknown, unknown, unknown>, string, string>,
      "isNamespaced" | "kind" | "apiVersion" | "fromRawObject"
    > &
    Omit<
      StaticNamespacedResource<
        unknown,
        unknown,
        unknown,
        INamespacedResource<unknown, unknown, unknown>,
        string,
        string
      >,
      "isNamespaced" | "kind" | "apiVersion" | "fromRawObject"
    >) & {
    isNamespaced: boolean;
    kind: string | null;
    apiVersion: string | null;
    apiPlural: string | null;
    hasInlineSpec: boolean;
    fromRawObject(obj: object): Resource<any, any, any, string, string>;
  },
) {
  const kind = klass.kind ?? throwError(new Error(`Please specify 'kind' for ${klass.name}`));
  const apiVersion = klass.apiVersion ?? throwError(new Error(`Please specify 'apiVersion' for ${klass.name}`));
  const apiPlural = klass.apiPlural ?? throwError(new Error(`Please specify 'apiPlural' for ${klass.name}`));
  const { hasInlineSpec } = klass;

  klass.fromRawObject = (obj: object) => {
    if (!has(obj, "kind") || !has(obj, "apiVersion") || !has(obj, "metadata")) {
      throw new Error(`Expected to receive an object with "kind", "apiVersion" and "metadata"`);
    }

    if (obj.kind !== kind || obj.apiVersion !== apiVersion) {
      console.log(obj);
      throw new Error(
        `Expected to receive ${apiVersion} ${kind}, but got ${obj.apiVersion as string} ${obj.kind as string}`,
      );
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

    return new klass(obj.metadata as any, spec, has(obj, "status") ? (obj.status as any) : {});
  };

  async function get(namespaceOrName: string, name?: string) {
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

    return klass.fromRawObject(raw);
  }

  klass.get = get;

  klass.getIfExists = async (namespaceOrName: string, name?: string) => {
    try {
      return await get(namespaceOrName, name);
    } catch (e) {
      if (e instanceof KubernetesError.NotFound) {
        return null;
      }

      throw e;
    }
  };

  klass.watch = (
    namespaceOrName: string,
    nameOrOptions?: string | { lastSeemResourceVersion?: string },
    maybeOptions?: { lastSeemResourceVersion?: string },
  ) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let url;
    let options;

    if (klass.isNamespaced) {
      const namespace = namespaceOrName;
      const name = nameOrOptions as string;

      options = maybeOptions as { lastSeemResourceVersion?: string } | undefined;

      if (!name) {
        throw new Error("Expected to receive resource name");
      }

      url = `/${base}/${apiVersion}/watch/namespaces/${encodeURIComponent(namespace)}/${apiPlural}/${encodeURIComponent(
        name,
      )}`;
    } else {
      options = nameOrOptions as { lastSeemResourceVersion?: string } | undefined;
      url = `/${base}/${apiVersion}/watch/${apiPlural}/${encodeURIComponent(namespaceOrName)}`;
    }

    return new ResourceWatch<typeof klass.prototype>(
      conn,
      url,
      raw => klass.fromRawObject(raw),
      options?.lastSeemResourceVersion,
    );
  };

  klass.delete = async (
    namespaceOrName: string,
    nameOrOptions?: string | { wait?: boolean },
    maybeOptions?: { wait?: boolean },
  ) => {
    let options;
    let obj;

    if (klass.isNamespaced) {
      const namespace = namespaceOrName;
      const name = nameOrOptions as string;

      options = maybeOptions as { wait?: boolean } | undefined;
      obj = await klass.get(namespace, name);
    } else {
      options = nameOrOptions as { wait?: boolean } | undefined;
      obj = await klass.get(namespaceOrName);
    }

    await obj.delete(options);
  };

  klass.list = (
    options: {
      namespace?: string;
      selector?: ListSelector<string, boolean>;
      pageSize?: number;
      resourceVersion?: string;
    } = {},
  ) => {
    return new AsyncResourceList<typeof klass.prototype>(
      {
        kind,
        apiPlural,
        apiVersion,
        hasInlineSpec,
        isNamespaced: klass.isNamespaced,
        fromRawObject: klass.fromRawObject,
      },
      options.namespace,
      options.selector,
      options.pageSize,
      options.resourceVersion,
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

    // Kubernetes responds the POST request before the resource is actually accessible with a GET.
    // An user could create and then try to get and end up receiving a NotFound error.
    const copy = klass.fromRawObject(raw);

    for (let i = 0; i < 20; ++i) {
      try {
        await copy.reload();
        break;
      } catch (e) {
        if (e instanceof KubernetesError.NotFound) {
          await sleep(100);
          continue;
        }

        break;
      }
    }

    return klass.fromRawObject(raw);
  };

  (klass as StaticResource<unknown, unknown, unknown, IResource<unknown, unknown, unknown>, string, string>).apply =
    async (metadata: CreatableMetadata & { namespace?: string }, spec: unknown) => {
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

      return klass.fromRawObject(raw);
    };

  klass.export = (metadata: CreatableMetadata & { namespace?: string }, spec: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      apiVersion,
      kind,
      metadata,
      ...(hasInlineSpec ? (spec as any) ?? {} : { spec: spec ?? {} }),
    };
  };
}

export function wrapResource<
  MetadataT,
  SpecT,
  StatusT,
  InstanceT extends IResource<MetadataT, SpecT, StatusT>,
  KindT extends string,
  ApiVersionT extends string,
  T extends new (...args: never[]) => InstanceT = IStaticResource<InstanceT, MetadataT, SpecT, StatusT>,
>(klass: T): StaticResource<MetadataT, SpecT, StatusT, InstanceT, KindT, ApiVersionT> & T {
  implementStaticMethods(
    klass as unknown as typeof Resource &
      StaticResource<unknown, unknown, unknown, Resource<unknown, unknown, unknown, string, string>, string, string> &
      StaticNamespacedResource<
        unknown,
        unknown,
        unknown,
        NamespacedResource<unknown, unknown, unknown, string, string>,
        string,
        string
      > & {
        isNamespaced: boolean;
        kind: string | null;
        apiVersion: string | null;
        apiPlural: string | null;
        hasInlineSpec: boolean;
      },
  );
  return klass as unknown as StaticResource<MetadataT, SpecT, StatusT, InstanceT, KindT, ApiVersionT> & T;
}

export function wrapNamespacedResource<
  MetadataT,
  SpecT,
  StatusT,
  InstanceT extends INamespacedResource<MetadataT, SpecT, StatusT>,
  KindT extends string,
  ApiVersionT extends string,
  T extends new (...args: never[]) => InstanceT = IStaticNamespacedResource<InstanceT, MetadataT, SpecT, StatusT>,
>(klass: T): StaticNamespacedResource<MetadataT, SpecT, StatusT, InstanceT, KindT, ApiVersionT> & T {
  implementStaticMethods(
    klass as unknown as typeof Resource &
      StaticResource<unknown, unknown, unknown, Resource<unknown, unknown, unknown, string, string>, string, string> &
      StaticNamespacedResource<
        unknown,
        unknown,
        unknown,
        NamespacedResource<unknown, unknown, unknown, string, string>,
        string,
        string
      > & {
        isNamespaced: boolean;
        kind: string | null;
        apiVersion: string | null;
        apiPlural: string | null;
        hasInlineSpec: boolean;
      },
  );
  return klass as unknown as StaticNamespacedResource<MetadataT, SpecT, StatusT, InstanceT, KindT, ApiVersionT> & T;
}
