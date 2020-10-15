import { ClusterConnection } from "../base/ClusterConnection";
import { Exec, ExecOptions } from "../base/Exec";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { LabelSelector } from "./types";

export interface PodMetadata {}

interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  namespaces: string[];
  topologyKey: string;
}

interface NodeSelectorTerm {
  matchExpressions?: NodeSelectorRequirement[];
  matchFields?: NodeSelectorRequirement[];
}

interface NodeSelectorRequirement {
  key: string;
  operator: "In" | "NotIn" | "Exists" | "DoesNotExist" | "Gt" | "Lt";
  values: string[];
}

type Probe = (
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
        httpHeaders?: {
          name: string;
          value: string;
        }[];
        path: string;
        port?: number;
        scheme?: "HTTP" | "HTTPS";
      };
    }
) & {
  failureThreshold?: number;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  successThreshold?: number;
  timeoutSeconds?: number;
};

interface Container {
  args?: string[];
  command?: string[];
  env?: (
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
  )[];
  envFrom?: {
    configMapRef?: {
      name: string;
      optional?: boolean;
    };
    prefix?: string;
    secretRef?: {
      name: string;
      optional?: boolean;
    };
  }[];
  image: string;
  imagePullPolicy?: "Always" | "Never" | "IfNotPresent";
  // lifecycle?: Lifecycle
  livenessProbe?: Probe;
  name: string;
  ports?: {
    containerPort: number;
    hostIP?: string;
    hostPort?: number;
    name?: string;
    protocol?: "TCP" | "UDP" | "SCTP";
  }[];
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
  // securityContext?: SecurityContext
  startupProbe?: Probe;
  stdin?: boolean;
  stdinOnce?: boolean;
  terminationMessagePath?: string;
  terminationMessagePolicy?: string;
  tty?: boolean;
  // volumeDevices?: VolumeDevice[]
  volumeMounts?: {
    mountPath: string;
    mountPropagation?: string;
    name: string;
    readOnly?: boolean;
    subPath?: string;
  }[];
  workingDir?: string;
}

export interface PodSpec {
  activeDeadlineSeconds?: number;
  affinity?: {
    nodeAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: {
        preference?: NodeSelectorTerm;
        weight: number;
      }[];
      requiredDuringSchedulingIgnoredDuringExecution?: {
        nodeSelectorTerms?: NodeSelectorTerm[];
      };
    };
    podAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: {
        podAffinityTerm?: PodAffinityTerm;
        weight: number;
      }[];
      requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    };
    podAntiAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: {
        podAffinityTerm?: PodAffinityTerm;
        weight: number;
      }[];
      requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    };
  };
  automountServiceAccountToken?: boolean;
  containers: Container[];
  // dnsConfig?: PodDNSConfig
  dnsPolicy?: "ClusterFirstWithHostNet" | "ClusterFirst" | "Default" | "None";
  enableServiceLinks?: boolean;
  // ephemeralContainers?: EphemeralContainer[]
  // hostAliases?: HostAlias[]
  hostIPC?: boolean;
  hostNetwork?: boolean;
  hostPID?: boolean;
  hostname?: string;
  // imagePullSecrets?: LocalObjectReference[];
  initContainers?: Container[];
  nodeName?: string;
  nodeSelector?: {
    [annotation: string]: string;
  };
  priority?: number;
  priorityClassName?: string;
  // readinessGates?: PodReadinessGate[]
  preemptionPolicy?: "Never" | "PreemptLowerPriority";
  restartPolicy?: "Always" | "OnFailure" | "Never";
  runtimeClassName?: string;
  schedulerName?: string;
  // securityContext?: PodSecurityContext;
  serviceAccountName?: string;
  shareProcessNamespace?: boolean;
  subdomain?: string;
  terminationGracePeriodSeconds?: number;
  // tolerations?: Toleration[];
  // topologySpreadConstraints?: TopologySpreadConstraint[]
  // volumes?: Volume[];
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
  phase?: "Pending" | "Running" | "Succeeded" | "Failed	" | "Unknown";
  conditions?: {
    lastProbeTime: string;
    lastTransitionTime: string;
    message: string;
    reason: string;
    status: string;
    type: string;
  }[];
  containerStatuses?: ContainerStatus[];
  ephemeralContainerStatuses?: ContainerStatus[];
  hostIP?: string;
  initContainerStatuses?: ContainerStatus[];
  message?: string;
  nominatedNodeName?: string;
  podIP?: string;
  podIPs?: { ip: string }[];
  qosClass?: "BestEffort" | "Guaranteed" | "Burstable ";
  reason?: string;
  startTime?: string;
}

const _class = class Pod extends NamespacedResource<
  PodMetadata,
  PodSpec,
  PodStatus
> {
  protected static kind = "Pod";
  protected static apiPlural = "pods";
  protected static apiVersion = "v1";

  exec(
    containerName: string,
    command: string[],
    options: ExecOptions
  ): Promise<Exec>;
  exec(
    containerName: string,
    command: string[]
  ): Promise<{
    stdout: Buffer;
    stderr: Buffer;
  }>;
  async exec(containerName: string, command: string[], options?: ExecOptions) {
    const conn = await ClusterConnection.current().websocket(
      this.metadata.selfLink +
        `/exec?container=${encodeURIComponent(
          containerName
        )}&command=${command
          .map((x) => encodeURIComponent(x))
          .join("&command=")}&stdin=1&stdout=1&stderr=1`
    );
    if (options) {
      return new Exec(conn, options);
    } else {
      return Exec.asPromise(conn);
    }
  }
};

export const Pod = wrapNamespacedResource<
  PodMetadata,
  PodSpec,
  PodStatus,
  typeof _class["prototype"],
  typeof _class
>(_class);
