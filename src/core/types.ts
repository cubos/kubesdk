export interface LabelSelector {
  matchExpressions?: Array<
    | {
        key: string;
        operator: "In" | "NotIn";
        values: string[];
      }
    | {
        key: string;
        operator: "Exists" | "DoesNotExist";
      }
  >;
  matchLabels?: Record<string, string>;
}

export interface LocalObjectReference {
  name: string;
}

export interface TypedLocalObjectReference<Kind extends string = string, ApiGroup extends string = string> {
  name: string;
  kind: Kind;
  apiGroup: ApiGroup;
}

export interface Condition<Type extends string> {
  lastProbeTime: string;
  lastTransitionTime: string;
  message: string;
  reason: string;
  status: "True" | "False" | "Unknown";
  type: Type;
}
export interface ObjectReference<Kind extends string = string, ApiVersion extends string = string> {
  apiVersion: ApiVersion;
  fieldPath: string;
  kind: Kind;
  name: string;
  namespace: string;
  resourceVersion: string;
  uid: string;
}
