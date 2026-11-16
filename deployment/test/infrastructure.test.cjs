const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { parse, parseAllDocuments } = require("yaml");
const { z } = require("zod");

const root = resolve(__dirname, "..", "..");
const chart = resolve(root, "deployment", "helm", "platform-runtime");
const environments = ["dev", "qa", "staging", "preprod", "prod"];
const digest = `sha256:${"a".repeat(64)}`;
const load = (...parts) => parse(readFileSync(resolve(root, ...parts), "utf8"));
const valuesSchema = z.object({
  environment: z.enum(environments),
  secret: z.object({ existingName: z.string().min(1) }).strict(),
  autoscaling: z.object({
    minReplicas: z.number().int().positive(),
    maxReplicas: z.number().int().min(51),
  }).strict(),
  config: z.record(z.string()),
}).strict();
const catalogSchema = z.object({ plugins: z.array(z.unknown()) }).strict();
const workflowSchema = z.object({
  name: z.string().min(1),
  on: z.record(z.unknown()),
  jobs: z.record(z.record(z.unknown())),
}).passthrough();

test("configuration isolates five environments and enables 50+ replicas", () => {
  const secretNames = new Set();
  for (const environment of environments) {
    const values = valuesSchema.parse(load("environments", environment, "values.yaml"));
    assert.equal(values.environment, environment);
    assert.ok(values.autoscaling.maxReplicas >= values.autoscaling.minReplicas);
    assert.equal(values.secret.existingName, `platform-runtime-${environment}`);
    assert.ok(!secretNames.has(values.secret.existingName));
    secretNames.add(values.secret.existingName);
    catalogSchema.parse(load("environments", environment, "plugins.yaml"));
  }
});

test("workflows promote one digest in order without rebuilding during deployment", () => {
  for (const name of ["build", "test", "release-packages", "release-runtime", "deploy"]) {
    workflowSchema.parse(load(".github", "workflows", `${name}.yml`));
  }
  const release = load(".github", "workflows", "release-runtime.yml");
  let previous = "image";
  for (const environment of environments) {
    const job = release.jobs[environment];
    assert.ok([job.needs].flat().includes(previous));
    assert.equal(job.with.image, "${{ needs.image.outputs.image }}");
    assert.equal(job.with.source_sha, "${{ github.sha }}");
    previous = environment;
  }
  const deploy = load(".github", "workflows", "deploy.yml");
  const serialized = JSON.stringify(deploy);
  assert.ok(!serialized.includes("docker/build"));
  assert.ok(serialized.includes("--set-file"));
  assert.ok(serialized.includes("sha256:"));
});

test("lockfile is portable and excludes private registry URLs", () => {
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  assert.equal(lock.lockfileVersion, 3);
  for (const entry of Object.values(lock.packages)) {
    assert.ok(!entry.resolved || !/^https?:/.test(entry.resolved), entry.resolved);
  }
});

function helmArgs(environment) {
  return [
    "platform", chart, "--namespace", `api-platform-${environment}`,
    "--values", resolve(root, "environments", environment, "values.yaml"),
    "--set-file", `pluginCatalog=${resolve(root, "environments", environment, "plugins.yaml")}`,
    "--set-string", `image.digest=${digest}`,
  ];
}

for (const environment of environments) {
  test(`Helm renders ${environment} with probes, catalog mount, isolation and immutable image`, () => {
    execFileSync("helm", ["lint", chart, ...helmArgs(environment).slice(2)], { encoding: "utf8" });
    const manifests = parseAllDocuments(
      execFileSync("helm", ["template", ...helmArgs(environment)], { encoding: "utf8" }),
    ).map((document) => {
      assert.equal(document.errors.length, 0);
      return document.toJSON();
    }).filter(Boolean);
    const deployment = manifests.find((resource) => resource.kind === "Deployment");
    const container = deployment.spec.template.spec.containers[0];
    assert.ok(container.image.endsWith(`@${digest}`));
    assert.deepEqual(container.envFrom, [{ secretRef: { name: `platform-runtime-${environment}` } }]);
    for (const probe of ["startupProbe", "readinessProbe", "livenessProbe"]) {
      assert.ok(container[probe].httpGet.path.startsWith("/health/"));
    }
    assert.equal(container.volumeMounts[0].mountPath, "/etc/platform/config");
    const configMap = manifests.find((resource) => resource.kind === "ConfigMap");
    assert.deepEqual(parse(configMap.data["plugins.yaml"]), load("environments", environment, "plugins.yaml"));
    assert.equal(manifests.find((resource) => resource.kind === "HorizontalPodAutoscaler").spec.maxReplicas, 60);
    assert.ok(!manifests.some((resource) => resource.kind === "Secret"));
  });
}

test("Helm renders optional ingress and secret and rejects wrong namespace or mutable image", () => {
  const result = execFileSync("helm", ["template", ...helmArgs("dev"),
    "--set", "secret.create=true",
    "--set", "secret.stringData.EXAMPLE=value",
    "--set", "ingress.enabled=true",
    "--set", "ingress.host=dev.example.invalid",
    "--set", "ingress.tlsSecretName=dev-tls",
  ], { encoding: "utf8" });
  const manifests = parseAllDocuments(result).map((document) => document.toJSON()).filter(Boolean);
  assert.ok(manifests.some((resource) => resource.kind === "Secret"));
  assert.ok(manifests.some((resource) => resource.kind === "Ingress"));
  for (const overrides of [["--namespace", "default"], ["--set-string", "image.digest=latest"]]) {
    const rejected = spawnSync("helm", ["template", ...helmArgs("dev"), ...overrides], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.ok(rejected.stderr.includes("Error"));
  }
});
