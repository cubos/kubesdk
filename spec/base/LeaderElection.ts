import { randomBytes } from "crypto";
import "jest-extended";
import { LeaderElection } from "../../src/base/LeaderElection";

describe("LeaderElection", () => {
  test.concurrent("becomes a leader quickly", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election = new LeaderElection(electionId);

    expect(await election.ensureLeader(200)).toBeTrue();
  });

  test.concurrent("holds leadership", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election1 = new LeaderElection(electionId, 1000);
    const election2 = new LeaderElection(electionId, 1000);

    for (let i = 0; i < 2; ++i) {
      await election1.ensureLeader();
      expect(await election2.ensureLeader(500)).toBeFalse();
    }

    expect(await election2.ensureLeader(2000)).toBeTrue();
    expect(await election1.ensureLeader(200)).toBeFalse();
  });
});
