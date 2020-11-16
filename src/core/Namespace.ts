import { IResource, IStaticResource, Resource, wrapResource } from "../base/Resource";

export interface NamespaceMetadata {}

export interface NamespaceSpec {
  finalizers?: string[];
}

export interface NamespaceStatus {
  phase: "Active" | "Terminating";
}

interface Namespace extends IResource<NamespaceMetadata, NamespaceSpec, NamespaceStatus> {}
interface IStaticNamespace extends IStaticResource<Namespace, NamespaceMetadata, NamespaceSpec, NamespaceStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Namespace = wrapResource<NamespaceMetadata, NamespaceSpec, NamespaceStatus, Namespace, IStaticNamespace>(
  // eslint-disable-next-line no-shadow
  class Namespace extends Resource<NamespaceMetadata, NamespaceSpec, NamespaceStatus> {
    protected static kind = "Namespace";

    protected static apiPlural = "namespaces";

    protected static apiVersion = "v1";
  },
);
