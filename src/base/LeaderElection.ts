import { randomBytes } from "crypto";
import { hostname } from "os";
import { Endpoints } from "../core/Endpoints";
import { CancelToken, sleep } from "../utils";
import { ClusterConnection } from "./ClusterConnection";
import { KubernetesError } from "./KubernetesError";

export class LeaderElection {
  private myId = `${hostname()}-${randomBytes(8).toString("hex")}`;

  private electionName: string;

  constructor(electionId: string, private ttl = 10_000) {
    this.electionName = `election-${electionId}`;
  }

  async ensureLeader(cancelToken?: CancelToken) {
    while (!cancelToken?.isCanceled) {
      try {
        let ref;

        try {
          ref = await Endpoints.get(ClusterConnection.current().namespace, this.electionName);
        } catch (err) {
          if (err instanceof KubernetesError.NotFound) {
            ref = await Endpoints.create({
              namespace: ClusterConnection.current().namespace,
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
          return;
        }

        if (isMe) {
          return;
        }

        await sleep(this.ttl / 6);
      } catch (err) {
        if (!(err instanceof KubernetesError.Conflict)) {
          throw err;
        }

        await sleep(this.ttl / 12);
      }
    }
  }
}
