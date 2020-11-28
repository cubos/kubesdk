import { CreatableMetadata, INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { PersistentVolumeSpec } from "../core/PersistentVolume";
import { PodTemplateSpec } from "../core/Pod";
import { LabelSelector } from "../core/types";

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

export interface StatefulSet extends INamespacedResource<StatefulSetMetadata, StatefulSetSpec, StatefulSetStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const StatefulSet = wrapNamespacedResource<
  StatefulSetMetadata,
  StatefulSetSpec,
  StatefulSetStatus,
  StatefulSet,
  "StatefulSet",
  "apps/v1"
>(
  // eslint-disable-next-line no-shadow
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
