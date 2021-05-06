import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface VolumeSnapshotContentMetadata {}

export interface VolumeSnapshotContentSpec {
  deletionPolicy: "Delete" | "Retain";
  driver: string;
  source:
    | {
        snapshotHandle: "string";
      }
    | {
        volumeHandle: "string";
      };
  volumeSnapshotClassName?: string;
  volumeSnapshotRef: {
    apiVersion: string;
    fieldPath: string;
    kind: string;
    name: string;
    namespace: string;
    resourceVersion: string;
    uid: string;
  };
}

export interface VolumeSnapshotContentStatus {
  creationTime?: number;
  error?: {
    message: string;
    time: string;
  };
  readyToUse?: boolean;
  restoreSize?: number;
  snapshotHandle?: string;
}

export type VolumeSnapshotContent = INamespacedResource<
  VolumeSnapshotContentMetadata,
  VolumeSnapshotContentSpec,
  VolumeSnapshotContentStatus
>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const VolumeSnapshotContent = wrapNamespacedResource<
  VolumeSnapshotContentMetadata,
  VolumeSnapshotContentSpec,
  VolumeSnapshotContentStatus,
  VolumeSnapshotContent,
  "VolumeSnapshotContent",
  "snapshot.storage.k8s.io/v1beta1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class VolumeSnapshotContent extends NamespacedResource<
    VolumeSnapshotContentMetadata,
    VolumeSnapshotContentSpec,
    VolumeSnapshotContentStatus,
    "VolumeSnapshotContent",
    "snapshot.storage.k8s.io/v1beta1"
  > {
    static kind = "VolumeSnapshotContent";

    protected static apiPlural = "VolumeSnapshotContents";

    static apiVersion = "snapshot.storage.k8s.io/v1beta1";
  },
);
