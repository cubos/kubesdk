import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

import { ClusterConnection } from "./ClusterConnection";
import type { Controller } from "./Controller";

export class ControllerCli {
  constructor(private controller: Controller) {}

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
            content: `Allowed commands are 'install', 'uninstall' or 'run'.\nSee \`<command> -h\` for details.`,
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
        case "uninstall":
          await this.cliUninstall(args);
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

      await this.controller.install({
        namespace: options.namespace,
        image: options.image,
        imagePullSecret: options.imagePullSecret,
        callback(kind, name) {
          console.log(`apply ${kind} ${name}`);
        },
      });
    });
  }

  private async cliUninstall(argv: string[]) {
    const optionDefinitions = [
      { description: "Specifies the target namespace", name: "namespace" },
      { alias: "h", description: "Display this usage guide.", name: "help", type: Boolean },
    ];

    const options: {
      namespace?: string;
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

      await this.controller.uninstall({
        namespace: options.namespace,
        callback(kind, name) {
          console.log(`delete ${kind} ${name}`);
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
            content: "Allowed types are 'cronjob' and 'controller'.",
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
      name: this.controller.name,
      logRequests: this.controller.logRequests,
    }).use(async () => {
      switch (args[0]) {
        case "controller":
        case "cronjob": {
          await this.controller.run(args[0], args[1]);
          break;
        }

        default:
          showHelp();
      }
    });
  }
}
