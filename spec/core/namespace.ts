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
});
