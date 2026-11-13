const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BillingAdapter, BillingAdapterError } = require("../dist");

const options = {
  timeoutMs: 20,
  maxReadAttempts: 3,
  retryDelayMs: 0,
  failureThreshold: 2,
  resetTimeoutMs: 30,
};

function transport(overrides = {}) {
  return {
    findCustomer: async () => ({ id: "c1", active: true }),
    findLatestBill: async () => ({ id: "b1", resendAllowed: true }),
    resendBill: async () => ({ accepted: true }),
    ...overrides,
  };
}

test("retries reads only and bounds attempts", async () => {
  let reads = 0;
  let writes = 0;
  const adapter = new BillingAdapter(transport({
    findCustomer: async () => {
      reads++;
      if (reads < 3) throw new Error("offline");
      return "ok";
    },
    resendBill: async () => { writes++; throw new Error("offline"); },
  }), options);
  assert.equal(await adapter.findCustomer("1234567"), "ok");
  assert.equal(reads, 3);
  await assert.rejects(adapter.resendBill("c1", "b1"), { code: "UNAVAILABLE" });
  assert.equal(writes, 1);
});

test("timeout aborts the request and opens the circuit", async () => {
  let signal;
  let calls = 0;
  const adapter = new BillingAdapter(transport({
    findCustomer: async (_, currentSignal) => {
      signal = currentSignal;
      calls++;
      return new Promise(() => {});
    },
  }), { ...options, maxReadAttempts: 1, failureThreshold: 1 });
  await assert.rejects(adapter.findCustomer("1234567"), { code: "TIMEOUT" });
  assert.equal(signal.aborted, true);
  await assert.rejects(adapter.findCustomer("1234567"), { code: "CIRCUIT_OPEN" });
  assert.equal(calls, 1);
});

test("half-open circuit permits one probe and closes after success", async () => {
  let calls = 0;
  let release;
  const adapter = new BillingAdapter(transport({
    findCustomer: async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return new Promise((resolve) => { release = resolve; });
    },
  }), { ...options, timeoutMs: 200, maxReadAttempts: 1, failureThreshold: 1, resetTimeoutMs: 1 });
  await assert.rejects(adapter.findCustomer("1234567"), { code: "UNAVAILABLE" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const probe = adapter.findCustomer("1234567");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await assert.rejects(adapter.findCustomer("1234567"), { code: "CIRCUIT_OPEN" });
  release("recovered");
  assert.equal(await probe, "recovered");
  assert.equal(calls, 2);
});

test("invalid resilience options fail explicitly", () => {
  assert.throws(() => new BillingAdapter(transport(), { ...options, maxReadAttempts: 0 }));
  assert.ok(new BillingAdapterError("TIMEOUT", "timeout") instanceof Error);
});
