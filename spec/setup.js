const { spawnSync } = require("child_process");
const { unlinkSync, writeFileSync } = require("fs");

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

if (!process.env.CI) {
  const clusters = kind("get", "clusters").split("\n");
  let clusterName = "kube-templates-test";
  if (!clusters.includes(clusterName)) {
    kind("create", "cluster", "--name", clusterName, "--wait", "1m");
    setupStorageClass();
    clusters.push(clusterName);
  }
  writeFileSync(
    ".spec-kubeconfig",
    kind("get", "kubeconfig", "--name", clusterName)
  );

  // See package.json
  console.log("export KUBECONFIG=.spec-kubeconfig")
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
