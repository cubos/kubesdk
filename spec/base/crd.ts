import { randomBytes } from "crypto";

import "jest-extended";
import { Controller, CustomResourceController, Namespace } from "../../src";
import { sleep } from "../../src/utils";

describe("CRD", () => {
  const namespace = randomBytes(8).toString("hex");

  beforeAll(async () => {
    await Namespace.create({
      name: namespace,
    });
  });

  afterAll(async () => {
    await Namespace.delete(namespace, { wait: false });
  });

  test("creates basic CRD", async () => {
    const name = randomBytes(8).toString("hex");
    const controller = new Controller(name);

    const crd = new CustomResourceController({
      group: "kubesdk.io",
      kind: `Test${name}`,
      plural: `test${name}s`,
      scope: "Namespaced",
    });

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TestV1 = crd.addVersion({
      name: "v1",
      schema: {
        type: "object",
        required: ["spec"],
        properties: {
          spec: {
            type: "object",
            properties: {
              something: { type: "string" },
            },
          },
        },
      } as const,
      served: true,
      storage: true,
    });

    // Workaround for https://github.com/microsoft/TypeScript/issues/41406
    // Typing is correct and "as any" shouldn't be needed.
    controller.addCrd(crd);

    await controller.install({
      image: "busybox",
      namespace,
    });

    await sleep(100);

    expect(await TestV1.list()).toHaveLength(0);

    const rand = randomBytes(8).toString("hex");

    await TestV1.apply(
      {
        name,
        namespace,
      },
      {
        something: rand,
      },
    );

    const list = await TestV1.list();

    expect(list).toHaveLength(1);
    expect(list[0].spec.something).toBe(rand);

    await list[0].delete();

    await controller.uninstall({ namespace });
  });
});
