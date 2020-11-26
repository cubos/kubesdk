import { INamespacedResource, NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import { ObjectReference } from "../core/types";
import { JobSpec } from "./Job";

export interface CronJobMetadata {}

export interface CronJobSpec {
  concurrencyPolicy?: "Allow" | "Forbid" | "Replace";
  failedJobsHistoryLimit?: number;
  jobTemplate: {
    metadata?: {
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec: JobSpec;
  };
  schedule: string;
  startingDeadlineSeconds?: number;
  successfulJobsHistoryLimit?: number;
  suspend?: boolean;
}

export interface CronJobStatus {
  active?: Array<ObjectReference<"Job", "batch/v1">>;
  lastScheduleTime?: string;
}

interface CronJob extends INamespacedResource<CronJobMetadata, CronJobSpec, CronJobStatus> {}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const CronJob = wrapNamespacedResource<
  CronJobMetadata,
  CronJobSpec,
  CronJobStatus,
  CronJob,
  "CronJob",
  "batch/v1"
>(
  class extends NamespacedResource<CronJobMetadata, CronJobSpec, CronJobStatus, "CronJob", "batch/v1"> {
    static kind = "CronJob";

    protected static apiPlural = "cronjobs";

    static apiVersion = "batch/v1beta1";
  },
);
