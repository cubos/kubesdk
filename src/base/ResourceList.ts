import type { LabelSelector } from "../core/types";
import { ClusterConnection } from "./ClusterConnection";
import type { IResource } from "./Resource";
import { ResourceListWatch } from "./ResourceListWatch";

type SelectableFields<KindT, IsNamespaced extends boolean> = KindT extends "Event"
  ?
      | "involvedObject.kind"
      | "involvedObject.namespace"
      | "involvedObject.name"
      | "involvedObject.uid"
      | "involvedObject.apiVersion"
      | "involvedObject.resourceVersion"
      | "involvedObject.fieldPath"
      | "reason"
      | "reportingComponent"
      | "source"
      | "type"
      | "metadata.namespace"
      | "metadata.name"
  : KindT extends "Namespace"
  ? "status.phase" | "metadata.name"
  : KindT extends "Secret"
  ? "metadata.namespace" | "metadata.name"
  : KindT extends "Node"
  ? "metadata.name" | "spec.unschedulable"
  : KindT extends "ReplicationController"
  ? "metadata.name" | "metadata.namespace" | "status.replicas"
  : KindT extends "Pod"
  ?
      | "metadata.name"
      | "metadata.namespace"
      | "spec.nodeName"
      | "spec.restartPolicy"
      | "spec.schedulerName"
      | "spec.serviceAccountName"
      | "status.phase"
      | "status.podIP"
      | "status.podIPs"
      | "status.nominatedNodeName"
  : KindT extends "Job"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : KindT extends "CronJob"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : KindT extends "CertificateSigningRequest"
  ? "metadata.name" | "spec.signerName"
  : KindT extends "StatefulSet"
  ? "metadata.name" | "metadata.namespace" | "status.successful"
  : IsNamespaced extends true
  ? "metadata.name" | "metadata.namespace"
  : "metadata.name";

export type ListSelector<KindT, IsNamespaced extends boolean> = LabelSelector & {
  matchFields?: Record<SelectableFields<KindT, IsNamespaced>, string>;
  doesntMatchFields?: Record<SelectableFields<KindT, IsNamespaced>, string>;
};

function selectorToQueryObject(selector?: ListSelector<string, boolean>) {
  const qs = new URLSearchParams();

  const labelSelector: string[] = [];

  if (selector?.matchLabels) {
    for (const [key, value] of Object.entries(selector.matchLabels)) {
      labelSelector.push(`${key}=${value}`);
    }
  }

  if (selector?.matchExpressions) {
    for (const expression of selector.matchExpressions) {
      switch (expression.operator) {
        case "Exists":
          labelSelector.push(`${expression.key}`);
          break;
        case "DoesNotExist":
          labelSelector.push(`!${expression.key}`);
          break;
        case "In":
          labelSelector.push(`${expression.key} in (${expression.values.join(",")})`);
          break;
        case "NotIn":
          labelSelector.push(`${expression.key} notin (${expression.values.join(",")})`);
          break;
        default:
          // Never
          break;
      }
    }
  }

  if (labelSelector.length > 0) {
    qs.append("labelSelector", labelSelector.join(","));
  }

  const fieldSelector: string[] = [];

  if (selector?.matchFields) {
    for (const [key, value] of Object.entries(selector.matchFields)) {
      fieldSelector.push(`${key}==${value}`);
    }
  }

  if (selector?.doesntMatchFields) {
    for (const [key, value] of Object.entries(selector.doesntMatchFields)) {
      fieldSelector.push(`${key}!=${value}`);
    }
  }

  if (fieldSelector.length > 0) {
    qs.append("fieldSelector", fieldSelector.join(","));
  }

  return qs;
}

class ResourceListIterator<T extends IResource<unknown, unknown, unknown>> implements AsyncGenerator<T, undefined> {
  private items: T[] = [];

  private continue?: string;

  public resourceVersion: string;

  private started = false;

  constructor(
    private klass: {
      isNamespaced: boolean;
      kind: string;
      apiVersion: string;
      apiPlural: string;
      hasInlineSpec: boolean;
      fromRawObject(o: object): T;
    },
    private namespace?: string,
    private selector?: ListSelector<string, boolean>,
    private pageSize?: number,
    resourceVersion?: string,
  ) {
    this.resourceVersion = resourceVersion ?? "";
  }

  async next(): Promise<IteratorResult<T, undefined>> {
    const element = this.items.shift();

    if (element) {
      return Promise.resolve({ done: false, value: element } as const);
    }

    if (this.started && !this.continue) {
      return Promise.resolve({ done: true, value: undefined } as const);
    }

    const base = this.klass.apiVersion.includes("/") ? `apis` : "api";
    const apiUrl = `/${base}/${this.klass.apiVersion}/${
      this.klass.isNamespaced && this.namespace ? `namespaces/${encodeURIComponent(this.namespace)}/` : ``
    }${this.klass.apiPlural}`;

    const qs = selectorToQueryObject(this.selector);

    qs.append("limit", `${this.pageSize ?? 50}`);

    if (this.continue) {
      qs.append("continue", `${this.continue}`);
    }

    if (this.resourceVersion) {
      qs.append("resourceVersion", `${this.resourceVersion}`);
    }

    const conn = ClusterConnection.current();
    const list: {
      kind: string;
      apiVersion: string;
      metadata: {
        resourceVersion: string;
        continue?: string;
      };
      items: object[];
    } = await conn.get(`${apiUrl}?${qs.toString()}`);

    if (list.kind !== `${this.klass.kind}List` || list.apiVersion !== this.klass.apiVersion) {
      throw new Error(
        `Expected to receive ${this.klass.apiVersion} ${this.klass.kind}List, but got ${list.apiVersion} ${list.kind}`,
      );
    }

    this.resourceVersion = list.metadata.resourceVersion;
    this.continue = list.metadata.continue;
    this.items = list.items.map(raw =>
      this.klass.fromRawObject({
        kind: this.klass.kind,
        apiVersion: this.klass.apiVersion,
        ...raw,
      }),
    );
    this.started = true;

    return this.next();
  }

  async return(): Promise<IteratorResult<T, undefined>> {
    this.close();
    return Promise.resolve({ done: true, value: undefined } as const);
  }

  async throw(): Promise<IteratorResult<T, undefined>> {
    this.close();
    return Promise.resolve({ done: true, value: undefined } as const);
  }

  close() {
    this.items = [];
    this.continue = undefined;
    this.started = true;
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, undefined> {
    return this;
  }
}

export class ResourceList<T extends IResource<unknown, unknown, unknown>> extends Array<T> {
  public resourceVersion = "";
}

export class AsyncResourceList<T extends IResource<unknown, unknown, unknown>> implements PromiseLike<ResourceList<T>> {
  constructor(
    private klass: {
      isNamespaced: boolean;
      kind: string;
      apiVersion: string;
      apiPlural: string;
      hasInlineSpec: boolean;
      fromRawObject(o: object): T;
    },
    private namespace?: string,
    private selector?: ListSelector<string, boolean>,
    private pageSize?: number,
    private resourceVersion?: string,
  ) {}

  then<TResult1 = ResourceList<T>, TResult2 = never>(
    onfulfilled?: ((value: ResourceList<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.toArray().then(onfulfilled, onrejected);
  }

  async toArray() {
    const list = new ResourceList<T>();
    const it = this[Symbol.asyncIterator]();

    for await (const element of it) {
      list.push(element);
    }

    list.resourceVersion = it.resourceVersion;

    return list;
  }

  watch() {
    const base = this.klass.apiVersion.includes("/") ? `apis` : "api";
    const apiUrl = `/${base}/${this.klass.apiVersion}/watch/${
      this.klass.isNamespaced && this.namespace ? `namespaces/${encodeURIComponent(this.namespace)}/` : ``
    }${this.klass.apiPlural}`;

    const qs = selectorToQueryObject(this.selector);

    if (this.resourceVersion) {
      qs.append("resourceVersion", `${this.resourceVersion}`);
    }

    const conn = ClusterConnection.current();
    const url = `${apiUrl}?${qs.toString()}`;

    return new ResourceListWatch<T>(conn, url, raw => this.klass.fromRawObject(raw));
  }

  [Symbol.asyncIterator]() {
    return new ResourceListIterator<T>(this.klass, this.namespace, this.selector, this.pageSize, this.resourceVersion);
  }
}
