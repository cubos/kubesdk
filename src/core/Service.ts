import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface ServiceMetadata {}

export type ServiceSpec = {
  externalIPs?: string[];
  readonly ipFamily?: "IPv4" | "IPv6";
  ports:
    | Array<{
        name: string;
        nodePort?: number;
        port: number;
        protocol: "TCP" | "UDP" | "SCTP";
        targetPort?: number;
      }>
    | [
        {
          name?: string;
          nodePort?: number;
          port: number;
          protocol: "TCP" | "UDP" | "SCTP";
          targetPort?: number;
        },
      ];
} & (
  | {
      type: "ExternalName";
      externalName: string;
    }
  | ((
      | {
          type: "ClusterIP" | "NodePort";
        }
      | {
          type: "LoadBalancer";
          externalTrafficPolicy?: "Local" | "Cluster";
          healthCheckNodePort?: number;
          loadBalancerIP?: string;
          loadBalancerSourceRanges?: string[];
        }
    ) & {
      readonly clusterIP?: string;
      publishNotReadyAddresses?: boolean;
      selector: Record<string, string>;
      sessionAffinity?: "ClientIP" | "None";
      sessionAffinityConfig?: {
        clientIP: {
          timeoutSeconds: number;
        };
      };
    })
);

export interface ServiceStatus {
  loadBalancer?: {
    ingress: { hostname: string } | { ip: string };
  };
}

export interface Service extends INamespacedResource<ServiceMetadata, ServiceSpec, ServiceStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Service = wrapNamespacedResource<ServiceMetadata, ServiceSpec, ServiceStatus, Service, "Service", "v1">(
  // eslint-disable-next-line no-shadow
  class Service extends NamespacedResource<ServiceMetadata, ServiceSpec, ServiceStatus, "Service", "v1"> {
    static kind = "Service";

    protected static apiPlural = "services";

    static apiVersion = "v1";
  },
);
