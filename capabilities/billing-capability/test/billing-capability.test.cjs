const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BillingAdapter, BillingAdapterError } = require("@api-platform/billing-adapter");
const { BillingCapability } = require("../dist");

const options = { timeoutMs: 100, maxReadAttempts: 1, retryDelayMs: 0, failureThreshold: 2, resetTimeoutMs: 100 };
function setup(overrides = {}) {
  let writes = 0;
  const transport = {
    findCustomer: async () => ({ id: "c1", active: true }),
    findLatestBill: async () => ({ id: "b1", resendAllowed: true }),
    resendBill: async () => { writes++; return { accepted: true }; },
    ...overrides,
  };
  return { capability: new BillingCapability(new BillingAdapter(transport, options)), writes: () => writes };
}

test("v1 and v2 shims expose only the capability and return their respective payloads", async () => {
  const { capability } = setup();
  const v1 = capability.provider("v1");
  const v2 = capability.provider("v2");
  assert.deepEqual(await v1.resendLatestBill("+123456789"), { success: true });
  assert.deepEqual(await v2.resendLatestBill({ msisdn: "+123456789" }), { status: "accepted", billId: "b1" });
  assert.equal(v1.compatibility.shimmed, true);
  assert.equal(v1.compatibility.deprecated, true);
  assert.deepEqual(Object.keys(v2).sort(), ["name", "resendLatestBill", "version"]);
  assert.equal(v2.adapter, undefined);
  assert.throws(() => capability.provider("v3"), /Unsupported billing capability version/);
});

for (const [label, overrides, input, code] of [
  ["invalid request", {}, "bad", "INVALID_INPUT"],
  ["missing customer", { findCustomer: async () => null }, "1234567", "CUSTOMER_NOT_FOUND"],
  ["inactive customer", { findCustomer: async () => ({ id: "c1", active: false }) }, "1234567", "CUSTOMER_INACTIVE"],
  ["invalid customer", { findCustomer: async () => ({ active: true }) }, "1234567", "BACKEND_INVALID_RESPONSE"],
  ["missing bill", { findLatestBill: async () => null }, "1234567", "BILL_NOT_FOUND"],
  ["disallowed resend", { findLatestBill: async () => ({ id: "b1", resendAllowed: false }) }, "1234567", "RESEND_NOT_ALLOWED"],
  ["invalid bill", { findLatestBill: async () => ({ id: "b1" }) }, "1234567", "BACKEND_INVALID_RESPONSE"],
]) {
  test(label, async () => {
    const { capability, writes } = setup(overrides);
    await assert.rejects(capability.resendLatestBill(input), { code });
    assert.equal(writes(), 0);
  });
}

test("translates adapter failures and rejects invalid resend responses", async () => {
  const { capability } = setup({ resendBill: async () => { throw new BillingAdapterError("TIMEOUT", "timeout"); } });
  await assert.rejects(capability.resendLatestBill("1234567"), (error) => {
    assert.equal(error.code, "BACKEND_TIMEOUT");
    assert.equal(error.cause, undefined);
    return true;
  });
  const other = setup({ resendBill: async () => ({ accepted: false }) });
  await assert.rejects(other.capability.resendLatestBill("1234567"), { code: "BACKEND_INVALID_RESPONSE" });
});
