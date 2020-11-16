import { IResource, Resource, wrapResource } from "../base/Resource";
import { Subject } from "./types";

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

interface ClusterRoleBinding
  extends IResource<ClusterRoleBindingMetadata, ClusterRoleBindingSpec, ClusterRoleBindingStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ClusterRoleBinding = wrapResource<
  ClusterRoleBindingMetadata,
  ClusterRoleBindingSpec,
  ClusterRoleBindingStatus,
  ClusterRoleBinding
>(
  // eslint-disable-next-line no-shadow
  class ClusterRoleBinding extends Resource<
    ClusterRoleBindingMetadata,
    ClusterRoleBindingSpec,
    ClusterRoleBindingStatus
  > {
    protected static kind = "ClusterRoleBinding";

    protected static apiPlural = "clusterrolebindings";

    protected static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
