import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface LimitRangeMetadata {}

export interface LimitRangeSpec {
  limits: Array<{
    default: string;
    defaultRequest: string;
    max: string;
    maxLimitRequestRatio: string;
    min: string;
    type: string;
  }>;
}

export interface LimitRangeStatus {}

interface LimitRange extends INamespacedResource<LimitRangeMetadata, LimitRangeSpec, LimitRangeStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const LimitRange = wrapNamespacedResource<
  LimitRangeMetadata,
  LimitRangeSpec,
  LimitRangeStatus,
  LimitRange,
  "LimitRange",
  "v1"
>(
  // eslint-disable-next-line no-shadow
  class LimitRange extends NamespacedResource<
    LimitRangeMetadata,
    LimitRangeSpec,
    LimitRangeStatus,
    "LimitRange",
    "v1"
  > {
    static kind = "LimitRange";

    protected static apiPlural = "limitranges";

    static apiVersion = "v1";
  },
);
