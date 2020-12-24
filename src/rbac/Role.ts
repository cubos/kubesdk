import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { PolicyRule } from "./types";

export interface RoleMetadata {}

export interface RoleSpec {
  rules: PolicyRule[];
}

export interface RoleStatus {}

export type Role = INamespacedResource<RoleMetadata, RoleSpec, RoleStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Role = wrapNamespacedResource<
  RoleMetadata,
  RoleSpec,
  RoleStatus,
  Role,
  "Role",
  "rbac.authorization.k8s.io/v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Role extends NamespacedResource<RoleMetadata, RoleSpec, RoleStatus, "Role", "rbac.authorization.k8s.io/v1"> {
    static kind = "Role";

    protected static apiPlural = "roles";

    static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
