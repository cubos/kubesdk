import { randomBytes } from "crypto";
import "jest-extended";
import { LeaderElection } from "../../src/base/LeaderElection";
import { sleep } from "../../src/utils";

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
      expect(await election2.ensureLeader(500)).toBeFalse();
    }

    await sleep(1000);
    await expect(Promise.race([election2.ensureLeader(), sleep(2000).then(() => "fail")])).resolves.not.toBe("fail");

    expect(await election1.ensureLeader(500)).toBeFalse();
  });
});
