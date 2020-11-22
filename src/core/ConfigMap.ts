import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";

export interface ConfigMapMetadata {}

export interface ConfigMapSpec {
  data: Record<string, string>;
}

export interface ConfigMapStatus {}

interface ConfigMap extends INamespacedResource<ConfigMapMetadata, ConfigMapSpec, ConfigMapStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ConfigMap = wrapNamespacedResource<ConfigMapMetadata, ConfigMapSpec, ConfigMapStatus, ConfigMap>(
  // eslint-disable-next-line no-shadow
  class ConfigMap extends NamespacedResource<ConfigMapMetadata, ConfigMapSpec, ConfigMapStatus> {
    protected static kind = "ConfigMap";

    protected static apiPlural = "configmaps";

    protected static apiVersion = "v1";

    protected static hasInlineSpec = true;
  },
);
