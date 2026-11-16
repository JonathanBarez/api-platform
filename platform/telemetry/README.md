# Runtime tracing

Requires Node 22.15+ (22 LTS) or Node 26 LTS. The runtime entry point initializes
the SDK before importing NestJS and HTTP-consuming application modules.
Embedded hosts calling `startRuntime` must initialize telemetry before loading
the engine and pass `shutdownTelemetry` to flush spans on application shutdown.

Tracing uses W3C `traceparent`/`tracestate`, async context propagation, Node HTTP
instrumentation and Undici instrumentation (including Node's `fetch`). This
continues traces across replicas without any shared in-memory session state.
The host supplies the same OpenTelemetry API instance to plugins.

The exporter uses OTLP HTTP/JSON. Configure standard environment variables:

```powershell
$env:OTEL_SERVICE_NAME = 'api-platform-runtime'
$env:OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
$env:OTEL_TRACES_SAMPLER = 'parentbased_always_on'
```

`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` overrides the general endpoint and must
include the full trace path, such as `http://localhost:4318/v1/traces`.
Standard OTLP header/timeout and resource attribute variables are handled by
the exporter/SDK. Keep exporter credentials in environment secrets, not source.
`OTEL_SDK_DISABLED=true` disables initialization. Metrics and log export are
not enabled by this tracing-only module.

`withPluginTelemetry` attaches `plugin.name` and `plugin.version` to child
spans. Runtime-injected capability facades are automatically instrumented by
`traceCapability`, adding `capability.name` to capability spans and their child
adapter/HTTP spans. No payloads, tokens or MSISDNs are recorded by these helpers.
Calls made outside a plugin context naturally have no plugin attributes.

`npm test --workspace @api-platform/telemetry` uses a local collector and a
separate instrumented process to verify real export and inbound/outbound W3C
trace continuity through the billing capability and adapter. Build the billing
workspace dependencies before running this test.
