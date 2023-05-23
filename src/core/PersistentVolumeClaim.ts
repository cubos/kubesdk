import type { Condition, LabelSelector, TypedLocalObjectReference } from "./types";
import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface PersistentVolumeClaimMetadata {}

export interface PersistentVolumeClaimSpec {
  accessModes: Array<"ReadWriteOnce" | "ReadOnlyMany" | "ReadWriteMany">;
  dataSource?: TypedLocalObjectReference<"VolumeSnapshot", "snapshot.storage.k8s.io">;
  resources: {
    requests: {
      storage: string;
    };
  };
  selector?: LabelSelector;
  storageClassName?: string;
  volumeMode?: "Block" | "Filesystem";
  volumeName?: string;
}

export interface PersistentVolumeClaimStatus {
  accessModes: Array<"ReadWriteOnce" | "ReadOnlyMany" | "ReadWriteMany">;
  capacity: {
    storage: string;
  };
  conditions?: Array<Condition<"Resizing" | "FileSystemResizePending">>;
  phase: "Pending" | "Bound" | "Lost";
}

export type PersistentVolumeClaim = INamespacedResource<
  PersistentVolumeClaimMetadata,
  PersistentVolumeClaimSpec,
  PersistentVolumeClaimStatus
>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const PersistentVolumeClaim = wrapNamespacedResource<
  PersistentVolumeClaimMetadata,
  PersistentVolumeClaimSpec,
  PersistentVolumeClaimStatus,
  PersistentVolumeClaim,
  "PersistentVolumeClaim",
  "v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class PersistentVolumeClaim extends NamespacedResource<
    PersistentVolumeClaimMetadata,
    PersistentVolumeClaimSpec,
    PersistentVolumeClaimStatus,
    "PersistentVolumeClaim",
    "v1"
  > {
    static kind = "PersistentVolumeClaim";

    protected static apiPlural = "persistentvolumeclaims";

    static apiVersion = "v1";
  },
);
