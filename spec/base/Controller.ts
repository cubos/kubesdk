import { randomBytes } from "crypto";
import "jest-extended";
import { Controller, Namespace } from "../../src";

describe("Controller", () => {
  const namespace = randomBytes(8).toString("hex");

  beforeAll(async () => {
    await Namespace.create({
      name: namespace,
    });
  });

  afterAll(async () => {
    await Namespace.delete(namespace);
  });

  test.concurrent("does empty install", async () => {
    const name = randomBytes(8).toString("hex");
    const controller = new Controller(name);

    expect(await controller.installList()).toEqual([]);
  });

  test.concurrent("does basic install", async () => {
    const name = randomBytes(8).toString("hex");
    const controller = new Controller(name);

    controller.attachClusterPolicyRules([
      {
        apiGroups: [""],
        resources: ["namespaces", "pods"],
        verbs: ["list"],
      },
    ]);

    const cronFn = jest.fn();

    const cronName = randomBytes(8).toString("hex");

    controller.addCronJob(cronName, "* * * * *", cronFn);

    expect(await controller.installList()).toEqual([
      { kind: "ServiceAccount", name },
      { kind: "ClusterRole", name },
      { kind: "ClusterRoleBinding", name },
      { kind: "CronJob", name: `${name}-${cronName}` },
    ]);

    expect(cronFn.mock.calls.length).toBe(0);
    await controller.run("cronjob", cronName);
    expect(cronFn.mock.calls.length).toBe(1);
  });
});
