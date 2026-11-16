const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createServer } = require("node:http");
const { generateKeyPairSync, randomUUID, sign } = require("node:crypto");
const { startRuntime } = require("../dist/engine");
const { loadJwtSettings, jwtSettingsSchema } = require("../dist/jwt-settings");

test("settings merge file and environment, reject missing fields and unsafe validation flags", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jwt-settings-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, "appsettings.json"), JSON.stringify({
    JwtSettings: {
      Issuer: "https://issuer.example",
      Audience: "file-audience",
      MetadataAddress: "https://issuer.example/discovery",
      RequireHttpsMetadata: true,
      TokenValidationParameters: {
        ValidateIssuer: true, ValidateAudience: true, ValidateLifetime: true,
        ValidateIssuerSigningKey: true, ClockSkew: "00:05:00",
      },
    },
  }));
  const settings = await loadJwtSettings({ JWT__AUDIENCE: "env-audience", JWT__CLOCK_SKEW: "00:01:00" }, dir);
  assert.equal(settings.Audience, "env-audience");
  assert.equal(settings.TokenValidationParameters.ClockSkew, "00:01:00");
  await assert.rejects(loadJwtSettings({ JWT__VALIDATE_ISSUER: "false" }, dir));
  await assert.rejects(loadJwtSettings({ JWT__REQUIRE_HTTPS_METADATA: "maybe" }, dir));
  await assert.rejects(loadJwtSettings({ APP_SETTINGS_PATH: "missing.json" }, dir));
  assert.throws(() => jwtSettingsSchema.parse({ Issuer: "https://issuer", Audience: "a", MetadataAddress: "http://issuer/oidc" }));
  const empty = await fs.mkdtemp(path.join(os.tmpdir(), "jwt-empty-"));
  t.after(() => fs.rm(empty, { recursive: true, force: true }));
  assert.equal(await loadJwtSettings({}, empty), undefined);
  await assert.rejects(loadJwtSettings({ JWT__ISSUER: "https://issuer" }, empty));
});

test("plugin routes verify RS256 discovery, signature, issuer, audience and lifetime", async (t) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1", use: "sig", alg: "RS256" };
  let issuer;
  let discoveryIssuer;
  const oidc = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/metadata") res.end(JSON.stringify({ issuer: discoveryIssuer, jwks_uri: `${issuer}/keys` }));
    else if (req.url === "/keys") res.end(JSON.stringify({ keys: [jwk] }));
    else { res.statusCode = 404; res.end("{}"); }
  });
  await new Promise((resolve) => oidc.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => oidc.close((error) => error ? reject(error) : resolve())));
  issuer = `http://127.0.0.1:${oidc.address().port}`;
  discoveryIssuer = "http://wrong-issuer";

  const root = path.resolve(__dirname, "..", "..", "..", "node_modules");
  const name = `jwt-fixture-${randomUUID()}`;
  const pluginDir = path.join(root, name);
  await fs.mkdir(pluginDir);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "jwt-catalog-"));
  t.after(async () => {
    await fs.rm(pluginDir, { recursive: true, force: true });
    await fs.rm(temp, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(pluginDir, "package.json"), JSON.stringify({ name, version: "1.0.0", main: "index.cjs" }));
  await fs.writeFile(path.join(pluginDir, "index.cjs"), `
    const { z } = require("zod");
    module.exports = { routes: [
      { method: "POST", path: "/secure", requestSchema: z.object({}), responseSchema: z.object({ ok: z.boolean() }), handler: () => ({ ok: true }) },
      {
        method: "POST", path: "/orders/:id",
        requestSchema: z.object({ amount: z.coerce.number().min(1) }),
        paramsSchema: z.object({ id: z.coerce.number().int().positive() }),
        querySchema: z.object({ page: z.coerce.number().int().positive() }),
        responseSchema: z.object({ total: z.number() }),
        handler: (body, _context, metadata) => ({ total: body.amount + metadata.params.id + metadata.query.page })
      },
      { method: "POST", path: "/invalid-response", requestSchema: z.object({}), responseSchema: z.object({ secret: z.number() }), handler: () => ({ secret: "sensitive-output" }) }
    ] };
  `);
  const catalog = path.join(temp, "plugins.yaml");
  await fs.writeFile(catalog, JSON.stringify({ plugins: [{ name, package: name, version: "1.0.0", enabled: true, supportedSdkRange: "*" }] }));
  const app = await startRuntime({
    catalogPath: catalog, host: "127.0.0.1", port: 0, legacy: [],
    jwtSettings: { Issuer: issuer, Audience: "plugins", MetadataAddress: `${issuer}/metadata`, RequireHttpsMetadata: false, TokenValidationParameters: { ClockSkew: "00:00:05" } },
  });
  t.after(() => app.close());
  const base = await app.getUrl();
  const now = Math.floor(Date.now() / 1000);
  const token = (claims, key = privateKey, alg = "RS256") => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg, kid: "key-1", typ: "JWT" })}.${encode(claims)}`;
    return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url")}`;
  };
  const request = async (bearer) => fetch(`${base}/secure`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: "{}",
  });
  const good = { iss: issuer, aud: "plugins", exp: now + 60 };
  assert.equal((await request()).status, 401);
  assert.equal((await request(token(good))).status, 401);
  discoveryIssuer = issuer;
  assert.equal((await request(token(good))).status, 200);
  assert.equal((await request(token({ ...good, iss: "http://wrong" }))).status, 401);
  assert.equal((await request(token({ ...good, aud: "wrong" }))).status, 401);
  assert.equal((await request(token({ ...good, exp: now - 20 }))).status, 401);
  assert.equal((await request(token({ ...good, exp: now - 2 }))).status, 200);
  assert.equal((await request(token({ ...good, nbf: now + 60 }))).status, 401);
  assert.equal((await request(token({ iss: issuer, aud: "plugins" }))).status, 401);
  const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal((await request(token(good, otherKey))).status, 401);
  assert.equal((await request(token(good, privateKey, "RS512"))).status, 401);
  const post = (url, body) => fetch(`${base}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token(good)}` },
    body: JSON.stringify(body),
  });
  const valid = await post("/orders/2?page=3", { amount: "4" });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { total: 9 });
  for (const [url, body] of [
    ["/orders/2?page=3", { amount: 0 }],
    ["/orders/not-a-number?page=3", { amount: 4 }],
    ["/orders/2?page=invalid", { amount: 4 }],
  ]) {
    const invalid = await post(url, body);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).message, "Invalid request");
  }
  const invalidResponse = await post("/invalid-response", {});
  assert.equal(invalidResponse.status, 500);
  const errorBody = JSON.stringify(await invalidResponse.json());
  assert.ok(!errorBody.includes("sensitive-output"));
  assert.ok(!errorBody.includes("secret"));
  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
});
