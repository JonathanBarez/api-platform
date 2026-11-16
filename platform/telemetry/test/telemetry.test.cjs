const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { fork } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");

test("exports plugin, capability and adapter spans with W3C context across HTTP boundaries", { timeout: 20000 }, async (t) => {
  const exports = [];
  let downstreamTraceparent;
  const collector = createServer(async (req, res) => {
    if (req.url === "/backend") {
      downstreamTraceparent = req.headers.traceparent;
      res.end("ok");
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    exports.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.setHeader("content-type", "application/json");
    res.end("{}");
  });
  await new Promise((resolve) => collector.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => collector.close(resolve)));
  const base = `http://127.0.0.1:${collector.address().port}`;
  const child = fork(path.join(__dirname, "trace-child.cjs"), {
    env: { ...process.env, OTEL_SDK_DISABLED: "false", OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${base}/v1/traces`, TEST_BACKEND_URL: `${base}/backend`, OTEL_TRACES_SAMPLER: "always_on" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const ready = await Promise.race([
    once(child, "message").then(([message]) => message),
    once(child, "exit").then(() => { throw new Error(`Telemetry child exited early: ${output}`); }),
  ]);
  const traceId = "1234567890abcdef1234567890abcdef";
  const response = await fetch(`http://127.0.0.1:${ready.port}`, {
    headers: { traceparent: `00-${traceId}-1234567890abcdef-01` },
  });
  assert.equal(response.status, 200, output);
  const exit = once(child, "exit");
  child.send("shutdown");
  const [code] = await exit;
  assert.equal(code, 0, output);
  const spans = exports.flatMap((batch) => batch.resourceSpans.flatMap((resource) =>
    resource.scopeSpans.flatMap((scope) => scope.spans)));
  const plugin = spans.find((span) => span.name === "plugin.route");
  assert.ok(plugin, output);
  const normalizeId = (id) => /^[0-9a-f]{32}$/i.test(id) ? id.toLowerCase() : Buffer.from(id, "base64").toString("hex");
  assert.equal(normalizeId(plugin.traceId), traceId);
  for (const name of ["plugin.route", "capability.billing.resendLatestBill", "billing.capability.resendLatestBill", "billing.adapter.resendBill"]) {
    const span = spans.find((entry) => entry.name === name);
    assert.ok(span, `Missing ${name}: ${output}`);
    const attributes = Object.fromEntries(span.attributes.map((attribute) => [attribute.key, attribute.value.stringValue]));
    assert.equal(attributes["plugin.name"], "test-plugin");
    assert.equal(attributes["plugin.version"], "1.2.3");
    if (name !== "plugin.route") assert.equal(attributes["capability.name"], "billing");
    assert.equal(normalizeId(span.traceId), traceId);
  }
  assert.ok(downstreamTraceparent?.startsWith(`00-${traceId}-`));
});
