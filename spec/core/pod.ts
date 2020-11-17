import "jest-extended";
import { Pod } from "../../src/core/Pod";

describe("Pod", () => {
  test("exec", async () => {
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
      },
    );

    for await (const eventType of pod.watch()) {
      expect(eventType).not.toBe("DELETED");
      if (pod.status.phase !== "Pending") {
        break;
      }
    }

    expect(pod.status.phase).toBe("Running");

    const { stdout, stderr } = await pod.exec("base", ["echo", "hello!"]);

    expect(stdout.toString()).toBe("hello!\n");
    expect(stderr).toHaveLength(0);

    await pod.delete();
  });
});
