import { ClusterConnection } from "../base/ClusterConnection";
import type { ExecOptions } from "../base/Exec";
import { Exec } from "../base/Exec";
import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type {
  Condition,
  GenericVolumeSource,
  LabelSelector,
  LocalObjectReference,
  NodeSelector,
  NodeSelectorTerm,
  ObjectFieldSelector,
  ResourceFieldSelector,
} from "./types";

export interface PodMetadata {}

interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  namespaces: string[];
  topologyKey: string;
}

type Handler =
  | {
      exec: {
        command: string[];
      };
    }
  | {
      tcpSocket: {
        host?: string;
        port: number;
      };
    }
  | {
      httpGet: {
        host?: string;
        httpHeaders?: Array<{
          name: string;
          value: string;
        }>;
        path: string;
        port?: number;
        scheme?: "HTTP" | "HTTPS";
      };
    };

type Probe = Handler & {
  failureThreshold?: number;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  successThreshold?: number;
  timeoutSeconds?: number;
};

interface SELinuxOptions {
  user?: string;
  role?: string;
  type?: string;
  level?: string;
}
interface WindowsSecurityContextOptions {
  gmsaCredentialSpec?: string;
  gmsaCredentialSpecName?: string;
  runAsUserName?: string;
}

interface SecurityContext {
  allowPrivilegeEscalation?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
  privileged?: boolean;
  procMount?: "Default" | "Unmasked";
  readOnlyRootFilesystem?: boolean;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  runAsUser?: number;
  seLinuxOptions?: SELinuxOptions;
  windowsOptions?: WindowsSecurityContextOptions;
}

interface PodSecurityContext {
  fsGroup: number;
  runAsGroup: number;
  runAsNonRoot: boolean;
  runAsUser: number;
  seLinuxOptions: SELinuxOptions;
  supplementalGroups: number[];
  sysctls: Array<{ name: string; value: string }>;
  windowsOptions: WindowsSecurityContextOptions;
}

interface Container {
  args?: string[];
  command?: string[];
  env?: Array<
    | {
        name: string;
        value: string;
      }
    | {
        name: string;
        valueFrom:
          | {
              configMapKeyRef: {
                key: string;
                name: string;
                optional?: boolean;
              };
            }
          | {
              fieldRef: {
                apiVersion?: string;
                fieldPath: string;
              };
            }
          | {
              resourceFieldRef: {
                containerName?: string;
                divisor?: number | string;
                resource: string;
              };
            }
          | {
              secretKeyRef: {
                key: string;
                name: string;
                optional?: boolean;
              };
            };
      }
  >;
  envFrom?: Array<
    {
      prefix?: string;
    } & (
      | {
          configMapRef: {
            name: string;
            optional?: boolean;
          };
        }
      | {
          secretRef: {
            name: string;
            optional?: boolean;
          };
        }
    )
  >;
  image: string;
  imagePullPolicy?: "Always" | "Never" | "IfNotPresent";
  lifecycle?: {
    postStart?: Handler;
    preStop?: Handler;
  };
  livenessProbe?: Probe;
  name: string;
  ports?: Array<{
    containerPort: number;
    hostIP?: string;
    hostPort?: number;
    name?: string;
    protocol?: "TCP" | "UDP" | "SCTP";
  }>;
  readinessProbe?: Probe;
  resources?: {
    limits?: {
      memory?: string | number;
      cpu?: string | number;
    };
    requests?: {
      memory?: string | number;
      cpu?: string | number;
    };
  };
  securityContext?: SecurityContext;
  startupProbe?: Probe;
  stdin?: boolean;
  stdinOnce?: boolean;
  terminationMessagePath?: string;
  terminationMessagePolicy?: string;
  tty?: boolean;
  volumeDevices?: Array<{
    devicePath: string;
    name: string;
  }>;
  volumeMounts?: Array<{
    mountPath: string;
    mountPropagation?: string;
    name: string;
    readOnly?: boolean;
    subPath?: string;
  }>;
  workingDir?: string;
}

interface KeyToPath {
  key: string;
  path: string;
  mode?: string;
}

export type Volume = {
  name: string;
} & (
  | GenericVolumeSource
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
        secretRef?: LocalObjectReference;
        user?: string;
      };
    }
  | {
      cinder: {
        fsType?: string;
        readOnly?: boolean;
        secretRef?: LocalObjectReference;
        volumeID: string;
      };
    }
  | {
      configMap: {
        defaultMode?: string;
        items: KeyToPath[];
        name: string;
        optional?: boolean;
      };
    }
  | {
      csi: {
        driver: string;
        fsType?: string;
        nodePublishSecretRef?: LocalObjectReference;
        readOnly?: boolean;
        volumeAttributes?: Record<string, string>;
      };
    }
  | {
      downwardAPI: {
        defaultMode?: number;
        items?: Array<{
          fieldRef: ObjectFieldSelector;
          mode: number;
          path: string;
          resourceFieldRef: ResourceFieldSelector;
        }>;
      };
    }
  | {
      emptyDir: {
        medium?: "" | "Memory";
        sizeLimit?: number | string;
      };
    }
  | {
      flexVolume: {
        driver: string;
        fsType?: string;
        options?: Record<string, string>;
        readOnly?: boolean;
        secretRef?: LocalObjectReference;
      };
    }
  | {
      gitRepo: {
        directory?: string;
        repository: string;
        revision?: string;
      };
    }
  | {
      glusterfs: {
        endpoints: string;
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
        secretRef?: LocalObjectReference;
        targetPortal: string;
      };
    }
  | {
      persistentVolumeClaim: {
        claimName: string;
        readonly?: boolean;
      };
    }
  | {
      projected: {
        defaultMode?: number;
        sources: Array<
          | {
              configMap: {
                name: string;
                items: Array<{
                  key: string;
                  mode?: number;
                  path: string;
                }>;
                optional?: boolean;
              };
            }
          | {
              downwardAPI: {
                fieldRef: ObjectFieldSelector;
                mode?: number;
                path: string;
                resourceFieldRef: ResourceFieldSelector;
              };
            }
          | {
              secret: {
                name: string;
                items: Array<{
                  key: string;
                  mode?: number;
                  path: string;
                }>;
                optional?: boolean;
              };
            }
          | {
              serviceAccountToken: {
                audience?: string;
                expirationSeconds?: number;
                path: string;
              };
            }
        >;
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
        secretRef?: LocalObjectReference;
        user?: string;
      };
    }
  | {
      scaleIO: {
        fsType?: string;
        gateway: string;
        protectionDomain?: string;
        readOnly?: boolean;
        secretRef: LocalObjectReference;
        sslEnabled?: boolean;
        storageMode?: "ThickProvisioned" | "ThinProvisioned";
        storagePool?: string;
        system: string;
        volumeName?: string;
      };
    }
  | {
      secret: {
        defaultMode?: string;
        items: KeyToPath[];
        optional?: boolean;
        secretName: string;
      };
    }
  | {
      storageos: {
        fsType?: string;
        readOnly?: boolean;
        secretRef?: LocalObjectReference;
        volumeName?: string;
        volumeNamespace?: string;
      };
    }
);

export interface PodSpec {
  activeDeadlineSeconds?: number;
  affinity?: {
    nodeAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: Array<{
        preference?: NodeSelectorTerm;
        weight: number;
      }>;
      requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;
    };
    podAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: Array<{
        podAffinityTerm?: PodAffinityTerm;
        weight: number;
      }>;
      requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    };
    podAntiAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: Array<{
        podAffinityTerm?: PodAffinityTerm;
        weight: number;
      }>;
      requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    };
  };
  automountServiceAccountToken?: boolean;
  containers: Container[];
  dnsConfig?: {
    nameservers: string[];
    searches: string[];
    options: Array<{ name: string; value: string }>;
  };
  dnsPolicy?: "ClusterFirstWithHostNet" | "ClusterFirst" | "Default" | "None";
  enableServiceLinks?: boolean;
  ephemeralContainers?: Array<Container & { targetContainerName?: string }>;
  hostAliases?: Array<{
    hostnames: string[];
    ip: string;
  }>;
  hostIPC?: boolean;
  hostNetwork?: boolean;
  hostPID?: boolean;
  hostname?: string;
  imagePullSecrets?: LocalObjectReference[];
  initContainers?: Container[];
  nodeName?: string;
  nodeSelector?: {
    [annotation: string]: string;
  };
  priority?: number;
  priorityClassName?: string;
  readinessGates?: Array<{
    conditionType: "PodScheduled" | "Ready" | "Initialized" | "Unschedulable" | "ContainersReady";
  }>;
  preemptionPolicy?: "Never" | "PreemptLowerPriority";
  restartPolicy?: "Always" | "OnFailure" | "Never";
  runtimeClassName?: string;
  schedulerName?: string;
  securityContext?: PodSecurityContext;
  serviceAccountName?: string;
  shareProcessNamespace?: boolean;
  subdomain?: string;
  terminationGracePeriodSeconds?: number;
  tolerations?: Array<{
    effect?: "NoSchedule" | "PreferNoSchedule" | "NoExecute";
    key?: string;
    operator?: "Exists" | "Equal";
    tolerationSeconds?: number;
    value?: string;
  }>;
  topologySpreadConstraints?: Array<{
    labelSelector?: LabelSelector;
    maxSkew: number;
    topologyKey: string;
    whenUnsatisfiable: "DoNotSchedule" | "ScheduleAnyway";
  }>;
  volumes?: Volume[];
}

type ContainerState =
  | {
      waiting: { message: string; reason: string };
    }
  | {
      running: { startedAt: string };
    }
  | {
      terminated: {
        containerID: string;
        exitCode: number;
        finishedAt: string;
        message: string;
        reason: string;
        signal: number;
        startedAt: string;
      };
    };

interface ContainerStatus {
  containerID: string;
  image: string;
  imageID: string;
  lastState: ContainerState;
  name: string;
  ready: boolean;
  restartCount: number;
  started: boolean;
  state: ContainerState;
}

export interface PodStatus {
  phase?: "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
  conditions?: Array<Condition<"ContainersReady" | "Initialized" | "Ready" | "PodScheduled">>;
  containerStatuses?: ContainerStatus[];
  ephemeralContainerStatuses?: ContainerStatus[];
  hostIP?: string;
  initContainerStatuses?: ContainerStatus[];
  message?: string;
  nominatedNodeName?: string;
  podIP?: string;
  podIPs?: Array<{ ip: string }>;
  qosClass?: "BestEffort" | "Guaranteed" | "Burstable ";
  reason?: string;
  startTime?: string;
}

export interface PodTemplateSpec {
  metadata?: {
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: PodSpec;
}

export interface Pod extends INamespacedResource<PodMetadata, PodSpec, PodStatus> {
  exec(containerName: string, command: string[], options: ExecOptions): Promise<Exec>;
  exec(
    containerName: string,
    command: string[],
  ): Promise<{
    stdout: Buffer;
    stderr: Buffer;
  }>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Pod = wrapNamespacedResource<PodMetadata, PodSpec, PodStatus, Pod, "Pod", "v1">(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Pod extends NamespacedResource<PodMetadata, PodSpec, PodStatus, "Pod", "v1"> {
    static kind = "Pod";

    protected static apiPlural = "pods";

    static apiVersion = "v1";

    exec(containerName: string, command: string[], options: ExecOptions): Promise<Exec>;

    exec(
      containerName: string,
      command: string[],
    ): Promise<{
      stdout: Buffer;
      stderr: Buffer;
    }>;

    async exec(containerName: string, command: string[], options?: ExecOptions) {
      const ws = await ClusterConnection.current().websocket(
        `${this.metadata.selfLink}/exec?container=${encodeURIComponent(containerName)}&command=${command
          .map(x => encodeURIComponent(x))
          .join("&command=")}&stdin=1&stdout=1&stderr=1`,
      );

      if (options) {
        return new Exec(ws, options);
      }

      return Exec.asPromise(ws);
    }
  },
);
