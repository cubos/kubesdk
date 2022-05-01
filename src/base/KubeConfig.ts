import { readFileSync } from "fs";

import YAML from "js-yaml";

import { has } from "../utils";

class Cluster {
  readonly server: URL;

  readonly tlsServerName: string;

  readonly insecureSkipTLSVerify: boolean = false;

  readonly certificateAuthorityData: string | null = null;

  readonly proxyUrl: URL | null = null;

  constructor(obj: object) {
    if (!has(obj, "server")) {
      throw new Error(`Expected Cluster to have a "server" property with the URL`);
    }

    if (typeof obj.server !== "string") {
      throw new Error(`Expected Cluster to have a "server" property with the URL`);
    }

    this.server = new URL(obj.server);

    if (has(obj, "tls-server-name")) {
      if (typeof obj["tls-server-name"] !== "string") {
        throw new Error(`Expected property "tls-server-name" of Cluster to be a string`);
      }

      this.tlsServerName = obj["tls-server-name"];
    } else {
      this.tlsServerName = this.server.hostname;
    }

    if (has(obj, "insecure-skip-tls-verify")) {
      if (typeof obj["insecure-skip-tls-verify"] !== "boolean") {
        throw new Error(`Expected property "insecure-skip-tls-verify" of Cluster to be true or false`);
      }

      this.insecureSkipTLSVerify = obj["insecure-skip-tls-verify"];
    }

    if (has(obj, "certificate-authority")) {
      if (typeof obj["certificate-authority"] !== "string") {
        throw new Error(`Expected property "certificate-authority" of Cluster to a string`);
      }

      this.certificateAuthorityData = readFileSync(obj["certificate-authority"], "utf-8");
    }

    if (has(obj, "certificate-authority-data")) {
      if (typeof obj["certificate-authority-data"] !== "string") {
        throw new Error(`Expected property "certificate-authority-data" of Cluster to a string`);
      }

      this.certificateAuthorityData = Buffer.from(obj["certificate-authority-data"], "base64").toString();
    }

    if (has(obj, "proxy-url")) {
      if (typeof obj["proxy-url"] !== "string") {
        throw new Error(`Expected property "proxy-url" of Cluster to a string`);
      }

      this.proxyUrl = new URL(obj["proxy-url"]);
    }
  }
}

class User {
  readonly clientCertificateData: string | null = null;

  readonly clientKeyData: string | null = null;

  readonly token: string | null = null;

  readonly impersonateUser: string | null = null;

  readonly impersonateGroups: string[] | null = null;

  readonly impersonateExtra: Map<string, string> | null = null;

  readonly username: string | null = null;

  readonly password: string | null = null;

  constructor(obj: object) {
    if (has(obj, "client-certificate")) {
      if (typeof obj["client-certificate"] !== "string") {
        throw new Error(`Expected property "client-certificate" of User to a string`);
      }

      this.clientCertificateData = readFileSync(obj["client-certificate"], "utf-8");
    }

    if (has(obj, "client-certificate-data")) {
      if (typeof obj["client-certificate-data"] !== "string") {
        throw new Error(`Expected property "client-certificate-data" of User to a string`);
      }

      this.clientCertificateData = Buffer.from(obj["client-certificate-data"], "base64").toString();
    }

    if (has(obj, "client-key")) {
      if (typeof obj["client-key"] !== "string") {
        throw new Error(`Expected property "client-key" of User to a string`);
      }

      this.clientKeyData = readFileSync(obj["client-key"], "utf-8");
    }

    if (has(obj, "client-key-data")) {
      if (typeof obj["client-key-data"] !== "string") {
        throw new Error(`Expected property "client-key-data" of User to a string`);
      }

      this.clientKeyData = Buffer.from(obj["client-key-data"], "base64").toString();
    }

    if (has(obj, "token-file")) {
      if (typeof obj["token-file"] !== "string") {
        throw new Error(`Expected property "token-file" of User to a string`);
      }

      this.token = readFileSync(obj["token-file"], "utf-8");
    }

    if (has(obj, "token")) {
      if (typeof obj.token !== "string") {
        throw new Error(`Expected property "token" of User to a string`);
      }

      this.token = obj.token;
    }

    if (has(obj, "act-as")) {
      if (typeof obj["act-as"] !== "string") {
        throw new Error(`Expected property "act-as" of User to a string`);
      }

      this.impersonateUser = obj["act-as"];
    }

    if (has(obj, "act-as-groups")) {
      if (!Array.isArray(obj["act-as-groups"])) {
        throw new Error(`Expected property "act-as-groups" of User to an array`);
      }

      this.impersonateGroups = [];
      for (const group of obj["act-as-groups"]) {
        if (typeof group !== "string") {
          throw new Error(`Expected property "act-as-groups" of User to an array of strings`);
        }

        this.impersonateGroups.push(group);
      }
    }

    if (has(obj, "act-as-user-extra")) {
      if (typeof obj["act-as-user-extra"] !== "object" || obj["act-as-user-extra"] === null) {
        throw new Error(`Expected property "act-as-user-extra" of User to an array`);
      }

      this.impersonateExtra = new Map<string, string>();
      for (const [key, value] of Object.entries(obj["act-as-user-extra"])) {
        if (typeof value !== "string") {
          throw new Error(`Expected property "act-as-user-extra" of User to a map of strings`);
        }

        this.impersonateExtra.set(key, value);
      }
    }

    if (has(obj, "username")) {
      if (typeof obj.username !== "string") {
        throw new Error(`Expected property "username" of User to a string`);
      }

      this.username = obj.username;
    }

    if (has(obj, "password")) {
      if (typeof obj.password !== "string") {
        throw new Error(`Expected property "password" of User to a string`);
      }

      this.password = obj.password;
    }
  }
}

interface Context {
  cluster: Cluster;
  user: User;
  namespace: string | null;
}

export class KubeConfig {
  readonly clusters = new Map<string, Cluster>();

  readonly users = new Map<string, User>();

  readonly contexts = new Map<string, Context>();

  readonly currentContext: Context;

  constructor(raw: string) {
    const config = YAML.load(raw);

    if (typeof config !== "object" || !config) {
      throw new Error("Expected to see an object");
    }

    // https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/client-go/tools/clientcmd/api/types.go#L31
    if (!has(config, "kind") || config.kind !== "Config") {
      throw new Error(`Expected Config to have "kind" = "Config"`);
    }

    if (!has(config, "apiVersion") || config.apiVersion !== "v1") {
      throw new Error(`Expected Config to have "apiVersion" = "v1"`);
    }

    // Cluster

    if (!has(config, "clusters")) {
      throw new Error(`Expected Config to have a "clusters" property`);
    }

    if (!Array.isArray(config.clusters)) {
      throw new Error(`Expected property "clusters" of Config to an array`);
    }

    for (const cluster of config.clusters as unknown[]) {
      if (typeof cluster !== "object" || !cluster) {
        throw new Error("Expected to see an object");
      }

      if (!has(cluster, "name")) {
        throw new Error(`Expected Config's "clusters" entry to have a "name" property`);
      }

      if (typeof cluster.name !== "string") {
        throw new Error(`Expected property "name" of a Config's "clusters" entry to be a string`);
      }

      if (!has(cluster, "cluster")) {
        throw new Error(`Expected Config's "clusters" entry to have a "cluster" property`);
      }

      if (typeof cluster.cluster !== "object" || cluster.cluster === null) {
        throw new Error(`Expected property "cluster" of a Config's "clusters" entry to an object`);
      }

      if (this.clusters.has(cluster.name)) {
        throw new Error(`Cluster "${cluster.name}" is duplicated`);
      }

      this.clusters.set(cluster.name, new Cluster(cluster.cluster));
    }

    // User
    if (!has(config, "users")) {
      throw new Error(`Expected Config to have a "users" property`);
    }

    if (!Array.isArray(config.users)) {
      throw new Error(`Expected property "users" of Config to an array`);
    }

    for (const user of config.users as unknown[]) {
      if (typeof user !== "object" || !user) {
        throw new Error("Expected to see an object");
      }

      if (!has(user, "name")) {
        throw new Error(`Expected Config's "users" entry to have a "name" property`);
      }

      if (typeof user.name !== "string") {
        throw new Error(`Expected property "name" of a Config's "users" entry to be a string`);
      }

      if (!has(user, "user")) {
        throw new Error(`Expected Config's "users" entry to have a "user" property`);
      }

      if (typeof user.user !== "object" || user.user === null) {
        throw new Error(`Expected property "user" of a Config's "users" entry to an object`);
      }

      if (this.users.has(user.name)) {
        throw new Error(`User "${user.name}" is duplicated`);
      }

      this.users.set(user.name, new User(user.user));
    }

    // Context
    if (!has(config, "contexts")) {
      throw new Error(`Expected Config to have a "contexts" property`);
    }

    if (!Array.isArray(config.contexts)) {
      throw new Error(`Expected property "contexts" of Config to an array`);
    }

    for (const context of config.contexts as unknown[]) {
      if (typeof context !== "object" || !context) {
        throw new Error("Expected to see an object");
      }

      if (!has(context, "name")) {
        throw new Error(`Expected Config's "contexts" entry to have a "name" property`);
      }

      if (typeof context.name !== "string") {
        throw new Error(`Expected property "name" of a Config's "contexts" entry to be a string`);
      }

      if (!has(context, "context")) {
        throw new Error(`Expected Config's "contexts" entry to have a "context" property`);
      }

      if (typeof context.context !== "object" || context.context === null) {
        throw new Error(`Expected property "context" of a Config's "contexts" entry to an object`);
      }

      if (this.contexts.has(context.name)) {
        throw new Error(`Context "${context.name}" is duplicated`);
      }

      if (!has(context.context, "cluster")) {
        throw new Error(`Expected Config's "contexts" entry to have a "cluster" property`);
      }

      if (typeof context.context.cluster !== "string") {
        throw new Error(`Expected property "cluster" of a Config's "contexts" entry to be a string`);
      }

      const cluster = this.clusters.get(context.context.cluster);

      if (!cluster) {
        throw new Error(`Cluster "${context.context.cluster}" doesn't exist`);
      }

      if (!has(context.context, "user")) {
        throw new Error(`Expected Config's "contexts" entry to have a "user" property`);
      }

      if (typeof context.context.user !== "string") {
        throw new Error(`Expected property "user" of a Config's "contexts" entry to be a string`);
      }

      const user = this.users.get(context.context.user);

      if (!user) {
        throw new Error(`User "${context.context.user}" doesn't exist`);
      }

      let namespace: string | null = null;

      if (has(context.context, "namespace")) {
        if (typeof context.context.namespace !== "string") {
          throw new Error(`Expected property "namespace" of Context to a string`);
        }

        ({ namespace } = context.context);
      }

      this.contexts.set(context.name, {
        cluster,
        user,
        namespace,
      });
    }

    if (!has(config, "current-context")) {
      throw new Error(`Expected Config to have a "current-context" property`);
    }

    if (typeof config["current-context"] !== "string") {
      throw new Error(`Expected property "current-context" of Config to be a string`);
    }

    const currentContext = this.contexts.get(config["current-context"]);

    if (!currentContext) {
      throw new Error(`Context "${config["current-context"]}" doesn't exist`);
    }

    this.currentContext = currentContext;
  }

  context(name?: string): Context {
    if (name !== undefined) {
      const context = this.contexts.get(name);

      if (!context) {
        throw new Error(`Context "${name}" doesn't exist`);
      }

      return context;
    }

    return this.currentContext;
  }
}
