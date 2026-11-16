import { context, createContextKey, diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Attributes, Context } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { z } from "zod";

const attributesKey = createContextKey("api-platform.attributes");
const attributesSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));

class PlatformAttributesProcessor implements SpanProcessor {
  onStart(span: Span, parent: Context): void {
    const attributes = parent.getValue(attributesKey);
    if (attributes !== undefined) span.setAttributes(attributesSchema.parse(attributes));
  }
  onEnd(): void {}
  async forceFlush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

let sdk: NodeSDK | undefined;

export function initializeTelemetry(): void {
  if (sdk) throw new Error("Telemetry has already been initialized");
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  const settings = z.object({
    OTEL_SERVICE_NAME: z.string().min(1).default("api-platform-runtime"),
    OTEL_SDK_DISABLED: z.enum(["true", "false"]).default("false"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional(),
  }).parse(process.env);
  if (settings.OTEL_SDK_DISABLED === "true") return;
  sdk = new NodeSDK({
    serviceName: settings.OTEL_SERVICE_NAME,
    textMapPropagator: new W3CTraceContextPropagator(),
    spanProcessors: [
      new PlatformAttributesProcessor(),
      new BatchSpanProcessor({ exporter: new OTLPTraceExporter() }),
    ],
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
    metricReaders: [],
    logRecordProcessors: [],
  });
  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}

export function withPluginTelemetry<T>(
  plugin: { readonly name: string; readonly version: string },
  action: () => T,
): T {
  return context.with(context.active().setValue(attributesKey, {
    "plugin.name": plugin.name,
    "plugin.version": plugin.version,
  }), action);
}

export function traceCapability<T extends object>(provider: T, name: string): T {
  return new Proxy(provider, {
    get(target, key, receiver): unknown {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]): unknown => {
        const inherited = context.active().getValue(attributesKey);
        const attributes: Attributes = {
          ...(inherited === undefined ? {} : attributesSchema.parse(inherited)),
          "capability.name": name,
        };
        return context.with(context.active().setValue(attributesKey, attributes), () =>
          trace.getTracer("@api-platform/telemetry").startActiveSpan(`capability.${name}.${String(key)}`, (span) => {
            const finish = (failed = false): void => {
              span.setStatus({ code: failed ? SpanStatusCode.ERROR : SpanStatusCode.OK });
              span.end();
            };
            try {
              const result: unknown = Reflect.apply(value, target, args);
              if (result instanceof Promise) {
                return result.then(
                  (output: unknown) => { finish(); return output; },
                  (error: unknown) => { finish(true); throw error; },
                );
              }
              finish();
              return result;
            } catch (error: unknown) {
              finish(true);
              throw error;
            }
          }),
        );
      };
    },
  });
}
