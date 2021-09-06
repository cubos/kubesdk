import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";

export interface StorageClassMetadata {}

export interface StorageClassSpec {
  allowVolumeExpansion?: boolean;
  allowedTopologies?: Array<{
    matchLabelExpressions: Array<{
      key: string;
      values: string[];
    }>;
  }>;
  mountOptions?: string[];
  reclaimPolicy?: "Retain" | "Delete";
  provisioner: string;
  parameters?: Record<string, string>;
  volumeBindingMode?: "WaitForFirstConsumer" | "Immediate";
}

export interface StorageClassStatus {}

export type StorageClass = IResource<StorageClassMetadata, StorageClassSpec, StorageClassStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const StorageClass = wrapResource<
  StorageClassMetadata,
  StorageClassSpec,
  StorageClassStatus,
  StorageClass,
  "StorageClass",
  "storage.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class StorageClass extends Resource<
    StorageClassMetadata,
    StorageClassSpec,
    StorageClassStatus,
    "StorageClass",
    "storage.k8s.io/v1"
  > {
    static kind = "StorageClass";

    protected static apiPlural = "storageclasses";

    static apiVersion = "storage.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
