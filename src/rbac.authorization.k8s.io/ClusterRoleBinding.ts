import type { Subject } from "./types";
import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";

export interface ClusterRoleBindingMetadata {}

export interface ClusterRoleBindingSpec {
  roleRef: {
    kind: "ClusterRole";
    name: string;
    apiGroup: "rbac.authorization.k8s.io";
  };
  subjects: Subject[];
}

export interface ClusterRoleBindingStatus {}

export type ClusterRoleBinding = IResource<
  ClusterRoleBindingMetadata,
  ClusterRoleBindingSpec,
  ClusterRoleBindingStatus
>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ClusterRoleBinding = wrapResource<
  ClusterRoleBindingMetadata,
  ClusterRoleBindingSpec,
  ClusterRoleBindingStatus,
  ClusterRoleBinding,
  "ClusterRoleBinding",
  "rbac.authorization.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class ClusterRoleBinding extends Resource<
    ClusterRoleBindingMetadata,
    ClusterRoleBindingSpec,
    ClusterRoleBindingStatus,
    "ClusterRoleBinding",
    "rbac.authorization.k8s.io/v1"
  > {
    static kind = "ClusterRoleBinding";

    protected static apiPlural = "clusterrolebindings";

    static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
