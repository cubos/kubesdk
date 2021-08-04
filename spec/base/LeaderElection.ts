import { randomBytes } from "crypto";

import "jest-extended";
import { Namespace } from "../../src";
import { LeaderElection } from "../../src/base/LeaderElection";

describe("LeaderElection", () => {
  const namespace = randomBytes(8).toString("hex");

  beforeAll(async () => {
    await Namespace.create({
      name: namespace,
    });
  });

  afterAll(async () => {
    await Namespace.delete(namespace);
  });

  test("becomes a leader quickly", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election = new LeaderElection(electionId, { namespace });

    expect(await election.ensureLeader(200)).toBeTrue();
  });

  test("holds leadership", async () => {
    const electionId = randomBytes(8).toString("hex");

    const election1 = new LeaderElection(electionId, { namespace, ttl: 2000 });
    const election2 = new LeaderElection(electionId, { namespace, ttl: 2000 });

    for (let i = 0; i < 2; ++i) {
      await election1.ensureLeader();
      expect(await election2.ensureLeader(1000)).toBeFalse();
    }

    expect(await election2.ensureLeader(4000)).toBeTrue();
    expect(await election1.ensureLeader(1000)).toBeFalse();
  });
});
