import type { INamespacedResource } from "../base/Resource";
import { NamespacedResource, wrapNamespacedResource } from "../base/Resource";
import type { ObjectReference } from "../core/types";
import type { JobSpec } from "./Job";
import { Job } from "./Job";

export interface CronJobMetadata {}

export interface CronJobSpec {
  concurrencyPolicy?: "Allow" | "Forbid" | "Replace";
  failedJobsHistoryLimit?: number;
  jobTemplate: {
    metadata?: {
      labels: Record<string, string>;
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

export interface CronJob extends INamespacedResource<CronJobMetadata, CronJobSpec, CronJobStatus> {
  trigger(): Promise<Job>;
  jobs(): Promise<Job[]>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const CronJob = wrapNamespacedResource<
  CronJobMetadata,
  CronJobSpec,
  CronJobStatus,
  CronJob,
  "CronJob",
  "batch/v1beta1"
>(
  class extends NamespacedResource<CronJobMetadata, CronJobSpec, CronJobStatus, "CronJob", "batch/v1beta1"> {
    static kind = "CronJob";

    protected static apiPlural = "cronjobs";

    static apiVersion = "batch/v1beta1";

    async trigger() {
      return Job.apply(
        {
          name: `${this.metadata.name}-${new Date().getTime()}`,
          namespace: this.metadata.namespace,
          ownerReferences: [
            {
              apiVersion: "batch/v1beta1",
              kind: "CronJob",
              name: this.metadata.name,
              uid: this.metadata.uid,
              controller: true,
              blockOwnerDeletion: true,
            },
          ],
        },
        this.spec.jobTemplate.spec,
      );
    }

    async jobs() {
      return Job.list({
        namespace: this.metadata.namespace,
        selector: {
          matchLabels: this.spec.jobTemplate.metadata?.labels,
        },
      });
    }
  },
);
