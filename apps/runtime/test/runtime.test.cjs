const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { startRuntime } = require("../dist/engine");
const { checkCompatibility, validateManifest, validatePolicy } = require("@api-platform/plugin-loader");

test("SDK compatibility prefers current and rejects expired or invalid legacy", () => {
  const manifest = validateManifest({
    name: "test", package: "example-plugin", version: "1.0.0", enabled: true, supportedSdkRange: "^1.0.0",
  });
  const policy = validatePolicy({ sdkVersion: "2.0.0", legacy: [{ sdkVersion: "1.5.0", expiresAt: "2030-01-01T00:00:00Z" }] });
  assert.deepEqual(checkCompatibility(manifest, policy, new Date("2029-01-01T00:00:00Z")), {
    kind: "legacy", sdkVersion: "1.5.0", expiresAt: "2030-01-01T00:00:00Z",
  });
  assert.throws(() => checkCompatibility(manifest, policy, new Date("2030-01-01T00:00:00Z")), /expired/);
  assert.equal(checkCompatibility({ ...manifest, supportedSdkRange: ">=1.0.0 <3" }, policy).kind, "current");
  assert.throws(() => validateManifest({ ...manifest, supportedSdkRange: "not-semver" }), /Invalid/);
  assert.throws(() => validateManifest({ ...manifest, package: "../escape" }));
});

test("boot isolates plugin failures and denies plugin routes while exposing health", async (t) => {
  const root = path.resolve(__dirname, "..", "..", "..", "node_modules");
  const name = `runtime-fixture-${randomUUID()}`;
  const pluginDir = path.join(root, name);
  await fs.mkdir(pluginDir);
  const failingName = `runtime-fixture-${randomUUID()}`;
  const failingDir = path.join(root, failingName);
  await fs.mkdir(failingDir);
  const legacyName = `runtime-fixture-${randomUUID()}`;
  const legacyDir = path.join(root, legacyName);
  await fs.mkdir(legacyDir);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-catalog-"));
  t.after(async () => {
    await fs.rm(pluginDir, { recursive: true, force: true });
    await fs.rm(failingDir, { recursive: true, force: true });
    await fs.rm(legacyDir, { recursive: true, force: true });
    await fs.rm(temp, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(pluginDir, "package.json"), JSON.stringify({ name, version: "1.0.0", main: "index.cjs" }));
  await fs.writeFile(path.join(pluginDir, "index.cjs"), `
    const { z } = require("zod");
    module.exports = {
      routes: [{
        method: "POST", path: "/test-route",
        requestSchema: z.object({}), responseSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true })
      }]
    };
  `);
  await fs.writeFile(path.join(failingDir, "package.json"), JSON.stringify({ name: failingName, version: "1.0.0", main: "index.cjs" }));
  await fs.writeFile(path.join(failingDir, "index.cjs"), `
    const { z } = require("zod");
    module.exports = {
      onInit: () => { throw new Error("broken init"); },
      routes: [{ method: "POST", path: "/broken", requestSchema: z.unknown(), responseSchema: z.unknown(), handler: () => null }]
    };
  `);
  await fs.writeFile(path.join(legacyDir, "package.json"), JSON.stringify({ name: legacyName, version: "1.0.0", main: "index.cjs" }));
  await fs.writeFile(path.join(legacyDir, "index.cjs"), `
    const { z } = require("zod");
    module.exports = {
      onInit: (context) => {
        if (!context.capabilities.billing.compatibility.shimmed) throw new Error("Missing legacy shim");
      },
      routes: [{ method: "POST", path: "/legacy", requestSchema: z.unknown(), responseSchema: z.unknown(), handler: () => null }]
    };
  `);
  const catalog = path.join(temp, "plugins.yaml");
  await fs.writeFile(catalog, JSON.stringify({ plugins: [
    { name: "incompatible", package: name, version: "1.0.0", enabled: true, supportedSdkRange: "^99.0.0" },
    { name: "wrong-version", package: name, version: "9.0.0", enabled: true, supportedSdkRange: "*" },
    { name: "broken", package: failingName, version: "1.0.0", enabled: true, supportedSdkRange: "*" },
    { name: "legacy", package: legacyName, version: "1.0.0", enabled: true, supportedSdkRange: "0.0.5" },
    { name: "good", package: name, version: "1.0.0", enabled: true, supportedSdkRange: "*" },
  ] }));
  const app = await startRuntime({
    catalogPath: catalog, host: "127.0.0.1", port: 0,
    legacy: [{ sdkVersion: "0.0.5", expiresAt: "2099-01-01T00:00:00Z" }],
    capabilityFactory: (_manifest, compatibility) => compatibility.kind === "legacy"
      ? { billing: { name: "billing", version: "1.0.0", compatibility: { requestedVersion: "1.0.0", resolvedVersion: "2.0.0", deprecated: true, shimmed: true } } }
      : {},
  });
  t.after(() => app.close());
  const base = await app.getUrl();
  for (const endpoint of ["live", "ready", "startup"]) {
    const response = await fetch(`${base}/health/${endpoint}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  }
  const denied = await fetch(`${base}/test-route`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 401);
  assert.equal((await fetch(`${base}/missing`, { method: "POST" })).status, 404);
  assert.equal((await fetch(`${base}/broken`, { method: "POST" })).status, 404);
  assert.equal((await fetch(`${base}/legacy`, { method: "POST" })).status, 401);
});

test("invalid catalog is a startup error", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-bad-catalog-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const catalog = path.join(dir, "plugins.yaml");
  await fs.writeFile(catalog, "plugins: nope");
  await assert.rejects(startRuntime({ catalogPath: catalog, host: "127.0.0.1", port: 0, legacy: [] }));
});
