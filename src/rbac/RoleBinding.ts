import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { Subject } from "./types";

export interface RoleBindingMetadata {}

export interface RoleBindingSpec {
  roleRef: {
    kind: "Role" | "ClusterRole";
    name: string;
    apiGroup: "rbac.authorization.k8s.io";
  };
  subjects: Subject[];
}

export interface RoleBindingStatus {}

interface RoleBinding extends INamespacedResource<RoleBindingMetadata, RoleBindingSpec, RoleBindingStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const RoleBinding = wrapNamespacedResource<RoleBindingMetadata, RoleBindingSpec, RoleBindingStatus, RoleBinding>(
  // eslint-disable-next-line no-shadow
  class RoleBinding extends NamespacedResource<RoleBindingMetadata, RoleBindingSpec, RoleBindingStatus> {
    protected static kind = "RoleBinding";

    protected static apiPlural = "rolebindings";

    protected static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
