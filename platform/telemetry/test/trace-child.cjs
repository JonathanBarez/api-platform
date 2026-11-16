const { initializeTelemetry, shutdownTelemetry, withPluginTelemetry, traceCapability } = require("../dist");
initializeTelemetry();
const http = require("node:http");
const { trace } = require("@opentelemetry/api");
const { BillingAdapter } = require("@api-platform/billing-adapter");
const { BillingCapability } = require("@api-platform/billing-capability");

const adapter = new BillingAdapter({
  findCustomer: async () => ({ id: "c1", active: true }),
  findLatestBill: async () => ({ id: "b1", resendAllowed: true }),
  resendBill: async () => {
    const response = await fetch(process.env.TEST_BACKEND_URL);
    if (!response.ok) throw new Error("Backend failed");
    return { accepted: true };
  },
}, { timeoutMs: 2000, maxReadAttempts: 1, retryDelayMs: 0, failureThreshold: 2, resetTimeoutMs: 1000 });
const billing = traceCapability(new BillingCapability(adapter).provider("v2"), "billing");
const server = http.createServer((_request, response) => {
  withPluginTelemetry({ name: "test-plugin", version: "1.2.3" }, () =>
    trace.getTracer("test").startActiveSpan("plugin.route", async (span) => {
      try {
        await billing.resendLatestBill({ msisdn: "+123456789" });
        response.end("ok");
      } catch {
        response.statusCode = 500;
        response.end("failed");
      } finally {
        span.end();
      }
    }),
  );
});
server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
process.on("message", async () => {
  await new Promise((resolve) => server.close(resolve));
  await shutdownTelemetry();
  process.disconnect();
});
