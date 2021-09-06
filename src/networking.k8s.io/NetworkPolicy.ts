import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { LabelSelector } from "../core/types";

export interface NetworkPolicyMetadata {}

type NetworkPolicyPort = {
  protocol?: "TCP" | "UDP" | "SCTP";
} & (
  | {
      port: number;
      endPort?: number;
    }
  | {
      port?: string;
    }
);

type NetworkPolicyPeer =
  | {
      ipBlock: {
        cidr: string;
        except?: string[];
      };
    }
  | {
      podSelector: LabelSelector;
      namespaceSelector?: LabelSelector;
    };

export interface NetworkPolicySpec {
  egress?: Array<{
    ports?: NetworkPolicyPort[];
    to: NetworkPolicyPeer[];
  }>;
  ingress?: Array<{
    ports?: NetworkPolicyPort[];
    from: NetworkPolicyPeer[];
  }>;
  podSelector: LabelSelector;
  policyTypes?: [] | ["Ingress"] | ["Egress"] | ["Ingress", "Egress"];
}

export interface NetworkPolicyStatus {}

export type NetworkPolicy = INamespacedResource<NetworkPolicyMetadata, NetworkPolicySpec, NetworkPolicyStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const NetworkPolicy = wrapNamespacedResource<
  NetworkPolicyMetadata,
  NetworkPolicySpec,
  NetworkPolicyStatus,
  NetworkPolicy,
  "NetworkPolicy",
  "networking.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class NetworkPolicy extends NamespacedResource<
    NetworkPolicyMetadata,
    NetworkPolicySpec,
    NetworkPolicyStatus,
    "NetworkPolicy",
    "networking.k8s.io/v1"
  > {
    static kind = "NetworkPolicy";

    protected static apiPlural = "networkpolicies";

    static apiVersion = "networking.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
