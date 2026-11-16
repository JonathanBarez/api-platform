import { resolve } from "node:path";
import { z } from "zod";
import { startRuntime } from "./engine";
import { loadJwtSettings } from "./jwt-settings";

const environment = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  PLUGIN_CATALOG_PATH: z.string().min(1).default(resolve(__dirname, "..", "..", "..", "plugin-catalog", "plugins.yaml")),
}).parse(process.env);

async function main(): Promise<void> {
  const jwtSettings = await loadJwtSettings(process.env, process.cwd());
  await startRuntime({
    port: environment.PORT,
    host: environment.HOST,
    catalogPath: environment.PLUGIN_CATALOG_PATH,
    legacy: [],
    jwtSettings,
  });
}

main().catch((error: unknown) => {
  console.error("Runtime startup failed", error);
  process.exitCode = 1;
});
