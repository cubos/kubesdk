import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface VolumeSnapshotMetadata {}

export interface VolumeSnapshotSpec {
  source:
    | {
        persistentVolumeClaimName: string;
      }
    | {
        volumeSnapshotContentName: string;
      };
  volumeSnapshotClassName?: string;
}

export interface VolumeSnapshotStatus {
  boundVolumeSnapshotContentName?: string;
  creationTime?: string;
  error?: {
    message: string;
    time: string;
  };
  readyToUse?: boolean;
  restoreSize?: string | number;
}

export type VolumeSnapshot = INamespacedResource<VolumeSnapshotMetadata, VolumeSnapshotSpec, VolumeSnapshotStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const VolumeSnapshot = wrapNamespacedResource<
  VolumeSnapshotMetadata,
  VolumeSnapshotSpec,
  VolumeSnapshotStatus,
  VolumeSnapshot,
  "VolumeSnapshot",
  "snapshot.storage.k8s.io/v1beta1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class VolumeSnapshot extends NamespacedResource<
    VolumeSnapshotMetadata,
    VolumeSnapshotSpec,
    VolumeSnapshotStatus,
    "VolumeSnapshot",
    "snapshot.storage.k8s.io/v1beta1"
  > {
    static kind = "VolumeSnapshot";

    protected static apiPlural = "volumesnapshots";

    static apiVersion = "snapshot.storage.k8s.io/v1beta1";
  },
);
