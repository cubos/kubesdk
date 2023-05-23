import type { Subject } from "./types";
import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

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

export type RoleBinding = INamespacedResource<RoleBindingMetadata, RoleBindingSpec, RoleBindingStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const RoleBinding = wrapNamespacedResource<
  RoleBindingMetadata,
  RoleBindingSpec,
  RoleBindingStatus,
  RoleBinding,
  "RoleBinding",
  "rbac.authorization.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class RoleBinding extends NamespacedResource<
    RoleBindingMetadata,
    RoleBindingSpec,
    RoleBindingStatus,
    "RoleBinding",
    "rbac.authorization.k8s.io/v1"
  > {
    static kind = "RoleBinding";

    protected static apiPlural = "rolebindings";

    static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
