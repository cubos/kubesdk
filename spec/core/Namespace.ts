import "jest-extended";
import { KubernetesError } from "../../src/base/KubernetesError";
import { Namespace } from "../../src/core/Namespace";
import { expectThrows } from "../utils";

describe("Namespace", () => {
  test.concurrent("get", async () => {
    const ns = await Namespace.get("kube-system");

    expect(ns.metadata.name).toBe("kube-system");
  });

  test.concurrent("get non existing", async () => {
    await expectThrows(Namespace.get("foo"), KubernetesError.NotFound, `namespaces "foo" not found`);
  });

  test.concurrent("create and delete", async () => {
    const namespace = await Namespace.create({ generateName: "test-" });

    expect(namespace.status.phase).toBe("Active");
    const deleted = await namespace.delete();

    expect(deleted.status.phase).toBe("Terminating");
  });

  test.concurrent("delete non existing", async () => {
    await expectThrows(Namespace.delete("foo"), KubernetesError.NotFound, `namespaces "foo" not found`);
  });

  test.concurrent("list", async () => {
    const list = await Namespace.list();
    const names = list.map(ns => ns.metadata.name);

    expect(names).toContain("kube-system");
    expect(names).toContain("kube-public");
    expect(names).toContain("default");
    expect(list.length).toBeGreaterThan(3);
  });

  test.concurrent("list with limit", async () => {
    const list = await Namespace.list({ limit: 2 });

    expect(list.length).toBe(2);
  });

  test.concurrent("create, get, list, apply and delete", async () => {
    const original = await Namespace.create({ generateName: "test-" });
    const { name } = original.metadata;

    expect(name).toStartWith("test-");
    expect(await Namespace.get(name)).toStrictEqual(original);
    expect(await Namespace.list()).toContainEqual(original);

    const modified = await Namespace.apply({
      name,
      labels: { foo: name },
    });

    expect(modified.metadata.resourceVersion).not.toBe(original.metadata.resourceVersion);
    expect(modified.metadata.labels).toEqual({ foo: name });
    expect(await Namespace.get(name)).toStrictEqual(modified);
    expect(await Namespace.list()).toContainEqual(modified);
    expect(await Namespace.list()).not.toContainEqual(original);
    expect(
      await Namespace.list({
        selector: { matchLabels: { foo: name } },
      }),
    ).toStrictEqual([modified]);

    await expectThrows(original.delete(), KubernetesError.Conflict);

    const deleted = await modified.delete();

    expect(deleted.status.phase).toBe("Terminating");
  });

  test.concurrent("optimistic concurrency", async () => {
    const original = await Namespace.create({ generateName: "test-" });
    const { name } = original.metadata;
    const another = await Namespace.get(name);

    original.metadata.annotations = { hi: "there" };
    await original.save();

    expect(original.metadata.resourceVersion).not.toBe(another.metadata.resourceVersion);
    expect(await Namespace.get(name)).toMatchObject({
      metadata: { annotations: { hi: "there" } },
    });

    another.metadata.annotations = { hello: "here" };
    await expectThrows(another.save(), KubernetesError.Conflict);
    await another.reload();
    expect(another).toMatchObject({
      metadata: { annotations: { hi: "there" } },
    });
    await another.delete();
  });

  /*
   * test.concurrent("watch", async () => {
   *   const ns = await Namespace.create({ generateName: "test-" });
   */

  //   const watch = ns.watch()[Symbol.asyncIterator]();

  //   expect(await watch.next()).toMatchObject({ value: { type: "ADDED", object: ns } });

  //   await ns.delete();

  /*
   *   await watch.next();
   *   await watch.next();
   */

  //   expect(await watch.next()).toMatchObject({ value: { type: "ADDED", object: ns } });

  /*
   *   await watch.return?.();
   * });
   */
});
