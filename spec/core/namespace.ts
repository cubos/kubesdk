import "jest-extended";
import {
  ClusterConnection,
  KubernetesError,
} from "../../src/base/ClusterConnection";
import { Namespace } from "../../src/core/Namespace";
import { expectThrows } from "../utils";

const cluster = new ClusterConnection();

describe("Namespace", () => {
  test("get", async () => {
    await cluster.use(async () => {
      const ns = await Namespace.get("kube-system");
      expect(ns.metadata.name).toBe("kube-system");
    });
  });

  test("get non existing", async () => {
    await cluster.use(async () => {
      await expectThrows(
        Namespace.get("foo"),
        KubernetesError.NotFound,
        `namespaces "foo" not found`
      );
    });
  });

  test("create and delete", async () => {
    await cluster.use(async () => {
      const namespace = await Namespace.create({ generateName: "test-" });
      const name = namespace.metadata.name;
      expect(namespace.status.phase).toBe("Active");
      const deleted = await namespace.delete();
      expect(deleted.status.phase).toBe("Terminating");
    });
  });

  test("delete non existing", async () => {
    await cluster.use(async () => {
      await expectThrows(
        Namespace.delete("foo"),
        KubernetesError.NotFound,
        `namespaces "foo" not found`
      );
    });
  });

  test("list", async () => {
    await cluster.use(async () => {
      const list = await Namespace.list();
      const names = list.map((ns) => ns.metadata.name);
      expect(names).toContain("kube-system");
      expect(names).toContain("kube-public");
      expect(names).toContain("default");
      expect(list.length).toBeGreaterThan(3);
    });
  });

  test("list with limit", async () => {
    await cluster.use(async () => {
      const list = await Namespace.list({ limit: 2 });
      expect(list.length).toBe(2);
    });
  });

  test("create, get, list, apply and delete", async () => {
    await cluster.use(async () => {
      const original = await Namespace.create({ generateName: "test-" });
      const name = original.metadata.name;
      expect(name).toStartWith("test-");
      expect(await Namespace.get(name)).toStrictEqual(original);
      expect(await Namespace.list()).toContainEqual(original);

      const modified = await Namespace.apply({
        name: name,
        labels: { foo: name },
      });
      expect(modified.metadata.resourceVersion).not.toBe(
        original.metadata.resourceVersion
      );
      expect(modified.metadata.labels).toEqual({ foo: name });
      expect(await Namespace.get(name)).toStrictEqual(modified);
      expect(await Namespace.list()).toContainEqual(modified);
      expect(await Namespace.list()).not.toContainEqual(original);
      expect(
        await Namespace.list({
          selector: { matchLabels: { foo: name } },
        })
      ).toStrictEqual([modified]);

      await expectThrows(original.delete(), KubernetesError.Conflict);

      const deleted = await modified.delete();
      expect(deleted.status.phase).toBe("Terminating");
    });
  });
});
