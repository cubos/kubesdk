import { Writable } from "stream";
import WebSocket from "ws";
import { KubernetesError } from "./KubernetesError";

export interface ExecOptions {
  stdout?: (chunk: Buffer) => void;
  stderr?: (chunk: Buffer) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class Exec {
  readonly stdin: Writable;

  constructor(private ws: WebSocket, options: ExecOptions) {
    ws.on("message", (msg) => {
      const buf = Array.isArray(msg) ? Buffer.concat(msg) : Buffer.from(msg);
      if (buf.length <= 1) {
        return;
      }

      switch (buf[0]) {
        case 1:
          options.stdout?.(buf.slice(1));
          break;
        case 2:
          options.stderr?.(buf.slice(1));
          break;
        case 3:
          const status = JSON.parse(buf.slice(1).toString());
          if (status.status !== "Success") {
            options.onError(KubernetesError.fromStatus(status));
          }
          break;
      }
    });

    ws.on("error", (err) => {
      options.onError(err);
    });

    ws.on("close", () => {
      options.onClose();
    });

    this.stdin = new Writable({
      write(chunk, encoding, callback) {
        ws.send(
          Buffer.concat([Buffer.of(0), Buffer.from(chunk, encoding)]),
          callback
        );
      },
    });
  }

  close() {
    this.ws.close();
  }

  static asPromise(ws: WebSocket) {
    return new Promise<{
      stdout: Buffer;
      stderr: Buffer;
    }>((resolve, reject) => {
      let stdout: Buffer[] = [];
      let stderr: Buffer[] = [];
      let failed = false;
      new Exec(ws, {
        onError: (err) => {
          failed = true;
          reject(err);
        },
        onClose: () => {
          if (!failed)
            resolve({
              stdout: Buffer.concat(stdout),
              stderr: Buffer.concat(stderr),
            });
        },
        stdout: (chunk) => stdout.push(chunk),
        stderr: (chunk) => stderr.push(chunk),
      });
    });
  }
}
