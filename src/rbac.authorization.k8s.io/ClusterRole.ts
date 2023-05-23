import type { PolicyRule } from "./types";
import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";
import type { LabelSelector } from "../core/types";

export interface ClusterRoleMetadata {}

export interface ClusterRoleSpec {
  aggregationRule?: {
    clusterRoleSelectors: LabelSelector[];
  };
  rules: PolicyRule[];
}

export interface ClusterRoleStatus {}

export type ClusterRole = IResource<ClusterRoleMetadata, ClusterRoleSpec, ClusterRoleStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ClusterRole = wrapResource<
  ClusterRoleMetadata,
  ClusterRoleSpec,
  ClusterRoleStatus,
  ClusterRole,
  "ClusterRole",
  "rbac.authorization.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class ClusterRole extends Resource<
    ClusterRoleMetadata,
    ClusterRoleSpec,
    ClusterRoleStatus,
    "ClusterRole",
    "rbac.authorization.k8s.io/v1"
  > {
    static kind = "ClusterRole";

    protected static apiPlural = "clusterroles";

    static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
