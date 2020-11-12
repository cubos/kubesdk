import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { CronJob } from "../batch/CronJob";

interface ControllerCronJob {
  name: string;
  schedule: string;
  func(): Promise<void>;
}

export class Controller {
  private cronJobs: ControllerCronJob[] = [];

  addCronJob(name: string, schedule: string, func: () => Promise<void>) {
    this.cronJobs.push({ name, schedule, func });
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
          {
            content: "Project home: {underline https://github.com/kubesdk/kubesdk}",
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
      { description: "Specifies the controller name", name: "name" },
      { description: "Specifies the target namespace", name: "namespace" },
      { description: "Specifies the Docker image with ENTRYPOINT pointed to this cli", name: "image" },
      { description: "Specifies the image pull secret", name: "imagePullSecret" },
      { alias: "h", description: "Display this usage guide.", name: "help", type: Boolean },
    ];

    const options: {
      name?: string;
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
          {
            content: "Project home: {underline https://github.com/kubesdk/kubesdk}",
          },
        ]),
      );
    }

    if (options.help) {
      showHelp();
      return;
    }

    if (!options.name) {
      throw new Error("Missing 'name' option.");
    }

    if (!options.namespace) {
      throw new Error("Missing 'namespace' option.");
    }

    if (!options.image) {
      throw new Error("Missing 'image' option.");
    }

    for (const cronJob of this.cronJobs) {
      console.log("apply CronJob", cronJob.name);
      await CronJob.apply(
        {
          name: `${options.name}-${cronJob.name}`,
          namespace: options.namespace,
        },
        {
          schedule: cronJob.schedule,
          jobTemplate: {
            spec: {
              template: {
                spec: {
                  containers: [
                    {
                      name: cronJob.name,
                      image: options.image,
                      args: ["run", "cronjob", cronJob.name],
                    },
                  ],
                  restartPolicy: "Never",
                },
              },
            },
          },
        },
      );
    }
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
          {
            content: "Project home: {underline https://github.com/kubesdk/kubesdk}",
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
  }
}
