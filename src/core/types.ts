export interface LabelSelector {
  matchExpressions?: (
    | {
        key: string;
        operator: "In" | "NotIn";
        values: string[];
      }
    | {
        key: string;
        operator: "Exists" | "DoesNotExist";
      }
  )[];
  matchLabels?: Record<string, string>;
}
