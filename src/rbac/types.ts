export interface PolicyRule {
  apiGroups: string[];
  nonResourceURLs: string[];
  resourceNames: string[];
  resources: string[];
  verbs: Array<
    "create" | "get" | "list" | "watch" | "update" | "patch" | "delete" | "use" | "bind" | "escalate" | "impersonate"
  >;
}

export type Subject =
  | {
      apiGroup?: "";
      kind: "ServiceGroup";
      name: string;
      namespace: string;
    }
  | {
      apiGroup?: "rbac.authorization.k8s.io";
      kind: "User" | "Group";
      name: string;
    };
