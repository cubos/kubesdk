import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";

export interface NodeMetadata {}

interface NodeConfigSource {
  configMap: {
    kubeletConfigKey: string;
    name: string;
    namespace: string;
    resourceVersion?: string;
    uid?: string;
  };
}

export interface NodeSpec {
  configSource?: NodeConfigSource;
  podCIDR?: string;
  podCIDRs?: string[];
  providerID?: string;
  taints?: Array<{
    effect: "NoSchedule" | "PreferNoSchedule" | "NoExecute";
    key: string;
    timeAdded?: string;
    value?: string;
  }>;
  unschedulable?: boolean;
}

type Resources =
  | {
      cpu: string;
      "ephemeral-storage": string;
      memory: string;
      pods: string;
    }
  | Record<`hugepages-${number}${"Gi" | "Mi"}`, string>;

export interface NodeStatus {
  addresses?: Array<{
    address: string;
    type: "Hostname" | "ExternalIP" | "InternalIP" | "ExternalDNS" | "InternalDNS";
  }>;
  allocatable?: Resources;
  capacity?: Resources;
  conditions?: Array<{
    lastHeartbeatTime?: string;
    lastTransitionTime?: string;
    message?: string;
    reason?: string;
    status: "True" | "False" | "Unknown";
    type: "Ready" | "MemoryPressure" | "DiskPressure" | "PIDPressure" | "NetworkUnavailable";
  }>;
  config?: {
    active?: NodeConfigSource;
    assigned?: NodeConfigSource;
    error?: string;
    lastKnownGood?: NodeConfigSource;
  };
  daemonEndpoints: {
    kubeletEndpoint: {
      Port: number;
    };
  };
  images?: Array<{
    names: string[];
    sizeBytes?: number;
  }>;
  nodeInfo: {
    architecture: string;
    bootID: string;
    containerRuntimeVersion: string;
    kernelVersion: string;
    kubeProxyVersion: string;
    kubeletVersion: string;
    machineID: string;
    operatingSystem: string;
    osImage: string;
    systemUUID: string;
  };
  phase?: "Pending" | "Running" | "Terminated";
  volumesAttached?: Array<{
    devicePath: string;
    name: string;
  }>;
  volumesInUse?: string[];
}

export type Node = IResource<NodeMetadata, NodeSpec, NodeStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Node = wrapResource<NodeMetadata, NodeSpec, NodeStatus, Node, "Node", "v1">(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Node extends Resource<NodeMetadata, NodeSpec, NodeStatus, "Node", "v1"> {
    static kind = "Node";

    protected static apiPlural = "nodes";

    static apiVersion = "v1";
  },
);
