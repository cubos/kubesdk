import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { LocalObjectReference } from "./types";

export interface ServiceAccountMetadata {}

export interface ServiceAccountSpec {
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: LocalObjectReference[];
  secrets?: LocalObjectReference[];
}

export interface ServiceAccountStatus {}

interface ServiceAccount
  extends INamespacedResource<ServiceAccountMetadata, ServiceAccountSpec, ServiceAccountStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ServiceAccount = wrapNamespacedResource<
  ServiceAccountMetadata,
  ServiceAccountSpec,
  ServiceAccountStatus,
  ServiceAccount,
  "ServiceAccount",
  "v1"
>(
  // eslint-disable-next-line no-shadow
  class ServiceAccount extends NamespacedResource<
    ServiceAccountMetadata,
    ServiceAccountSpec,
    ServiceAccountStatus,
    "ServiceAccount",
    "v1"
  > {
    static kind = "ServiceAccount";

    protected static apiPlural = "serviceaccounts";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
