import { ClusterConnection } from "../base/ClusterConnection";
import { Exec, ExecOptions } from "../base/Exec";
import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { Condition, LabelSelector, LocalObjectReference } from "./types";

export interface PodMetadata {}

interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  namespaces: string[];
  topologyKey: string;
}

interface NodeSelectorRequirement {
  key: string;
  operator: "In" | "NotIn" | "Exists" | "DoesNotExist" | "Gt" | "Lt";
  values: string[];
}

interface NodeSelectorTerm {
  matchExpressions?: NodeSelectorRequirement[];
  matchFields?: NodeSelectorRequirement[];
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
  envFrom?: Array<{
    configMapRef?: {
      name: string;
      optional?: boolean;
    };
    prefix?: string;
    secretRef?: {
      name: string;
      optional?: boolean;
    };
  }>;
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
  | // | {
  /*
   *     awsElasticBlockStore: AWSElasticBlockStoreVolumeSource;
   *   }
   * | {
   *     azureDisk: AzureDiskVolumeSource;
   *   }
   * | {
   *     azureFile: AzureFileVolumeSource;
   *   }
   * | {
   *     cephfs: CephFSVolumeSource;
   *   }
   * | {
   *     cinder: CinderVolumeSource;
   *   }
   */
  {
      configMap: {
        defaultMode?: string;
        items: KeyToPath[];
        name: string;
        optional?: boolean;
      };
    }
  /*
   * | {
   *     downwardAPI: DownwardAPIVolumeSource;
   *   }
   */
  | {
      emptyDir: {
        medium?: "" | "Memory";
        sizeLimit?: number | string;
      };
    }
  /*
   * | {
   *     fc: FCVolumeSource;
   *   }
   * | {
   *     flexVolume: FlexVolumeSource;
   *   }
   * | {
   *     flocker: FlockerVolumeSource;
   *   }
   * | {
   *     gcePersistentDisk: GCEPersistentDiskVolumeSource;
   *   }
   * | {
   *     gitRepo: GitRepoVolumeSource;
   *   }
   * | {
   *     glusterfs: GlusterfsVolumeSource;
   *   }
   * | {
   *     hostPath: HostPathVolumeSource;
   *   }
   * | {
   *     iscsi: ISCSIVolumeSource;
   *   }
   * | {
   *     nfs: NFSVolumeSource;
   *   }
   */
  | {
      persistentVolumeClaim: {
        claimName: string;
        readonly?: boolean;
      };
    }
  /*
   * | {
   *     photonPersistentDisk: PhotonPersistentDiskVolumeSource;
   *   }
   * | {
   *     portworxVolume: PortworxVolumeSource;
   *   }
   * | {
   *     projected: ProjectedVolumeSource;
   *   }
   * | {
   *     quobyte: QuobyteVolumeSource;
   *   }
   * | {
   *     rbd: RBDVolumeSource;
   *   }
   * | {
   *     scaleIO: ScaleIOVolumeSource;
   *   }
   */
  | {
      secret: {
        defaultMode?: string;
        items: KeyToPath[];
        optional?: boolean;
        secretName: string;
      };
    }
  /*
   * | {
   *     storageos: StorageOSVolumeSource;
   *   }
   * | {
   *     vsphereVolume: VsphereVirtualDiskVolumeSource;
   *   }
   */
);

export interface PodSpec {
  activeDeadlineSeconds?: number;
  affinity?: {
    nodeAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: Array<{
        preference?: NodeSelectorTerm;
        weight: number;
      }>;
      requiredDuringSchedulingIgnoredDuringExecution?: {
        nodeSelectorTerms?: NodeSelectorTerm[];
      };
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

interface Pod extends INamespacedResource<PodMetadata, PodSpec, PodStatus> {
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
export const Pod = wrapNamespacedResource<PodMetadata, PodSpec, PodStatus, Pod>(
  // eslint-disable-next-line no-shadow
  class Pod extends NamespacedResource<PodMetadata, PodSpec, PodStatus> {
    protected static kind = "Pod";

    protected static apiPlural = "pods";

    protected static apiVersion = "v1";

    exec(containerName: string, command: string[], options: ExecOptions): Promise<Exec>;

    exec(
      containerName: string,
      command: string[],
    ): Promise<{
      stdout: Buffer;
      stderr: Buffer;
    }>;

    async exec(containerName: string, command: string[], options?: ExecOptions) {
      const conn = await ClusterConnection.current().websocket(
        `${this.metadata.selfLink}/exec?container=${encodeURIComponent(containerName)}&command=${command
          .map(x => encodeURIComponent(x))
          .join("&command=")}&stdin=1&stdout=1&stderr=1`,
      );

      if (options) {
        return new Exec(conn, options);
      }

      return Exec.asPromise(conn);
    }
  },
);
