import "jest-extended";
import { ClusterConnection } from "../../src/base/ClusterConnection";
import { Pod } from "../../src/core/Pod";
import { sleep } from "../../src/utils";

const cluster = new ClusterConnection();

describe("Pod", () => {
  test("exec", async () => {
    await cluster.use(async () => {
      const pod = await Pod.apply(
        {
          name: "exec-target",
          namespace: "default",
        },
        {
          containers: [
            {
              name: "base",
              image: "busybox",
              command: ["sleep", "999d"],
              imagePullPolicy: "IfNotPresent",
            },
          ],
        }
      );

      while (pod.status.phase === "Pending") {
        await sleep(300);
        await pod.reload();
      }

      expect(pod.status.phase).toBe("Running");

      const { stdout, stderr } = await pod.exec("base", ["echo", "hello!"]);
      expect(stdout.toString()).toBe("hello!\n");
      expect(stderr).toHaveLength(0);
    });
  });
});
