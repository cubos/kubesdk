[![test status badge](https://github.com/cubos/kubesdk/workflows/spec/badge.svg?branch=master)](https://github.com/cubos/kubesdk/actions)

This library is a high-level strongly typed client for the Kubernetes API for dynamically managing objects. It also serves as an Operator runtime (see below).

# Getting started

## Basic Usage

Currently Node 12.17.0+ is required (we use `AsyncLocalStorage` to keep the cluster connection). Make sure you have it.

```typescript
// Configure a cluster connection:
const cluster = new ClusterConnection({
  baseUrl: "https://...",
  token: "...",
});

await cluster.use(async () => {
  // The connection is enabled here.

  // List and print all namespace names:
  const namespaces = await Namespace.list();
  for (const namespace of namespaces) {
    console.log(namespace.metadata.name);
  }
});
```

Once inside a connection you can begin manipulating resources. A resource is either namespaced (lives inside a namespace) or global (lives inside the cluster itselt). `Namespace` is a global resource.

Supported global resources: `Namespace`
Supported namespaced resources: `Pod`

### Static methods:

#### Resource.get(name) or NamespacedResource.get(namespace, name)

Returns information about one specific object.

Example:

```
console.log(await Namespace.get("kube-system"));
```

#### Resource.list(options)

#### Resource.create(metadata, spec)

# Operator

// TODO
