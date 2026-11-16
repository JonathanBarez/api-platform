const { test } = require("node:test");
const assert = require("node:assert/strict");
const { default: plugin, resendBillRoute } = require("../dist");
const { pluginDefinitionSchema } = require("@api-platform/plugin-api");

test("resend delegates only the MSISDN to a mocked PluginContext", async () => {
  const calls = [];
  /** @type {import("@api-platform/plugin-api").PluginContext<import("../dist").BillingCapabilities>} */
  const context = {
    capabilities: {
      billing: {
        name: "billing",
        version: "1.0.0",
        resendLatestBill: async (msisdn) => {
          calls.push(msisdn);
          return { success: true };
        },
      },
    },
  };
  pluginDefinitionSchema.parse(plugin);
  const route = plugin.routes[0];
  assert.equal(route.method, "POST");
  assert.equal(route.path, "/bills/resend");
  const request = route.requestSchema.parse({ msisdn: "+123456789" });
  const result = await route.handler(request, context, { params: undefined, query: undefined });
  assert.deepEqual(route.responseSchema.parse(result), { success: true });
  assert.deepEqual(calls, ["+123456789"]);
});

test("schemas reject malformed inputs and outputs", () => {
  assert.equal(resendBillRoute.requestSchema.safeParse({ msisdn: "invalid" }).success, false);
  assert.equal(resendBillRoute.requestSchema.safeParse({}).success, false);
  assert.equal(resendBillRoute.requestSchema.safeParse({ msisdn: "+123456789", extra: true }).success, false);
  assert.equal(resendBillRoute.responseSchema.safeParse({ success: false }).success, false);
});

test("capability failures propagate without invented success responses", async () => {
  const failure = new Error("resend denied");
  const context = { capabilities: { billing: {
    name: "billing", version: "1.0.0",
    resendLatestBill: async () => { throw failure; },
  } } };
  await assert.rejects(plugin.routes[0].handler(
    { msisdn: "+123456789" }, context, { params: undefined, query: undefined },
  ), (error) => error === failure);
});
