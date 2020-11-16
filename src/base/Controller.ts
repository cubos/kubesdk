import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { CronJob } from "../batch/CronJob";
import { ServiceAccount } from "../core/ServiceAccount";
import { ClusterRole } from "../rbac/ClusterRole";
import { ClusterRoleBinding } from "../rbac/ClusterRoleBinding";
import { Role } from "../rbac/Role";
import { RoleBinding } from "../rbac/RoleBinding";
import { PolicyRule } from "../rbac/types";
import { ClusterConnection } from "./ClusterConnection";

interface ControllerCronJob {
  name: string;
  schedule: string;
  func(): Promise<void>;
}

export class Controller {
  private cronJobs: ControllerCronJob[] = [];

  private clusterPolicyRules: PolicyRule[] = [];

  private policyRules: PolicyRule[] = [];

  constructor(public name: string) {}

  addCronJob(name: string, schedule: string, func: () => Promise<void>) {
    this.cronJobs.push({ name, schedule, func });
  }

  attachClusterPolicyRules(rules: PolicyRule[]) {
    this.clusterPolicyRules.push(...rules);
  }

  attachPolicyRules(rules: PolicyRule[]) {
    this.policyRules.push(...rules);
  }

  async cli(argv: string[] = process.argv) {
    const optionDefinitions = [{ alias: "h", description: "Display this usage guide.", name: "help", type: Boolean }];

    const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true, argv });

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

      console.log("apply ServiceAccount");
      const serviceAccount = await ServiceAccount.apply({
        name: this.name,
        namespace: options.namespace,
      });

      if (this.policyRules.length > 0) {
        console.log("apply Role");
        const role = await Role.apply(
          {
            name: this.name,
            namespace: options.namespace,
          },
          {
            rules: this.policyRules,
          },
        );

        console.log("apply RoleBinding");
        await RoleBinding.apply(
          {
            name: this.name,
            namespace: options.namespace,
          },
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "Role",
              name: role.metadata.name,
            },
            subjects: [
              {
                kind: "ServiceGroup",
                name: serviceAccount.metadata.name,
                namespace: options.namespace,
              },
            ],
          },
        );
      }

      if (this.clusterPolicyRules.length > 0) {
        console.log("apply ClusterRole");
        const clusterRole = await ClusterRole.apply(
          {
            name: this.name,
          },
          {
            rules: this.clusterPolicyRules,
          },
        );

        console.log("apply ClusterRoleBinding");
        await ClusterRoleBinding.apply(
          {
            name: this.name,
          },
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "ClusterRole",
              name: clusterRole.metadata.name,
            },
            subjects: [
              {
                kind: "ServiceGroup",
                name: serviceAccount.metadata.name,
                namespace: options.namespace,
              },
            ],
          },
        );
      }

      for (const cronJob of this.cronJobs) {
        console.log("apply CronJob", cronJob.name);
        await CronJob.apply(
          {
            name: `${this.name}-${cronJob.name}`,
            namespace: options.namespace,
          },
          {
            schedule: cronJob.schedule,
            jobTemplate: {
              spec: {
                template: {
                  spec: {
                    ...(options.imagePullSecret
                      ? {
                          imagePullSecrets: [{ name: options.imagePullSecret }],
                        }
                      : {}),
                    containers: [
                      {
                        name: cronJob.name,
                        image: options.image,
                        args: ["run", "cronjob", cronJob.name],
                      },
                    ],
                    serviceAccountName: serviceAccount.metadata.name,
                    restartPolicy: "Never",
                  },
                },
              },
            },
          },
        );
      }
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
    }).use(async () => {
      switch (args.shift()) {
        case "cronjob": {
          const cronJob = this.cronJobs.find(x => x.name === args[0]);

          if (!cronJob) {
            throw new Error(`Unknown cronjob "${args[0]}"`);
          }

          await cronJob.func();
          break;
        }

        default:
          showHelp();
      }
    });
  }
}
