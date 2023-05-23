import type { Condition } from "./types";
import type { IResource } from "../base/Resource";
import { Resource, wrapResource } from "../base/Resource";

export interface ComponentStatusMetadata {}

export interface ComponentStatusSpec {
  conditions?: Array<Condition<"Healthy">>;
}

export interface ComponentStatusStatus {}

export type ComponentStatus = IResource<ComponentStatusMetadata, ComponentStatusSpec, ComponentStatusStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ComponentStatus = wrapResource<
  ComponentStatusMetadata,
  ComponentStatusSpec,
  ComponentStatusStatus,
  ComponentStatus,
  "ComponentStatus",
  "v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class ComponentStatus extends Resource<
    ComponentStatusMetadata,
    ComponentStatusSpec,
    ComponentStatusStatus,
    "ComponentStatus",
    "v1"
  > {
    static kind = "ComponentStatus";

    protected static apiPlural = "componentstatus";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
