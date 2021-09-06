import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";

export interface VolumeSnapshotClassMetadata {}

export interface VolumeSnapshotClassSpec {
  deletionPolicy: "Retain" | "Delete";
  driver: string;
  parameters?: Record<string, string>;
}

export interface VolumeSnapshotClassStatus {}

export type VolumeSnapshotClass = IResource<
  VolumeSnapshotClassMetadata,
  VolumeSnapshotClassSpec,
  VolumeSnapshotClassStatus
>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const VolumeSnapshotClass = wrapResource<
  VolumeSnapshotClassMetadata,
  VolumeSnapshotClassSpec,
  VolumeSnapshotClassStatus,
  VolumeSnapshotClass,
  "VolumeSnapshotClass",
  "snapshot.storage.k8s.io/v1beta1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class VolumeSnapshotClass extends Resource<
    VolumeSnapshotClassMetadata,
    VolumeSnapshotClassSpec,
    VolumeSnapshotClassStatus,
    "VolumeSnapshotClass",
    "snapshot.storage.k8s.io/v1beta1"
  > {
    static kind = "VolumeSnapshotClass";

    protected static apiPlural = "volumesnapshotclasses";

    static apiVersion = "snapshot.storage.k8s.io/v1beta1";

    protected static hasInlineSpec = true;
  },
);
