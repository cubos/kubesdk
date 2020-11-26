import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { PodTemplateSpec } from "../core/Pod";
import { Condition, LabelSelector } from "../core/types";

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

interface Job extends INamespacedResource<JobMetadata, JobSpec, JobStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Job = wrapNamespacedResource<JobMetadata, JobSpec, JobStatus, Job, "Job", "batch/v1">(
  class extends NamespacedResource<JobMetadata, JobSpec, JobStatus, "Job", "batch/v1"> {
    static kind = "Job";

    protected static apiPlural = "jobs";

    static apiVersion = "batch/v1";
  },
);
