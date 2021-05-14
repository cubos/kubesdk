/* eslint-disable @typescript-eslint/no-explicit-any */
import * as QueryString from "querystring";

import type { LabelSelector } from "../core/types";
import { has, sleep, throwError } from "../utils";
import { ClusterConnection } from "./ClusterConnection";
import { ResourceListWatch } from "./ResourceListWatch";
import { ResourceWatch } from "./ResourceWatch";

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
  delete(): Promise<this>;
  reload(): Promise<void>;
  save(): Promise<void>;
  saveStatus(): Promise<void>;
  watch(): AsyncGenerator<"DELETED" | "ADDED" | "MODIFIED">;
}

type SelectableFields<KindT, IsNamespaced extends boolean> = KindT extends "Event"
  ?
      | "involvedObject.kind"
      | "involvedObject.namespace"
      | "involvedObject.name"
      | "involvedObject.uid"
      | "involvedObject.apiVersion"
      | "involvedObject.resourceVersion"
      | "involvedObject.fieldPath"
      | "reason"
      | "reportingComponent"
      | "source"
      | "type"
      | "metadata.namespace"
      | "metadata.name"
  : KindT extends "Namespace"
  ? "status.phase" | "metadata.name"
  : KindT extends "Secret"
  ? "metadata.namespace" | "metadata.name"
  : KindT extends "Node"
  ? "metadata.name" | "spec.unschedulable"
  : KindT extends "ReplicationController"
  ? "metadata.name" | "metadata.namespace" | "status.replicas"
  : KindT extends "Pod"
  ?
      | "metadata.name"
      | "metadata.namespace"
      | "spec.nodeName"
      | "spec.restartPolicy"
      | "spec.schedulerName"
      | "spec.serviceAccountName"
      | "status.phase"
      | "status.podIP"
      | "status.podIPs"
      | "status.nominatedNodeName"
  : KindT extends "Job"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : KindT extends "CronJob"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : KindT extends "CertificateSigningRequest"
  ? "metadata.name" | "spec.signerName"
  : KindT extends "StatefulSet"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : IsNamespaced extends true
  ? "metadata.name" | "metadata.namespace"
  : "metadata.name";
export interface IStaticResource<InstanceT, MetadataT, SpecT, StatusT> {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new (
    metadata: CreatableMetadata & ExtraMetadata & MetadataT,
    spec: SpecT & BasicResourceSpec,
    status: StatusT,
  ): InstanceT;
}

type Selector<KindT, IsNamespaced extends boolean> = LabelSelector & {
  matchFields?: Record<SelectableFields<KindT, IsNamespaced>, string>;
  doesntMatchFields?: Record<SelectableFields<KindT, IsNamespaced>, string>;
};

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
  get(name: string): Promise<T>;
  watch(name: string): ResourceWatch<T>;
  delete(name: string): Promise<void>;
  list(options?: { selector?: Selector<KindT, false>; limit?: number }): Promise<T[]>;
  watchList(options?: { selector?: Selector<KindT, false> }): ResourceListWatch<T>;
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
  get(namespace: string, name: string): Promise<T>;
  watch(namespace: string, name: string): ResourceWatch<T>;
  delete(namespace: string, name: string): Promise<void>;
  list(options?: { namespace?: string; selector?: Selector<KindT, true>; limit?: number }): Promise<T[]>;
  watchList(options?: { namespace?: string; selector?: Selector<KindT, true> }): ResourceListWatch<T>;
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

  private static parseRawObject: (
    conn: ClusterConnection,
    obj: unknown,
  ) => Resource<unknown, unknown, unknown, string, string>;

  protected parseRawObject(conn: ClusterConnection, obj: unknown): this {
    return this.base.parseRawObject(conn, obj) as this;
  }

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

  async delete() {
    const conn = ClusterConnection.current();
    const raw = await conn.delete(this.selfLink, {
      preconditions: {
        resourceVersion: this.metadata.resourceVersion,
        uid: this.metadata.uid,
      },
    });

    return this.parseRawObject(conn, raw);
  }

  async reload() {
    const conn = ClusterConnection.current();
    const raw = await conn.get(this.selfLink);
    const obj = this.parseRawObject(conn, raw);

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
    const obj = this.parseRawObject(conn, raw);

    this.metadata = obj.metadata;
    this.spec = obj.spec;
    this.status = obj.status;
  }

  async saveStatus() {
    const conn = ClusterConnection.current();
    const raw = await conn.put(`${this.selfLink}/status`, this.toJSON());
    const obj = this.parseRawObject(conn, raw);

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

function implementStaticMethods(
  klass: (typeof Resource &
    Omit<
      StaticResource<unknown, unknown, unknown, IResource<unknown, unknown, unknown>, string, string>,
      "isNamespaced" | "kind" | "apiVersion"
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
      "isNamespaced" | "kind" | "apiVersion"
    >) & {
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

  function parseRawObject(conn: ClusterConnection, obj: object) {
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
  }

  (klass as unknown as Record<string, unknown>).parseRawObject = parseRawObject;

  function selectorToQueryObject(selector?: Selector<string, boolean>) {
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

    return new ResourceWatch<typeof klass.prototype>(conn, url, raw => parseRawObject(conn, raw));
  };

  klass.watchList = (
    options: {
      namespace?: string;
      selector?: Selector<string, boolean>;
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

    return new ResourceListWatch<typeof klass.prototype>(conn, url, raw => parseRawObject(conn, raw));
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

    await conn.delete(url);
  };

  klass.list = async (
    options: {
      namespace?: string;
      selector?: Selector<string, boolean>;
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

    return list.items.map(raw =>
      parseRawObject(conn, {
        kind: innerKind,
        apiVersion: list.apiVersion,
        ...raw,
      }),
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

    // Kubernetes responds the POST request before the resource is really accessible with a GET.
    // An use could create and then access and receive a NotFound error. This sleep prevents that.
    // TODO: Find a better way to do that without this sleep.
    await sleep(50);

    return parseRawObject(conn, raw);
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

      return parseRawObject(conn, raw);
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
