import { IResource, Resource, wrapResource } from "../base/Resource";
import { Condition } from "./types";

export interface ComponentStatusMetadata {}

export interface ComponentStatusSpec {
  conditions?: Array<Condition<"Healthy">>;
}

export interface ComponentStatusStatus {}

export interface ComponentStatus
  extends IResource<ComponentStatusMetadata, ComponentStatusSpec, ComponentStatusStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ComponentStatus = wrapResource<
  ComponentStatusMetadata,
  ComponentStatusSpec,
  ComponentStatusStatus,
  ComponentStatus,
  "ComponentStatus",
  "v1"
>(
  // eslint-disable-next-line no-shadow
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
