import { CustomResourceDefinition } from "../apiextensions/CustomResourceDefinition";
import { Deployment } from "../apps/Deployment";
import { CronJob } from "../batch/CronJob";
import { ConfigMap } from "../core/ConfigMap";
import { Secret } from "../core/Secret";
import { Service } from "../core/Service";
import { ServiceAccount } from "../core/ServiceAccount";
import { ClusterRole } from "../rbac/ClusterRole";
import { ClusterRoleBinding } from "../rbac/ClusterRoleBinding";
import { Role } from "../rbac/Role";
import { RoleBinding } from "../rbac/RoleBinding";
import { PolicyRule } from "../rbac/types";
import { ControllerCli } from "./ControllerCli";
import { CustomResourceController, CustomResourceControllerConfig } from "./CustomResourceController";
import { KubernetesError } from "./KubernetesError";

interface ControllerCronJob {
  name: string;
  schedule: string;
  func(): Promise<void>;
}

interface InstalledResource {
  kind: keyof typeof installableKinds;
  name: string;
}

const installableKinds = {
  ClusterRole,
  ClusterRoleBinding,
  ConfigMap,
  CronJob,
  CustomResourceDefinition,
  Deployment,
  Role,
  RoleBinding,
  Secret,
  Service,
  ServiceAccount,
};

export class Controller {
  private cronJobs: ControllerCronJob[] = [];

  private clusterPolicyRules: PolicyRule[] = [];

  private policyRules: PolicyRule[] = [];

  private crds: CustomResourceControllerConfig[] = [];

  private secretEnvs: Array<{ name: string; values: Record<string, string> }> = [];

  public logRequests = false;

  constructor(public name: string) {}

  addCronJob(name: string, schedule: string, func: () => Promise<void>) {
    this.cronJobs.push({ name, schedule, func });
  }

  attachSecretEnv(name: string, values: Record<string, string>) {
    this.secretEnvs.push({ name, values });
  }

  attachClusterPolicyRules(rules: PolicyRule[]) {
    this.clusterPolicyRules.push(...rules);
  }

  attachPolicyRules(rules: PolicyRule[]) {
    this.policyRules.push(...rules);
  }

  addCrd(crd: CustomResourceController<string, string, "Cluster" | "Namespaced">) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { config }: { config: CustomResourceControllerConfig } = crd as any;

    this.crds.push(config);
    this.clusterPolicyRules.push({
      apiGroups: [config.spec.group],
      resources: [config.spec.names.plural],
      verbs: ["*"],
    });
  }

  async cli(argv: string[] = process.argv.slice(2)) {
    await new ControllerCli(this).cli(argv);
  }

  async installList(namespace: string) {
    const list: Array<{ kind: keyof typeof installableKinds; name: string }> = [];

    await this.install({
      image: "",
      namespace,
      apply: false,
      callback(kind, name) {
        list.push({ kind, name });
      },
    });

    return list;
  }

  async install({
    namespace,
    image,
    imagePullSecret,
    callback,
    apply,
  }: {
    namespace: string;
    image: string;
    imagePullSecret?: string;
    callback?(kind: keyof typeof installableKinds, name: string): void;
    apply?: boolean;
  }) {
    let previousList: InstalledResource[] | undefined;

    if (apply !== false) {
      const targetList = await this.installList(namespace);

      try {
        await ConfigMap.create(
          {
            name: this.name,
            namespace,
          },
          {
            data: {
              installedResources: JSON.stringify(targetList),
            },
          },
        );
      } catch (err) {
        if (err instanceof KubernetesError.Conflict) {
          const controllerConfig = await ConfigMap.get(namespace, this.name);

          previousList = JSON.parse(controllerConfig.spec.data.installedResources ?? "[]") as InstalledResource[];

          const newList = [...new Set([...targetList, ...previousList].map(x => JSON.stringify(x)))].map(
            x => JSON.parse(x) as InstalledResource,
          );

          controllerConfig.spec.data.installedResources = JSON.stringify(newList);
          await controllerConfig.save();
        } else {
          throw err;
        }
      }
    }

    if (this.policyRules.length > 0 || this.clusterPolicyRules.length > 0) {
      callback?.("ServiceAccount", this.name);
      if (apply !== false) {
        await ServiceAccount.apply({
          name: this.name,
          namespace,
        });
      }
    }

    if (this.policyRules.length > 0) {
      callback?.("Role", this.name);
      if (apply !== false) {
        await Role.apply(
          {
            name: this.name,
            namespace,
          },
          {
            rules: this.policyRules,
          },
        );
      }

      callback?.("RoleBinding", this.name);
      if (apply !== false) {
        await RoleBinding.apply(
          {
            name: this.name,
            namespace,
          },
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "Role",
              name: this.name,
            },
            subjects: [
              {
                kind: "ServiceAccount",
                name: this.name,
                namespace,
              },
            ],
          },
        );
      }
    }

    if (this.clusterPolicyRules.length > 0) {
      callback?.("ClusterRole", `${this.name}-${namespace}`);
      if (apply !== false) {
        await ClusterRole.apply(
          {
            name: `${this.name}-${namespace}`,
          },
          {
            rules: this.clusterPolicyRules,
          },
        );
      }

      callback?.("ClusterRoleBinding", `${this.name}-${namespace}`);
      if (apply !== false) {
        await ClusterRoleBinding.apply(
          {
            name: `${this.name}-${namespace}`,
          },
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "ClusterRole",
              name: `${this.name}-${namespace}`,
            },
            subjects: [
              {
                kind: "ServiceAccount",
                name: this.name,
                namespace,
              },
            ],
          },
        );
      }
    }

    for (const secretEnv of this.secretEnvs) {
      callback?.("Secret", `${this.name}-${secretEnv.name}`);
      if (apply !== false) {
        await Secret.apply(
          {
            name: `${this.name}-${secretEnv.name}`,
            namespace,
          },
          {
            data: {},
            stringData: secretEnv.values,
          },
        );
      }
    }

    for (const cronJob of this.cronJobs) {
      callback?.("CronJob", `${this.name}-${cronJob.name}`);
      if (apply !== false) {
        await CronJob.apply(
          {
            name: `${this.name}-${cronJob.name}`,
            namespace,
          },
          {
            schedule: cronJob.schedule,
            jobTemplate: {
              spec: {
                template: {
                  spec: {
                    ...(imagePullSecret
                      ? {
                          imagePullSecrets: [{ name: imagePullSecret }],
                        }
                      : {}),
                    containers: [
                      {
                        name: cronJob.name,
                        image,
                        args: ["run", "cronjob", cronJob.name],
                        envFrom: this.secretEnvs.map(secretEnv => ({
                          secretRef: { name: `${this.name}-${secretEnv.name}` },
                        })),
                      },
                    ],
                    ...(this.policyRules.length > 0 || this.clusterPolicyRules.length > 0
                      ? { serviceAccountName: this.name }
                      : {}),
                    restartPolicy: "Never",
                  },
                },
              },
            },
          },
        );
      }
    }

    let needsControllerService = false;

    for (const crd of this.crds) {
      if (crd.conversions.size > 0) {
        needsControllerService = true;
      }

      callback?.("CustomResourceDefinition", this.name);
      if (apply !== false) {
        await CustomResourceDefinition.apply(
          {
            name: `${crd.spec.names.plural}.${crd.spec.group}`,
          },
          {
            ...crd.spec,
            conversion: {
              strategy: "Webhook",
              webhook: {
                clientConfig: {
                  service: {
                    name: this.name,
                    namespace,
                  },
                },
                conversionReviewVersions: ["v1"],
              },
            },
          },
        );
      }
    }

    if (needsControllerService) {
      callback?.("Deployment", this.name);
      await Deployment.apply(
        {
          name: this.name,
          namespace,
        },
        {
          selector: {
            matchLabels: {
              controller: this.name,
            },
          },
          template: {
            metadata: {
              labels: {
                controller: this.name,
              },
            },
            spec: {
              ...(imagePullSecret
                ? {
                    imagePullSecrets: [{ name: imagePullSecret }],
                  }
                : {}),
              containers: [
                {
                  name: this.name,
                  image,
                  args: ["run", "controller"],
                  envFrom: this.secretEnvs.map(secretEnv => ({
                    secretRef: { name: `${this.name}-${secretEnv.name}` },
                  })),
                },
              ],
              ...(this.policyRules.length > 0 || this.clusterPolicyRules.length > 0
                ? { serviceAccountName: this.name }
                : {}),
              restartPolicy: "Never",
            },
          },
        },
      );

      callback?.("Service", this.name);
      await Service.apply(
        {
          name: this.name,
          namespace,
        },
        {
          ports: [
            {
              port: 8443,
            },
          ],
          selector: {
            controller: this.name,
          },
        },
      );
    }

    if (apply !== false) {
      const targetList = await this.installList(namespace);

      if (previousList) {
        for (const { kind, name } of previousList) {
          const resourceClass = installableKinds[kind];

          try {
            callback?.(kind, name);
            if (resourceClass.isNamespaced) {
              await resourceClass.delete(namespace, name);
            } else {
              await resourceClass.delete(name);
            }
          } catch (err) {
            if (!(err instanceof KubernetesError.NotFound)) {
              throw err;
            }
          }
        }
      }

      await ConfigMap.apply(
        {
          name: this.name,
          namespace,
        },
        {
          data: {
            installedResources: JSON.stringify(targetList),
          },
        },
      );
    }
  }

  async uninstall({
    namespace,
    callback,
  }: {
    namespace: string;
    callback?(kind: keyof typeof installableKinds, name: string): void;
  }) {
    const controllerConfig = await ConfigMap.get(namespace, this.name);
    const list = JSON.parse(controllerConfig.spec.data.installedResources ?? "[]") as Array<{
      kind: keyof typeof installableKinds;
      name: string;
    }>;

    for (const { kind, name } of list) {
      const resourceClass = installableKinds[kind];

      try {
        callback?.(kind, name);
        if (resourceClass.isNamespaced) {
          await resourceClass.delete(namespace, name);
        } else {
          await resourceClass.delete(name);
        }
      } catch (err) {
        if (!(err instanceof KubernetesError.NotFound)) {
          throw err;
        }
      }
    }

    callback?.("ConfigMap", this.name);
    await ConfigMap.delete(namespace, this.name);
  }

  async run(action: "cronjob" | "controller", name?: string) {
    switch (action) {
      case "cronjob": {
        const cronJob = this.cronJobs.find(x => x.name === name);

        if (!cronJob) {
          throw new Error(`Unknown cronjob "${name ?? ""}"`);
        }

        await cronJob.func();
        break;
      }

      case "controller": {
        // Hang forever
        await new Promise(() => undefined);
        break;
      }

      default:
        throw "never";
    }
  }
}
