import { AsTyped } from "as-typed";
import { JSONSchema4 } from "json-schema";
import { CustomResourceDefinitionNames, CustomResourceDefinitionSpec } from "../apiextensions/CustomResourceDefinition";
import { DeepReadonly, DeepUnReadonly } from "../utils";
import {
  INamespacedResource,
  IResource,
  NamespacedResource,
  Resource,
  wrapNamespacedResource,
  wrapResource,
} from "./Resource";

interface VersionSpec<SchemaT extends DeepReadonly<JSONSchema4>, VersionNameT extends string> {
  name: VersionNameT;
  schema: SchemaT;
  served: boolean;
  storage: boolean;
  scale?: {
    labelSelectorPath?: string;
    specReplicasPath: string;
    statusReplicasPath: string;
  };
}

export class CustomResourceControllerConfig {
  conversions = new Map<string, Map<string, (obj: any) => any>>();

  constructor(public crdSpec: CustomResourceDefinitionSpec) {}
}

export class CustomResourceController<
  KindT extends string,
  GroupNameT extends string,
  Scope extends "Cluster" | "Namespaced"
> {
  private config: CustomResourceControllerConfig;

  constructor(options: { scope: Scope; group: GroupNameT } & CustomResourceDefinitionNames<KindT>) {
    this.config = new CustomResourceControllerConfig({
      group: options.group,
      names: {
        categories: options.categories,
        kind: options.kind,
        listKind: options.listKind,
        plural: options.plural,
        shortNames: options.shortNames,
        singular: options.singular,
      },
      scope: options.scope,
      versions: [],
    });
  }

  addVersion<SchemaT extends DeepReadonly<JSONSchema4>, VersionNameT extends string>(
    versionSpec: VersionSpec<SchemaT, VersionNameT>,
  ) {
    if (versionSpec.storage && this.config.crdSpec.versions.some(ver => ver.storage)) {
      throw new Error("Only one version may have storage=true");
    }

    type ApiVersionT = `${GroupNameT}/${VersionNameT}`;
    type MetadataT = AsTyped<SchemaT> extends { metadata: infer T } ? T : {};
    type SpecT = AsTyped<SchemaT> extends { spec: infer T } ? T : {};
    type StatusT = AsTyped<SchemaT> extends { status: infer T } ? T : {};

    this.config.crdSpec.versions.push({
      name: versionSpec.name,
      served: versionSpec.served,
      storage: versionSpec.storage,
      schema: {
        openAPIV3Schema: versionSpec.schema as DeepUnReadonly<SchemaT>,
      },
      subresources: {
        scale: versionSpec.scale,
        status: {},
      },
    });

    const { kind } = this.config.crdSpec.names;
    const apiPlural = this.config.crdSpec.names.plural;
    const apiGroup = this.config.crdSpec.group;
    const apiVersion = versionSpec.name;

    if (this.config.crdSpec.scope === "Namespaced") {
      const resultClass = wrapNamespacedResource<
        MetadataT,
        SpecT,
        StatusT,
        INamespacedResource<MetadataT, SpecT, StatusT>,
        KindT,
        ApiVersionT
      >(
        class extends NamespacedResource<MetadataT, SpecT, StatusT, KindT, ApiVersionT> {
          static kind = kind;

          protected static apiPlural = apiPlural;

          static apiVersion = `${apiGroup}/${apiVersion}`;
        },
      );

      return resultClass as Scope extends "Namespaced" ? typeof resultClass : never;
    }

    const resultClass = wrapResource<
      MetadataT,
      SpecT,
      StatusT,
      IResource<MetadataT, SpecT, StatusT>,
      KindT,
      ApiVersionT
    >(
      class extends Resource<MetadataT, SpecT, StatusT, KindT, ApiVersionT> {
        static kind = kind;

        protected static apiPlural = apiPlural;

        static apiVersion = `${apiGroup}/${apiVersion}`;
      },
    );

    return resultClass as Scope extends "Namespaced" ? never : typeof resultClass;
  }

  addConversion<
    SourceClassT extends { apiVersion: string; new (...args: any[]): any },
    TargetClassT extends { apiVersion: string; new (...args: any[]): any }
  >(
    sourceClass: SourceClassT,
    targetClass: TargetClassT,
    conversor: (obj: InstanceType<SourceClassT>) => InstanceType<TargetClassT>,
  ) {
    let sourceEdge = this.config.conversions.get(sourceClass.apiVersion);

    if (!sourceEdge) {
      sourceEdge = new Map<string, (obj: any) => any>();
      this.config.conversions.set(sourceClass.apiVersion, sourceEdge);
    }

    sourceEdge.set(targetClass.apiVersion, conversor);
  }
}
