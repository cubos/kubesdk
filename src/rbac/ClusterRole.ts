import { IResource, Resource, wrapResource } from "../base/Resource";
import { LabelSelector } from "../core/types";
import { PolicyRule } from "./types";

export interface ClusterRoleMetadata {}

export interface ClusterRoleSpec {
  aggregationRule?: {
    clusterRoleSelectors: LabelSelector[];
  };
  rules: PolicyRule[];
}

export interface ClusterRoleStatus {}

interface ClusterRole extends IResource<ClusterRoleMetadata, ClusterRoleSpec, ClusterRoleStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ClusterRole = wrapResource<ClusterRoleMetadata, ClusterRoleSpec, ClusterRoleStatus, ClusterRole>(
  // eslint-disable-next-line no-shadow
  class ClusterRole extends Resource<ClusterRoleMetadata, ClusterRoleSpec, ClusterRoleStatus> {
    protected static kind = "ClusterRole";

    protected static apiPlural = "clusterroles";

    protected static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);