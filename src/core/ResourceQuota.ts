import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface ResourceQuotaMetadata {}

export interface ResourceQuotaSpec {
  hard: Record<string, string>;
  scopeSelector?: {
    matchExpressions: Array<
      | {
          operator: "Exists" | "DoesNotExist";
          scopeName: "Terminating" | "NotTerminating" | "BestEffort" | "NotBestEffort";
        }
      | {
          operator: "In" | "NotIn";
          scopeName: "PriorityClass";
          values: string[];
        }
    >;
  };
  scopes?: Array<"Terminating" | "NotTerminating" | "BestEffort" | "NotBestEffort">;
}

export interface ResourceQuotaStatus {
  hard: Record<string, string>;
  used: Record<string, string>;
}

interface ResourceQuota extends INamespacedResource<ResourceQuotaMetadata, ResourceQuotaSpec, ResourceQuotaStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ResourceQuota = wrapNamespacedResource<
  ResourceQuotaMetadata,
  ResourceQuotaSpec,
  ResourceQuotaStatus,
  ResourceQuota,
  "ResourceQuota",
  "v1"
>(
  // eslint-disable-next-line no-shadow
  class ResourceQuota extends NamespacedResource<
    ResourceQuotaMetadata,
    ResourceQuotaSpec,
    ResourceQuotaStatus,
    "ResourceQuota",
    "v1"
  > {
    static kind = "ResourceQuota";

    protected static apiPlural = "resourcequotas";

    static apiVersion = "v1";
  },
);
