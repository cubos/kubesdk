import * as QueryString from "querystring";
import { LabelSelector } from "../core/types";
import { validate, _throw } from "../utils";
import { ClusterConnection } from "./ClusterConnection";

export interface BasicResourceMetadata {
  name: string;
  selfLink: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  finalizers?: string[];
}

export interface BasicResourceSpec {
  finalizers?: string[];
}

export class Resource<MetadataT, SpecT, StatusT> {
  constructor(
    public metadata: BasicResourceMetadata & MetadataT,
    public spec: SpecT & BasicResourceSpec,
    public status: StatusT
  ) {}

  static isNamespaced = false;
  static kind: string | null = null;
  static apiVersion: string | null = null;
  static apiPlural: string | null = null;
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
  static isNamespaced = true;
}

interface StaticResource<T> {
  get(name: string): Promise<T>;
  list(options?: { selector?: Selector; limit?: number }): Promise<T[]>;
}

interface StaticNamespacedResource<T> {
  get(namespace: string, name: string): Promise<T>;
  list(options?: {
    namespace?: string;
    selector?: Selector;
    limit?: number;
  }): Promise<T[]>;
}

function implementStaticMethods(
  klass: typeof Resource &
    StaticResource<Resource<any, any, any>> &
    StaticNamespacedResource<Resource<any, any, any>>
) {
  const kind =
    klass.kind ?? _throw(new Error(`Please specify 'kind' for ${klass.name}`));
  const apiVersion =
    klass.apiVersion ??
    _throw(new Error(`Please specify 'apiVersion' for ${klass.name}`));
  const apiPlural =
    klass.apiPlural ??
    _throw(new Error(`Please specify 'apiPlural' for ${klass.name}`));

  async function parseObject(conn: ClusterConnection, obj: any) {
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

  klass.get = async (namespaceOrName: string, name?: string) => {
    const conn = ClusterConnection.current();
    const base = apiVersion.includes("/") ? `apis` : "api";
    let obj;
    if (klass.isNamespaced) {
      const namespace = namespaceOrName;
      if (!name) {
        throw new Error("Expected to receive resource name");
      }
      obj = await conn.get(
        `/${base}/${apiVersion}/namespaces/${encodeURIComponent(
          namespace
        )}/${apiPlural}/${encodeURIComponent(name)}`
      );
    } else {
      name = namespaceOrName;
      obj = await conn.get(
        `/${base}/${apiVersion}/${apiPlural}/${encodeURIComponent(name)}`
      );
    }
    return await parseObject(conn, obj);
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
              throw new Error("TODO");
            case "In":
              labelSelector.push(
                `${expression.key} in (${expression.values.join(", ")})`
              );
              break;
            case "NotIn":
              labelSelector.push(
                `${expression.key} notin (${expression.values.join(", ")})`
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
      list.items.map((obj) =>
        parseObject(conn, {
          kind: innerKind,
          apiVersion: list.apiVersion,
          ...obj,
        })
      )
    );
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
>(klass: T) {
  implementStaticMethods(klass as any);
  return klass as StaticResource<InstanceT> & T;
}

export function wrapNamespacedResource<
  MetadataT extends object,
  SpecT,
  StatusT,
  InstanceT extends NamespacedResource<MetadataT, SpecT, StatusT>,
  T extends {
    new (...args: any[]): InstanceT;
  }
>(klass: T) {
  implementStaticMethods(klass as any);
  return klass as StaticNamespacedResource<InstanceT> & T;
}
