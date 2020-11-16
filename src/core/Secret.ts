import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface SecretMetadata {}

export interface SecretSpec {
  data: Record<string, string>;
  stringData?: Record<string, string>;
  type?: string;
}

export interface SecretStatus {}

interface Secret extends INamespacedResource<SecretMetadata, SecretSpec, SecretStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Secret = wrapNamespacedResource<SecretMetadata, SecretSpec, SecretStatus, Secret>(
  // eslint-disable-next-line no-shadow
  class Secret extends NamespacedResource<SecretMetadata, SecretSpec, SecretStatus> {
    protected static kind = "Secret";

    protected static apiPlural = "secrets";

    protected static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);