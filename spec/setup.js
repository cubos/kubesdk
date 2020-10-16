/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("child_process");
const { unlinkSync, writeFileSync } = require("fs");

function run(cmd, ...args) {
  const result = spawnSync(cmd, args);

  if (result.status === 0) {
    return result.stdout.toString();
  }

  throw new Error(result.stderr.toString());
}

function rawKubectl(...args) {
  return run("kubectl", "--kubeconfig=.spec-kubeconfig", ...args);
}

function kubectl(...args) {
  return JSON.parse(rawKubectl("--output=json", ...args));
}

function randomSuffix() {
  return `${new Date().getTime()}-${Math.floor(Math.random() * 100000)}`;
}

function apply({ yaml }) {
  const path = `/tmp/kube.${randomSuffix()}.yaml`;

  writeFileSync(path, yaml);
  try {
    return kubectl("apply", "-f", path);
  } finally {
    unlinkSync(path);
  }
}

function kind(...args) {
  return run("kind", ...args);
}

function setupStorageClass() {
  const storageClasses = kubectl("get", "storageclasses");
  const storageClassesToCreate = ["ssd-regional", "ssd"];
  const base = JSON.parse(
    storageClasses.items.find(x => x.metadata.name === "standard").metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ],
  );

  delete base.metadata.annotations["storageclass.kubernetes.io/is-default-class"];

  for (const name of storageClassesToCreate) {
    if (storageClasses.items.find(x => x.metadata.name === name)) {
      continue;
    }

    base.metadata.name = name;
    apply({ yaml: JSON.stringify(base) });
  }
}

if (!process.env.CI) {
  const clusters = kind("get", "clusters").split("\n");
  const clusterName = "kubeoperator-spec";

  if (!clusters.includes(clusterName)) {
    kind("create", "cluster", "--name", clusterName, "--wait", "1m");
    setupStorageClass();
    clusters.push(clusterName);

    run("docker", "pull", "busybox");
    kind("load", "docker-image", "busybox", "--name", clusterName);
  }

  writeFileSync(".spec-kubeconfig", kind("get", "kubeconfig", "--name", clusterName));

  // See package.json
  console.log("export KUBECONFIG=.spec-kubeconfig");
}
