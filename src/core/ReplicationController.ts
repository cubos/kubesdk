import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { PodTemplateSpec } from "./Pod";
import { Condition } from "./types";

export interface ReplicationControllerMetadata {}

export interface ReplicationControllerSpec {
  minReadySeconds?: number;
  replicas: number;
  selector: Record<string, string>;
  template: PodTemplateSpec;
}

export interface ReplicationControllerStatus {
  availableReplicas?: number;
  conditions?: Array<Condition<"ReplicaFailure">>;
  fullyLabeledReplicas?: number;
  observedGeneration?: number;
  readyReplicas?: number;
  replicas: number;
}

interface ReplicationController
  extends INamespacedResource<ReplicationControllerMetadata, ReplicationControllerSpec, ReplicationControllerStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ReplicationController = wrapNamespacedResource<
  ReplicationControllerMetadata,
  ReplicationControllerSpec,
  ReplicationControllerStatus,
  ReplicationController,
  "ReplicationController",
  "v1"
>(
  // eslint-disable-next-line no-shadow
  class ReplicationController extends NamespacedResource<
    ReplicationControllerMetadata,
    ReplicationControllerSpec,
    ReplicationControllerStatus,
    "ReplicationController",
    "v1"
  > {
    static kind = "ReplicationController";

    protected static apiPlural = "replicationcontrollers";

    static apiVersion = "v1";
  },
);
