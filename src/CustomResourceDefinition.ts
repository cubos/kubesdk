import { CustomResource } from "./CustomResource";

export class CustomResourceDefinition {
  constructor(
    metadata: {},
    spec: {
      controller: typeof CustomResource;
    }
  ) {}
}
