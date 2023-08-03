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

export class ResourceListWatch<T extends IResource<unknown, unknown, unknown>>
  implements AsyncGenerator<WatchEvent<T>, undefined>
{
  private knownList = new Map<string, T>();

  private eventBuffer: Array<WatchEvent<T>> = [];

  private closed = false;

  private stream: WatchStream | undefined;

  private streamIterator: AsyncIterator<InternalWatchEvent<T>, undefined> | undefined;

  constructor(
    private conn: ClusterConnection,
    private url: string,
    private parseFunction: (object: object) => T | Promise<T>,
  ) {}

  [Symbol.asyncIterator](signal?: AbortSignal) {
    signal?.addEventListener("abort", this.close.bind(this));
    return this;
  }

  async next(): Promise<IteratorResult<WatchEvent<T>, undefined>> {
    if (this.closed) {
      return { done: true, value: undefined };
    }

    if (!this.stream || !this.streamIterator) {
      const list: {
        kind: string;
        apiVersion: string;
        metadata: {
          resourceVersion: string;
        };
        items: object[];
      } = await this.conn.get(this.url.replace("/watch/", "/"));

      if (!list.kind.endsWith("List")) {
        throw new Error(`Expected ${list.kind} to end with 'List'`);
      }

      const innerKind = list.kind.replace(/List$/u, "");
      const seen = new Set<string>();

      for (const item of list.items) {
        const object = await this.parseFunction({
          kind: innerKind,
          apiVersion: list.apiVersion,
          ...item,
        });
        const { uid } = object.metadata;

        seen.add(uid);

        const existingObject = this.knownList.get(uid);

        if (existingObject) {
          if (JSON.stringify(existingObject) !== JSON.stringify(object)) {
            this.eventBuffer.push({ type: "MODIFIED", object });
            this.knownList.set(uid, object);
          }
        } else {
          this.eventBuffer.push({ type: "ADDED", object });
          this.knownList.set(uid, object);
        }
      }

      for (const [uid, object] of this.knownList) {
        if (!seen.has(uid)) {
          this.knownList.delete(uid);
          this.eventBuffer.push({ type: "DELETED", object });
        }
      }

      this.stream = await this.conn.watch(this.url, list.metadata.resourceVersion);
      this.streamIterator = this.stream[Symbol.asyncIterator]();
    }

    const bufferedEvent = this.eventBuffer.shift();

    if (bufferedEvent) {
      return { done: false, value: bufferedEvent };
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

    if (result.value.type === "BOOKMARK") {
      return this.next();
    }

    if (result.value.type === "DELETED") {
      this.knownList.delete(result.value.object.metadata.uid);
    } else {
      this.knownList.set(result.value.object.metadata.uid, result.value.object);
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

  private close() {
    this.closed = true;
    this.stream?.destroy();
    this.stream = undefined;
    this.streamIterator = undefined;
  }
}
