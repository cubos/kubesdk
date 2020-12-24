import { randomBytes } from "crypto";

import "jest-extended";
import { Controller, KubernetesError, Namespace, ServiceAccount } from "../../src";

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

    expect(await controller.installList(namespace)).toEqual([]);
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

    expect(await controller.installList(namespace)).toEqual([
      { kind: "ServiceAccount", name },
      { kind: "ClusterRole", name: `${name}-${namespace}` },
      { kind: "ClusterRoleBinding", name: `${name}-${namespace}` },
      { kind: "CronJob", name: `${name}-${cronName}` },
    ]);

    expect(cronFn.mock.calls.length).toBe(0);
    await controller.run("cronjob", cronName);
    expect(cronFn.mock.calls.length).toBe(1);
  });

  test.concurrent("can double install", async () => {
    const name = randomBytes(8).toString("hex");
    const controller = new Controller(name);

    await controller.install({
      image: "busybox",
      namespace,
    });

    await controller.install({
      image: "busybox",
      namespace,
    });
  });

  test.concurrent("installs and uninstalls", async () => {
    const name = randomBytes(8).toString("hex");
    const controller = new Controller(name);

    controller.attachClusterPolicyRules([
      {
        apiGroups: [""],
        resources: ["namespaces", "pods"],
        verbs: ["list"],
      },
    ]);

    await controller.install({
      image: "busybox",
      namespace,
    });

    expect(await ServiceAccount.get(namespace, name)).toBeObject();

    await controller.uninstall({
      namespace,
    });

    await expect(ServiceAccount.get(namespace, name)).rejects.toThrowError(KubernetesError.NotFound);
  });
});
