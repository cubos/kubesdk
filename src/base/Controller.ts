import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { CronJob } from "../batch/CronJob";
import { Secret } from "../core/Secret";
import { ServiceAccount } from "../core/ServiceAccount";
import { ClusterRole } from "../rbac/ClusterRole";
import { ClusterRoleBinding } from "../rbac/ClusterRoleBinding";
import { Role } from "../rbac/Role";
import { RoleBinding } from "../rbac/RoleBinding";
import { PolicyRule } from "../rbac/types";
import { ClusterConnection } from "./ClusterConnection";
import { CustomResourceController, CustomResourceControllerConfig } from "./CustomResourceController";

interface ControllerCronJob {
  name: string;
  schedule: string;
  func(): Promise<void>;
}

export class Controller {
  private cronJobs: ControllerCronJob[] = [];

  private clusterPolicyRules: PolicyRule[] = [];

  private policyRules: PolicyRule[] = [];

  private crds: CustomResourceControllerConfig[] = [];

  private secretEnvs: Array<{ name: string; values: Record<string, string> }> = [];

  public logRequests = false;

  public paranoid = Boolean(process.env.KUBESDK_PARANOID);

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
      apiGroups: [config.crdSpec.group],
      resources: [config.crdSpec.names.plural],
      verbs: ["*"],
    });
  }

  async cli(argv: string[] = process.argv.slice(2)) {
    const optionDefinitions = [{ alias: "h", description: "Display this usage guide.", name: "help", type: Boolean }];

    function showHelp() {
      console.log(
        commandLineUsage([
          {
            content: `<command> <options>`,
            header: "Usage",
          },
          {
            content: `Allowed commands are 'install' or 'run'.\nSee \`<command> -h\` for details.`,
            header: "Commands",
          },
          {
            header: "Options",
            optionList: optionDefinitions,
          },
        ]),
      );
    }

    try {
      const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true, argv });

      if (options.help) {
        showHelp();
        return;
      }

      const args = options._unknown ?? [];

      switch (args.shift()) {
        case "install":
          await this.cliInstall(args);
          break;
        case "run":
          await this.cliRun(args);
          break;
        default:
          showHelp();
      }
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }

  private async cliInstall(argv: string[]) {
    const optionDefinitions = [
      { description: "Specifies the target namespace", name: "namespace" },
      { description: "Specifies the Docker image with ENTRYPOINT pointed to this cli", name: "image" },
      { description: "Specifies the image pull secret", name: "imagePullSecret" },
      { alias: "h", description: "Display this usage guide.", name: "help", type: Boolean },
    ];

    const options: {
      namespace?: string;
      image?: string;
      imagePullSecret?: string;
      help?: boolean;
      _unknown?: string[];
    } = commandLineArgs(optionDefinitions, { argv });

    function showHelp() {
      console.log(
        commandLineUsage([
          {
            content: `install <options>`,
            header: "Usage",
          },
          {
            header: "Options",
            optionList: optionDefinitions,
          },
        ]),
      );
    }

    if (options.help) {
      showHelp();
      return;
    }

    await new ClusterConnection().use(async () => {
      if (!options.namespace) {
        throw new Error("Missing 'namespace' option.");
      }

      if (!options.image) {
        throw new Error("Missing 'image' option.");
      }

      await this.install({
        namespace: options.namespace,
        image: options.image,
        imagePullSecret: options.imagePullSecret,
        callback(kind, name) {
          console.log(`apply ${kind} ${name}`);
        },
      });
    });
  }

  private async cliRun(argv: string[]) {
    const optionDefinitions = [{ alias: "h", description: "Display this usage guide.", name: "help", type: Boolean }];

    const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true, argv });

    function showHelp() {
      console.log(
        commandLineUsage([
          {
            content: "run <type> <name>",
            header: "Usage",
          },
          {
            content: "Allowed types are 'cronjob'.",
            header: "Types",
          },
          {
            header: "Options",
            optionList: optionDefinitions,
          },
        ]),
      );
    }

    if (options.help) {
      showHelp();
      return;
    }

    const args = options._unknown ?? [];

    await new ClusterConnection({
      name: this.name,
      logRequests: this.logRequests,
      paranoid: this.paranoid,
    }).use(async () => {
      switch (args[0]) {
        case "cronjob": {
          await this.run(args[0], args[1]);
          break;
        }

        default:
          showHelp();
      }
    });
  }

  async installList() {
    const list: Array<{ kind: string; name: string }> = [];

    await this.install({
      image: "",
      namespace: "",
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
    callback?(kind: string, name: string): void;
    apply?: boolean;
  }) {
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
      callback?.("ClusterRole", this.name);
      if (apply !== false) {
        await ClusterRole.apply(
          {
            name: this.name,
          },
          {
            rules: this.clusterPolicyRules,
          },
        );
      }

      callback?.("ClusterRoleBinding", this.name);
      if (apply !== false) {
        await ClusterRoleBinding.apply(
          {
            name: this.name,
          },
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "ClusterRole",
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
  }

  async run(action: "cronjob", name: string) {
    switch (action) {
      case "cronjob": {
        const cronJob = this.cronJobs.find(x => x.name === name);

        if (!cronJob) {
          throw new Error(`Unknown cronjob "${name}"`);
        }

        await cronJob.func();
        break;
      }

      default:
        throw "never";
    }
  }
}
