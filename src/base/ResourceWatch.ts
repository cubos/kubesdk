import { ClusterConnection, WatchStream } from "./ClusterConnection";
import { IResource } from "./Resource";

type InternalWatchNotification<T extends IResource<unknown, unknown, unknown>> =
  | { type: "ADDED"; object: T }
  | { type: "MODIFIED"; object: T }
  | { type: "DELETED"; object: T }
  | { type: "BOOKMARK"; object: { kind: string; apiVersion: string; metadata: { resourceVersion: string } } };

type WatchNotification<T extends IResource<unknown, unknown, unknown>> =
  | { type: "ADDED"; object: T }
  | { type: "MODIFIED"; object: T }
  | { type: "DELETED"; object: T };

export class ResourceWatch<T extends IResource<unknown, unknown, unknown>> implements AsyncIterable<T | null> {
  public lastSeemResourceVersion: string | undefined;

  private stream: WatchStream | undefined;

  private closed = false;

  private streamIterator: AsyncIterator<InternalWatchNotification<T>, undefined> | undefined;

  public uid: string | undefined;

  constructor(
    private conn: ClusterConnection,
    private url: string,
    public parseFunction: (object: object) => Promise<T>,
  ) {}

  [Symbol.asyncIterator](): AsyncIterator<T | null, undefined> {
    return {
      next: async () => {
        if (this.closed) {
          return { done: true, value: undefined };
        }

        if (this.stream === undefined || this.streamIterator === undefined) {
          this.stream = await this.conn.watch(this.url, this.lastSeemResourceVersion);
          this.streamIterator = this.stream[Symbol.asyncIterator]();
        }

        try {
          const result = await this.streamIterator.next();

          if (result.done === true) {
            this.close();
            return { done: result.done, value: undefined };
          }

          this.lastSeemResourceVersion = result.value.object.metadata.resourceVersion;

          if (result.value.type === "BOOKMARK") {
            return this[Symbol.asyncIterator]().next();
          }

          if (result.value.type === "DELETED" || (this.uid && result.value.object.metadata.uid !== this.uid)) {
            this.close();
            return {
              done: false,
              value: null,
            };
          }

          return {
            done: false,
            value: await this.parseFunction(result.value.object),
          };
        } catch (err) {
          this.stream.destroy();
          this.stream = undefined;
          this.streamIterator = undefined;
          return this[Symbol.asyncIterator]().next();
        }
      },
      return: async () => {
        this.close();
        return Promise.resolve({ done: true, value: undefined });
      },
      throw: async () => {
        this.close();
        return Promise.resolve({ done: true, value: undefined });
      },
    }; // as { next(): Promise<IteratorResult<T, undefined>> };
  }

  close() {
    this.closed = true;
    this.stream?.destroy();
    this.stream = undefined;
    this.streamIterator = undefined;
  }
}
