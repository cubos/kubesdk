import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface PodMetadata {}

export interface PodSpec {}

export interface PodStatus {}

const _class = class Pod extends NamespacedResource<
  PodMetadata,
  PodSpec,
  PodStatus
> {
  static kind = "Pod";
  static apiPlural = "pods";
  static apiVersion = "v1";
};

export const Pod = wrapNamespacedResource<
  PodMetadata,
  PodSpec,
  PodStatus,
  typeof _class["prototype"],
  typeof _class
>(_class);
