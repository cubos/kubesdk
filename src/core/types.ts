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
