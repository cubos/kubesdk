import type { CreatableMetadata, INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { PersistentVolumeSpec } from "../core/PersistentVolume";
import type { PodTemplateSpec } from "../core/Pod";
import type { LabelSelector } from "../core/types";

export interface StatefulSetMetadata {}

export interface StatefulSetSpec {
  podManagementPolicy?: "OrderedReady" | "Parallel";
  replicas?: number;
  revisionHistoryLimit?: number;
  selector: LabelSelector;
  serviceName: string;
  template: PodTemplateSpec;
  updateStrategy?:
    | {
        type: "OnDelete";
      }
    | {
        type?: "RollingUpdate";
        rollingUpdate?: {
          partition: number;
        };
      };
  volumeClaimTemplates?: Array<{
    metadata: CreatableMetadata;
    spec: PersistentVolumeSpec;
  }>;
}

export interface StatefulSetStatus {
  collisionCount?: number;
  conditions?: [];
  currentReplicas?: number;
  currentRevision?: number;
  observedGeneration?: number;
  readyReplicas?: number;
  replicas: number;
  updateRevision?: string;
  updatedReplicas?: number;
}

export type StatefulSet = INamespacedResource<StatefulSetMetadata, StatefulSetSpec, StatefulSetStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const StatefulSet = wrapNamespacedResource<
  StatefulSetMetadata,
  StatefulSetSpec,
  StatefulSetStatus,
  StatefulSet,
  "StatefulSet",
  "apps/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class StatefulSet extends NamespacedResource<
    StatefulSetMetadata,
    StatefulSetSpec,
    StatefulSetStatus,
    "StatefulSet",
    "apps/v1"
  > {
    static kind = "StatefulSet";

    protected static apiPlural = "statefulsets";

    static apiVersion = "apps/v1";
  },
);
