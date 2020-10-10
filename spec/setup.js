import { spawnSync } from "child_process";
import { unlinkSync, writeFileSync } from "fs";

function rawKubectl(...args) {
  var result = spawnSync("kubectl", ["--kubeconfig=.spec-kubeconfig", ...args]);

  if (result.status === 0) {
    return result.stdout.toString();
  } else {
    throw new Error(result.stderr.toString());
  }
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
  var result = spawnSync("kind", args);

  if (result.status === 0) {
    return result.stdout.toString().trim();
  } else {
    throw new Error(result.stderr.toString().trim());
  }
}

const clusters = kind("get", "clusters").split("\n");
let clusterName = "kube-templates-test";

if (process.env.CI) {
  for (const cluster of clusters) {
    if (!cluster.startsWith(`${clusterName}-`)) continue;
    const date = parseInt(cluster.substr(clusterName.length + 1), 10);
    if (date < new Date().getTime() - 3600000) {
      kind("delete", "cluster", "--name", cluster);
    }
  }
  clusterName += `-${new Date().getTime()}`;
  kind("create", "cluster", "--name", clusterName, "--wait", "2m");
  setupStorageClass();
  console.log(kind("get", "clusters"));
  const kubeconfig = kind("get", "kubeconfig", "--name", clusterName);

  const masterIp = spawnSync("docker", [
    "inspect",
    "-f",
    "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
    `${clusterName}-control-plane`,
  ])
    .stdout.toString()
    .trim();

  writeFileSync(
    ".spec-kubeconfig",
    kubeconfig.replace(/127\.0\.0\.1:\d+/g, `${masterIp}:6443`)
  );
} else {
  if (!clusters.includes(clusterName)) {
    kind("create", "cluster", "--name", clusterName, "--wait", "1m");
    setupStorageClass();
    clusters.push(clusterName);
  }
  writeFileSync(
    ".spec-kubeconfig",
    kind("get", "kubeconfig", "--name", clusterName)
  );
}

function setupStorageClass() {
  const storageClasses = kubectl("get", "storageclasses");
  const storageClassesToCreate = ["ssd-regional", "ssd"];
  const base = JSON.parse(
    storageClasses.items.find((x) => x.metadata.name === "standard")
      .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"]
  );
  delete base.metadata.annotations[
    "storageclass.kubernetes.io/is-default-class"
  ];

  for (const name of storageClassesToCreate) {
    if (storageClasses.items.find((x) => x.metadata.name === name))
      continue;
    base.metadata.name = name;
    apply({ yaml: JSON.stringify(base) });
  }
}
