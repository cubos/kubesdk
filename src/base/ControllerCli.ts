import { randomBytes } from "crypto";
import { existsSync, promises as fs } from "fs";
import path from "path";

import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import jsyaml from "js-yaml";
import { mkdirp } from "mkdirp";
import { rimraf } from "rimraf";
import slugify from "slugify";
import { tar } from "zip-a-folder";

import { ClusterConnection } from "./ClusterConnection";
import type { Controller } from "./Controller";
import { has } from "../utils";

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
            content: "Allowed types are 'cronjob', 'controller', 'deployment' and 'statefulset'.",
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
        case "cronjob":
        case "deployment":
        case "statefulset": {
          await this.controller.run(args[0], args[1]);
          break;
        }

        default:
          showHelp();
      }
    });
  }

  private async cliChart(argv: string[]) {
    const optionDefinitions = [
      { alias: "h", description: "Display this usage guide.", name: "help", type: Boolean },
      {
        alias: "c",
        description: "Path to Chart.yaml",
        name: "chart",
        type: String,
        defaultOption: true,
      },
      {
        alias: "i",
        description: "Set controller image on values.yaml. Example: registry.gitlab.com/group/project:v123",
        name: "image",
        type: String,
      },
    ];

    const options = commandLineArgs(optionDefinitions, { argv }) as {
      help?: boolean;
      chart?: string;
      image?: string;
    };

    function showHelp() {
      console.log(
        commandLineUsage([
          {
            content: "chart <path to Chart.yaml> --image <controller image url>",
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

    if (options.help || !options.chart) {
      showHelp();
      return;
    }

    if (!existsSync(options.chart)) {
      throw new Error(`Chart.yaml not found: ${options.chart}`);
    }

    const parsedChartYaml = jsyaml.load(await fs.readFile(options.chart, "utf8"));

    if (
      typeof parsedChartYaml !== "object" ||
      !parsedChartYaml ||
      !has(parsedChartYaml, "name") ||
      typeof parsedChartYaml.name !== "string" ||
      !has(parsedChartYaml, "version") ||
      typeof parsedChartYaml.version !== "string"
    ) {
      throw new Error(`Invalid Chart.yaml`);
    }

    const resources = await this.controller.export({
      image: "{{ .Values.image }}",
      namespace: "{{ .Release.Namespace }}",
      helm: true,
    });

    const baseHelmChartWorkingDir = path.join(__dirname, `._helmChartWd-${randomBytes(4).toString("hex")}`);
    const helmChartDir = path.join(baseHelmChartWorkingDir, parsedChartYaml.name);

    // Cleanup and create the directory
    await rimraf(baseHelmChartWorkingDir);
    await mkdirp(path.join(helmChartDir, "templates"));

    for (const resource of resources) {
      console.log(`${resource.kind} ${resource.metadata.name}`);

      await fs.writeFile(
        path.join(
          helmChartDir,
          "templates",
          `${slugify(`${resource.kind}-${resource.metadata.name}`, { strict: true })}.yaml`,
        ),
        jsyaml
          .dump(resource, { lineWidth: -1 })
          // eslint-disable-next-line require-unicode-regexp
          .replace(/'(?<rawValue>{{ .+ }})'$/gm, (_, rawValue: string) => rawValue),
      );
    }

    if (!options.image) {
      console.warn("⚠️ Chart image was not set. You must set image manually in values.yaml");
    }

    const valuesYaml = jsyaml.dump({
      image: options.image ?? "",
      imagePullSecrets: [],
      secrets: resources
        .filter(r => r.kind === "Secret")
        .reduce<Record<string, Record<string, string>>>((acc, cur) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
          acc[cur.metadata.name.substring(this.controller.name.length + 1)] = Object.keys(cur.stringData).reduce<
            Record<string, string>
          >((acc2, cur2) => {
            acc2[cur2] = "";

            return acc2;
          }, {});

          return acc;
        }, {}),
    });

    await fs.copyFile(options.chart, path.join(helmChartDir, "Chart.yaml"));
    await fs.writeFile(path.join(helmChartDir, "values.yaml"), valuesYaml);

    console.log(`\nvalues.yaml:\n${valuesYaml.replace(/^/gmu, "  ")}`);

    const outputFileName = `${parsedChartYaml.name}-${parsedChartYaml.version}.tgz`;

    await tar(baseHelmChartWorkingDir, outputFileName);
    await rimraf(baseHelmChartWorkingDir);

    console.log(`✔️  Chart exported successfully as ${outputFileName}`);
  }
}
