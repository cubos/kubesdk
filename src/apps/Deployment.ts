import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { PodTemplateSpec } from "../core/Pod";
import { Condition, LabelSelector } from "../core/types";

export interface DeploymentMetadata {}

export interface DeploymentSpec {
  minReadySeconds?: number;
  paused?: boolean;
  progressDeadlineSeconds?: number;
  replicas?: number;
  revisionHistoryLimit?: number;
  selector: LabelSelector;
  strategy?:
    | {
        type: "Recreate";
      }
    | {
        type?: "RollingUpdate";
        rollingUpdate?: {
          maxSurge: string | number;
          maxUnavailable: string | number;
        };
      };
  template: PodTemplateSpec & { metadata: { labels: Record<string, string> } };
}

export interface DeploymentStatus {
  availableReplicas?: number;
  collisionCount?: number;
  conditions?: Array<Condition<"Available" | "Progressing" | "ReplicaFailure">>;
  observedGeneration?: number;
  readyReplicas?: number;
  replicas?: number;
  unavailableReplicas?: number;
  updatedReplicas?: number;
}

export interface Deployment extends INamespacedResource<DeploymentMetadata, DeploymentSpec, DeploymentStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Deployment = wrapNamespacedResource<
  DeploymentMetadata,
  DeploymentSpec,
  DeploymentStatus,
  Deployment,
  "Deployment",
  "apps/v1"
>(
  // eslint-disable-next-line no-shadow
  class Deployment extends NamespacedResource<
    DeploymentMetadata,
    DeploymentSpec,
    DeploymentStatus,
    "Deployment",
    "apps/v1"
  > {
    static kind = "Deployment";

    protected static apiPlural = "deployments";

    static apiVersion = "apps/v1";
  },
);
