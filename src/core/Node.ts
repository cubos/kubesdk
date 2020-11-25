import { IResource, Resource, wrapResource } from "../base/Resource";

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

interface Resources {
  cpu: string;
  "ephemeral-storage": string;
  "hugepages-1Gi": string;
  "hugepages-2Mi": string;
  memory: string;
  pods: string;
}

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

interface Node extends IResource<NodeMetadata, NodeSpec, NodeStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Node = wrapResource<NodeMetadata, NodeSpec, NodeStatus, Node, "Node", "v1">(
  // eslint-disable-next-line no-shadow
  class Node extends Resource<NodeMetadata, NodeSpec, NodeStatus, "Node", "v1"> {
    static kind = "Node";

    protected static apiPlural = "nodes";

    static apiVersion = "v1";
  },
);
