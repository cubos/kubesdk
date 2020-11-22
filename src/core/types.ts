export interface LabelSelector {
  matchExpressions?: Array<
    | {
        key: string;
        operator: "In" | "NotIn";
        values: string[];
      }
    | {
        key: string;
        operator: "Exists" | "DoesNotExist";
      }
  >;
  matchLabels?: Record<string, string>;
}

export interface SecretReference {
  name: string;
  namespace: string;
}

export interface LocalObjectReference {
  name: string;
}

export interface TypedLocalObjectReference<Kind extends string = string, ApiGroup extends string = string> {
  name: string;
  kind: Kind;
  apiGroup: ApiGroup;
}

export interface Condition<Type extends string> {
  lastProbeTime: string;
  lastTransitionTime: string;
  message: string;
  reason: string;
  status: "True" | "False" | "Unknown";
  type: Type;
}
export interface ObjectReference<Kind extends string = string, ApiVersion extends string = string> {
  apiVersion: ApiVersion;
  fieldPath: string;
  kind: Kind;
  name: string;
  namespace: string;
  resourceVersion: string;
  uid: string;
}

export interface ObjectFieldSelector {
  apiVersion?: string;
  fieldPath: string;
}

export interface ResourceFieldSelector {
  containerName: string;
  divisor: string;
  resource: string;
}

export type GenericVolumeSource =
  | {
      awsElasticBlockStore: {
        fsType?: string;
        partition?: number;
        readOnly?: boolean;
        volumeID: string;
      };
    }
  | {
      azureDisk: {
        cachingMode?: "None" | "ReadOnly" | "ReadWrite";
        diskName: "string";
        diskURI: "string";
        fsType?: "string";
        kind?: "Shared" | "Dedicated" | "Managed";
        readOnly?: boolean;
      };
    }
  | {
      fc: {
        fsType?: string;
        lun?: number;
        readOnly?: boolean;
        targetWWNs?: string[];
        wwids?: string[];
      };
    }
  | {
      flocker: {
        datasetName?: string;
        datasetUUID?: string;
      };
    }
  | {
      gcePersistentDisk: {
        fsType?: string;
        partition?: number;
        pdName: string;
        readOnly?: boolean;
      };
    }
  | {
      hostPath: {
        path: string;
        type?:
          | ""
          | "DirectoryOrCreate"
          | "Directory"
          | "FileOrCreate"
          | "File"
          | "Socket"
          | "CharDevice"
          | "BlockDevice";
      };
    }
  | {
      nfs: {
        path: string;
        readOnly?: boolean;
        server: string;
      };
    }
  | {
      photonPersistentDisk: {
        fsType?: string;
        pdID: string;
      };
    }
  | {
      portworxVolume: {
        fsType?: string;
        readOnly?: boolean;
        volumeID: string;
      };
    }
  | {
      quobyte: {
        group?: string;
        readOnly?: boolean;
        registry: string;
        tenant?: string;
        user?: string;
        volume: string;
      };
    }
  | {
      vsphereVolume: {
        fsType?: string;
        storagePolicyID?: string;
        storagePolicyName?: string;
        volumePath: string;
      };
    };
