import type { ObjectReference } from "./types";
import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface EventMetadata {}

export interface EventSpec {
  action: string;
  count?: number;
  eventTime: string | null;
  firstTimestamp: string;
  involvedObject: ObjectReference;
  lastTimestamp: string;
  message: string;
  reason: string;
  related?: ObjectReference;
  reportingComponent: string;
  reportingInstance: string;
  series?: {
    count: number;
    lastObservedTime: string;
  };
  source: {
    component: string;
    host: string;
  };
  type: "Normal" | "Warning";
}

export interface EventStatus {}

export type Event = INamespacedResource<EventMetadata, EventSpec, EventStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Event = wrapNamespacedResource<EventMetadata, EventSpec, EventStatus, Event, "Event", "v1">(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Event extends NamespacedResource<EventMetadata, EventSpec, EventStatus, "Event", "v1"> {
    static kind = "Event";

    protected static apiPlural = "events";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
