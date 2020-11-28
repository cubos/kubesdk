import { randomBytes } from "crypto";
import "jest-extended";
import { LeaderElection } from "../../src/base/LeaderElection";
import { CancelToken, sleep } from "../../src/utils";

describe("LeaderElection", () => {
  test.concurrent("becomes a leader quickly", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election = new LeaderElection(electionId);

    await expect(Promise.race([election.ensureLeader(), sleep(2000).then(() => "fail")])).resolves.not.toBe("fail");
  });

  test.concurrent("holds leadership", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election1 = new LeaderElection(electionId, 1000);
    const election2 = new LeaderElection(electionId, 1000);

    for (let i = 0; i < 2; ++i) {
      await election1.ensureLeader();
      const cancelToken = new CancelToken();

      await expect(Promise.race([election2.ensureLeader(cancelToken), sleep(800).then(() => "ok")])).resolves.toBe(
        "ok",
      );
      cancelToken.cancel();
    }

    await sleep(1000);
    await expect(Promise.race([election2.ensureLeader(), sleep(2000).then(() => "fail")])).resolves.not.toBe("fail");

    const cancelToken = new CancelToken();

    await expect(Promise.race([election1.ensureLeader(cancelToken), sleep(800).then(() => "ok")])).resolves.toBe("ok");
    cancelToken.cancel();
  });
});
