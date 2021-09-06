export type PolicyRule = (
  | {
      apiGroups: string[] | ["*"];
      resourceNames?: string[];
      resources: string[] | ["*"];
    }
  | {
      nonResourceURLs: string[] | ["*"];
    }
) & {
  verbs:
    | Array<
        | "create"
        | "get"
        | "list"
        | "watch"
        | "update"
        | "patch"
        | "delete"
        | "use"
        | "bind"
        | "escalate"
        | "impersonate"
      >
    | ["*"];
};

export type Subject =
  | {
      apiGroup?: "";
      kind: "ServiceAccount";
      name: string;
      namespace: string;
    }
  | {
      apiGroup?: "rbac.authorization.k8s.io";
      kind: "User" | "Group";
      name: string;
    };
