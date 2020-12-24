import { randomBytes } from "crypto";
import { hostname } from "os";

import { Endpoints } from "../core/Endpoints";
import { sleep } from "../utils";
import { ClusterConnection } from "./ClusterConnection";
import { KubernetesError } from "./KubernetesError";

export class LeaderElection {
  private myId = `${hostname()}-${randomBytes(8).toString("hex")}`;

  private electionName: string;

  private ttl: number;

  private namespace: string;

  constructor(electionId: string, { ttl, namespace }: { ttl?: number; namespace?: string } = {}) {
    this.electionName = `election-${electionId}`;
    this.ttl = ttl ?? 10_000;
    this.namespace = namespace ?? ClusterConnection.current().namespace;
  }

  async ensureLeader(): Promise<undefined>;

  async ensureLeader(timeout: number): Promise<boolean>;

  async ensureLeader(timeout?: number): Promise<boolean | undefined> {
    const start = new Date();

    for (;;) {
      try {
        let ref;

        try {
          ref = await Endpoints.get(this.namespace, this.electionName);
        } catch (err) {
          if (err instanceof KubernetesError.NotFound) {
            ref = await Endpoints.create({
              namespace: this.namespace,
              name: this.electionName,
              annotations: {
                leaderId: this.myId,
                heartbeat: new Date().toISOString(),
              },
            });
          } else {
            throw err;
          }
        }

        const heartbeat = new Date(ref.metadata.annotations?.heartbeat ?? "");
        const age = new Date().getTime() - heartbeat.getTime();
        const isMe = ref.metadata.annotations?.leaderId === this.myId;

        if (isNaN(heartbeat.getTime()) || (isMe && age > this.ttl / 3) || age > this.ttl) {
          ref.metadata.annotations = {
            ...(ref.metadata.annotations ?? {}),
            leaderId: this.myId,
            heartbeat: new Date().toISOString(),
          };

          await ref.save();
          return true;
        }

        if (isMe) {
          return true;
        }

        if (timeout === undefined) {
          return undefined;
        }

        const maxSleep = timeout - (new Date().getTime() - start.getTime());

        await sleep(Math.min(maxSleep, this.ttl / 6));
      } catch (err) {
        if (!(err instanceof KubernetesError.Conflict)) {
          throw err;
        }

        if (timeout === undefined) {
          return undefined;
        }

        const maxSleep = timeout - (new Date().getTime() - start.getTime());

        await sleep(Math.min(maxSleep, this.ttl / 12));
      }

      if (timeout < new Date().getTime() - start.getTime()) {
        return false;
      }
    }
  }
}
