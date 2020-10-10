import { ClusterConnection } from "../../src/base/ClusterConnection";
import { Namespace } from "../../src/core/Namespace";

const cluster = new ClusterConnection();

describe("Namespace", () => {
  test("get", async () => {
    await cluster.use(async () => {
      const ns = await Namespace.get("kube-system");
      expect(ns.metadata.name).toBe("kube-system");
    });
  });
});
