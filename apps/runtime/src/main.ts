import { resolve } from "node:path";
import { z } from "zod";
import { initializeTelemetry, shutdownTelemetry } from "@api-platform/telemetry";
import { loadJwtSettings } from "./jwt-settings";

const environment = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  PLUGIN_CATALOG_PATH: z.string().min(1).default(resolve(__dirname, "..", "..", "..", "plugin-catalog", "plugins.yaml")),
}).parse(process.env);

async function main(): Promise<void> {
  initializeTelemetry();
  const { startRuntime } = await import("./engine.js");
  const jwtSettings = await loadJwtSettings(process.env, process.cwd());
  await startRuntime({
    port: environment.PORT,
    host: environment.HOST,
    catalogPath: environment.PLUGIN_CATALOG_PATH,
    legacy: [],
    jwtSettings,
    shutdownTelemetry,
  });
}

main().catch(async (error: unknown) => {
  console.error("Runtime startup failed", error);
  process.exitCode = 1;
  await shutdownTelemetry().catch((shutdownError: unknown) => console.error("Telemetry shutdown failed", shutdownError));
});
