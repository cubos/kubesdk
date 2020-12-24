import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { ObjectReference } from "./types";

export interface EndpointsMetadata {}

interface EndpointAddress {
  hostname?: string;
  ip: string;
  nodeName?: string;
  targetRef?: ObjectReference;
}

interface EndpointPort {
  name?: string;
  port: number;
  protocol?: "UDP" | "TCP" | "SCTP";
}

export interface EndpointsSpec {
  subsets?: Array<{
    addresses?: EndpointAddress[];
    notReadyAddresses?: EndpointAddress[];
    ports: EndpointPort[];
  }>;
}

export interface EndpointsStatus {}

export type Endpoints = INamespacedResource<EndpointsMetadata, EndpointsSpec, EndpointsStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Endpoints = wrapNamespacedResource<
  EndpointsMetadata,
  EndpointsSpec,
  EndpointsStatus,
  Endpoints,
  "Endpoints",
  "v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Endpoints extends NamespacedResource<EndpointsMetadata, EndpointsSpec, EndpointsStatus, "Endpoints", "v1"> {
    static kind = "Endpoints";

    protected static apiPlural = "endpoints";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
