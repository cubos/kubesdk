import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { GenericVolumeSource, NodeSelector, ObjectReference, SecretReference } from "./types";

export interface PersistentVolumeMetadata {}

export type PersistentVolumeSpec = GenericVolumeSource &
  (
    | {
        azureFile: {
          readOnly?: boolean;
          secretName: string;
          secretNamespace?: string;
          shareName: string;
        };
      }
    | {
        cephfs: {
          monitors: string[];
          path?: string;
          readOnly?: boolean;
          secretFile?: string;
          secretRef?: SecretReference;
          user?: string;
        };
      }
    | {
        cinder: {
          fsType?: string;
          readOnly?: boolean;
          secretRef?: SecretReference;
          volumeID: string;
        };
      }
    | {
        csi: {
          controllerExpandSecretRef?: SecretReference;
          controllerPublishSecretRef?: SecretReference;
          driver: string;
          fsType?: string;
          nodePublishSecretRef?: SecretReference;
          nodeStageSecretRef?: SecretReference;
          readOnly?: boolean;
          volumeAttributes?: Record<string, string>;
          volumeHandle: string;
        };
      }
    | {
        flexVolume: {
          driver: string;
          fsType?: string;
          options?: Record<string, string>;
          readOnly?: boolean;
          secretRef?: SecretReference;
        };
      }
    | {
        glusterfs: {
          endpoints: string;
          endpointsNamespace?: string;
          path: string;
          readOnly?: boolean;
        };
      }
    | {
        iscsi: {
          chapAuthDiscovery?: boolean;
          chapAuthSession?: boolean;
          fsType?: string;
          initiatorName?: string;
          iqn: string;
          iscsiInterface?: string;
          lun: number;
          portals?: string[];
          readOnly?: boolean;
          secretRef?: SecretReference;
          targetPortal: string;
        };
      }
    | {
        local: {
          fsType?: string;
          path: string;
        };
      }
    | {
        rbd: {
          fsType?: string;
          image: string;
          keyring?: string;
          monitors: string[];
          pool?: string;
          readOnly?: boolean;
          secretRef?: SecretReference;
          user?: string;
        };
      }
    | {
        scaleIO: {
          fsType?: string;
          gateway: string;
          protectionDomain?: string;
          readOnly?: boolean;
          secretRef: SecretReference;
          sslEnabled?: boolean;
          storageMode?: "ThickProvisioned" | "ThinProvisioned";
          storagePool?: string;
          system: string;
          volumeName?: string;
        };
      }
    | {
        storageos: {
          fsType?: string;
          readOnly?: boolean;
          secretRef?: ObjectReference<"Secret", "v1">;
          volumeName?: string;
          volumeNamespace?: string;
        };
      }
  ) & {
    capacity: string;
    claimRef?: ObjectReference<"PersistentVolumeClaim", "v1">;
    mountOptions?: string[];
    nodeAffinity?: {
      required: NodeSelector;
    };
    persistentVolumeReclaimPolicy?: "Retain" | "Delete" | "Recycle";
    storageClassName?: string;
    volumeMode?: "Filesystem" | "Block";
  };

export interface PersistentVolumeStatus {
  reason: string;
  message?: string;
  phase: "Pending" | "Available" | "Bound" | "Released" | "Failed";
}

interface PersistentVolume
  extends INamespacedResource<PersistentVolumeMetadata, PersistentVolumeSpec, PersistentVolumeStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const PersistentVolume = wrapNamespacedResource<
  PersistentVolumeMetadata,
  PersistentVolumeSpec,
  PersistentVolumeStatus,
  PersistentVolume
>(
  // eslint-disable-next-line no-shadow
  class PersistentVolume extends NamespacedResource<
    PersistentVolumeMetadata,
    PersistentVolumeSpec,
    PersistentVolumeStatus
  > {
    protected static kind = "PersistentVolume";

    protected static apiPlural = "persistentvolumes";

    protected static apiVersion = "v1";
  },
);
