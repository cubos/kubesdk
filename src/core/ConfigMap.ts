import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface ConfigMapMetadata {}

export interface ConfigMapSpec {
  data: Record<string, string | undefined>;
}

export interface ConfigMapStatus {}

export type ConfigMap = INamespacedResource<ConfigMapMetadata, ConfigMapSpec, ConfigMapStatus>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ConfigMap = wrapNamespacedResource<
  ConfigMapMetadata,
  ConfigMapSpec,
  ConfigMapStatus,
  ConfigMap,
  "ConfigMap",
  "v1"
>(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class ConfigMap extends NamespacedResource<ConfigMapMetadata, ConfigMapSpec, ConfigMapStatus, "ConfigMap", "v1"> {
    static kind = "ConfigMap";

    protected static apiPlural = "configmaps";

    static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
