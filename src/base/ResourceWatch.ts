import type { ClusterConnection, WatchStream } from "./ClusterConnection";
import type { IResource } from "./Resource";

type InternalWatchEvent<T extends IResource<unknown, unknown, unknown>> =
  | { type: "ADDED"; object: T }
  | { type: "MODIFIED"; object: T }
  | { type: "DELETED"; object: T }
  | { type: "BOOKMARK"; object: { kind: string; apiVersion: string; metadata: { resourceVersion: string } } }
  | { type: "ERROR"; object: unknown };

type WatchEvent<T extends IResource<unknown, unknown, unknown>> =
  | { type: "ADDED"; object: T }
  | { type: "MODIFIED"; object: T }
  | { type: "DELETED"; object: T };

export class ResourceWatch<T extends IResource<unknown, unknown, unknown>>
  implements AsyncGenerator<WatchEvent<T>, undefined> {
  private lastSeemResourceVersion: string | undefined;

  private closed = false;

  private stream: WatchStream | undefined;

  private streamIterator: AsyncIterator<InternalWatchEvent<T>, undefined> | undefined;

  constructor(
    private conn: ClusterConnection,
    private url: string,
    private parseFunction: (object: object) => T | Promise<T>,
  ) {}

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<IteratorResult<WatchEvent<T>, undefined>> {
    if (this.closed) {
      return { done: true, value: undefined };
    }

    if (this.stream === undefined || this.streamIterator === undefined) {
      this.stream = await this.conn.watch(this.url, this.lastSeemResourceVersion);
      this.streamIterator = this.stream[Symbol.asyncIterator]();
    }

    let result;

    try {
      result = await this.streamIterator.next();
    } catch (err) {
      this.stream.destroy();
      this.stream = undefined;
      this.streamIterator = undefined;
      return this.next();
    }

    if (result.done === true) {
      this.close();
      return { done: result.done, value: undefined };
    }

    if (result.value.type === "ERROR") {
      throw result.value.object;
    }

    this.lastSeemResourceVersion = result.value.object.metadata.resourceVersion;

    if (result.value.type === "BOOKMARK") {
      return this.next();
    }

    if (result.value.type === "DELETED") {
      this.close();
    }

    return {
      done: false,
      value: { type: result.value.type, object: await this.parseFunction(result.value.object) },
    };
  }

  async return() {
    this.close();
    return Promise.resolve({ done: true, value: undefined } as const);
  }

  async throw() {
    this.close();
    return Promise.resolve({ done: true, value: undefined } as const);
  }

  close() {
    this.closed = true;
    this.stream?.destroy();
    this.stream = undefined;
    this.streamIterator = undefined;
  }
}
