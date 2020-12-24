import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface SecretMetadata {}

export interface SecretSpec {
  data: Record<string, string | undefined>;
  stringData?: Record<string, string>;
  type?: string;
}

export interface SecretStatus {}

export type Secret = INamespacedResource<SecretMetadata, SecretSpec, SecretStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Secret = wrapNamespacedResource<SecretMetadata, SecretSpec, SecretStatus, Secret, "Secret", "v1">(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class Secret extends NamespacedResource<SecretMetadata, SecretSpec, SecretStatus, "Secret", "v1"> {
    static kind = "Secret";

    protected static apiPlural = "secrets";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
