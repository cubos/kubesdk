import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { PolicyRule } from "./types";

export interface RoleMetadata {}

export interface RoleSpec {
  rules: PolicyRule[];
}

export interface RoleStatus {}

interface Role extends INamespacedResource<RoleMetadata, RoleSpec, RoleStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Role = wrapNamespacedResource<RoleMetadata, RoleSpec, RoleStatus, Role>(
  // eslint-disable-next-line no-shadow
  class Role extends NamespacedResource<RoleMetadata, RoleSpec, RoleStatus> {
    protected static kind = "Role";

    protected static apiPlural = "roles";

    protected static apiVersion = "rbac.authorization.k8s.io/v1";

    protected static hasInlineSpec = true;
  },
);
