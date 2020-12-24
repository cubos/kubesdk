import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { PodTemplateSpec } from "../core/Pod";
import { Pod } from "../core/Pod";
import type { Condition, LabelSelector } from "../core/types";

export interface JobMetadata {}

export interface JobSpec {
  activeDeadlineSeconds?: number;
  backoffLimit?: number;
  completions?: number;
  manualSelector?: boolean;
  parallelism?: number;
  selector?: LabelSelector;
  template: PodTemplateSpec & {
    spec: {
      restartPolicy: "Never" | "OnFailure";
    };
  };
  ttlSecondsAfterFinished?: number;
}

export interface JobStatus {
  conditions?: Array<Condition<"Complete" | "Failed">>;
  active?: number;
  completionTime?: string;
  failed?: number;
  startTime?: string;
  succeeded?: number;
}

export interface Job extends INamespacedResource<JobMetadata, JobSpec, JobStatus> {
  pods(): Promise<Pod[]>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Job = wrapNamespacedResource<JobMetadata, JobSpec, JobStatus, Job, "Job", "batch/v1">(
  class extends NamespacedResource<JobMetadata, JobSpec, JobStatus, "Job", "batch/v1"> {
    static kind = "Job";

    protected static apiPlural = "jobs";

    static apiVersion = "batch/v1";

    async pods() {
      return Pod.list({
        namespace: this.metadata.namespace,
        selector: this.spec.selector,
      });
    }
  },
);
