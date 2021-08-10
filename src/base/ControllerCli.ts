import fs from "fs";
import path from "path";
import util from "util";

import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import jsyaml from "js-yaml";
import mkdirp from "mkdirp";
import Rimraf from "rimraf";
import slugify from "slugify";
import { tar } from "zip-a-folder";

import { ClusterConnection } from "./ClusterConnection";
import type { Controller } from "./Controller";

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

const rimraf = util.promisify(Rimraf);

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
            content: `Allowed commands are 'install', 'uninstall', 'run' or 'chart'.\nSee \`<command> -h\` for details.`,
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
        case "chart":
          await this.cliChart(args);
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

  private async cliChart(argv: string[]) {
    const optionDefinitions = [{ alias: "h", description: "Display this usage guide.", name: "help", type: Boolean }];
    const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true, argv });

    function showHelp() {
      console.log(
        commandLineUsage([
          {
            content: "chart <path to Chart.yaml>",
            header: "Usage",
          },
          {
            content: "Exports a Helm Chart for this controller.",
            header: "Description",
          },
          {
            header: "Options",
            optionList: optionDefinitions,
          },
        ]),
      );
    }

    const args = options._unknown ?? [];

    if (options.help || args.length === 0) {
      showHelp();
      return;
    }

    if (!fs.existsSync(args[0])) {
      throw new Error(`Chart.yaml not found: ${args[0]}`);
    }

    const parsedChartYaml: any = jsyaml.load(await fs.promises.readFile(args[0], "utf8"));

    if (!parsedChartYaml || !parsedChartYaml.name || !parsedChartYaml.version) {
      throw new Error(`Invalid Chart.yaml`);
    }

    const resources = await this.controller.export({
      image: "{{ .Values.image }}",
      namespace: "{{ .Release.Namespace }}",
      helm: true,
    });

    const helmChartDir = path.join(__dirname, "._helmChartWd");

    // Cleanup and create the directory
    await rimraf(helmChartDir);
    await mkdirp(path.join(helmChartDir, "templates"));

    for (const resource of resources) {
      console.log(`${resource.kind} ${resource.metadata.name}`);

      await fs.promises.writeFile(
        path.join(helmChartDir, "templates", `${slugify(`${resource.kind}-${resource.metadata.name}`)}.yaml`),
        // eslint-disable-next-line require-unicode-regexp
        jsyaml.dump(resource).replace(/'(?<rawValue>{{ .+ }})'$/gm, (_, rawValue: string) => rawValue),
      );
    }

    await fs.promises.copyFile(args[0], path.join(helmChartDir, "Chart.yaml"));
    await fs.promises.writeFile(
      path.join(helmChartDir, "values.yaml"),
      jsyaml.dump({
        image: "",
        secrets: resources
          .filter(r => r.kind === "Secret")
          .reduce<any>((acc, cur) => {
            acc[cur.metadata.name] = Object.keys(cur.stringData).reduce<any>((acc, cur) => {
              acc[cur] = "";
              return acc;
            }, {});

            return acc;
          }, {}),
      }),
    );

    console.log(await fs.promises.readFile(path.join(helmChartDir, "values.yaml"), "utf8"));

    await tar(helmChartDir, `${parsedChartYaml.name}-${parsedChartYaml.version}.tgz`);
    await rimraf(helmChartDir);
  }
}
