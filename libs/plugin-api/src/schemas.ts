import { z } from "zod";
import type {
  CapabilityCompatibility,
  PluginDefinition,
  PluginManifest,
  PluginRoute,
} from "./types";

export const pluginHttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

export const pluginManifestSchema: z.ZodType<PluginManifest> = z
  .object({
    name: z.string().min(1),
    package: z.string().min(1),
    version: z.string().min(1),
    enabled: z.boolean(),
    supportedSdkRange: z.string().min(1),
  })
  .strict();

export const capabilityCompatibilitySchema: z.ZodType<CapabilityCompatibility> = z
  .object({
    requestedVersion: z.string().min(1),
    resolvedVersion: z.string().min(1),
    deprecated: z.boolean(),
    shimmed: z.boolean(),
    deprecationEndsAt: z.string().min(1).optional(),
  })
  .strict();

export const capabilityProviderSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    compatibility: capabilityCompatibilitySchema.optional(),
  })
  .passthrough();

export const capabilityShimSchema = capabilityProviderSchema.extend({
  compatibility: capabilityCompatibilitySchema,
});

export const pluginContextSchema = z
  .object({
    capabilities: z.record(capabilityProviderSchema),
  })
  .strict();

const zodSchemaSchema = z.custom<z.ZodType<unknown>>(
  (value): value is z.ZodType<unknown> => value instanceof z.ZodType,
  "Expected a Zod schema",
);

const pluginHandlerSchema = z.custom<PluginRoute["handler"]>(
  (value): value is PluginRoute["handler"] => typeof value === "function",
  "Expected a plugin route handler",
);

export const pluginRouteSchema = z
  .object({
    path: z.string().min(1),
    method: pluginHttpMethodSchema,
    requestSchema: zodSchemaSchema,
    paramsSchema: zodSchemaSchema.optional(),
    querySchema: zodSchemaSchema.optional(),
    responseSchema: zodSchemaSchema,
    handler: pluginHandlerSchema,
  })
  .strict();

const lifecycleHookSchema = z.custom<
  NonNullable<PluginDefinition["onInit"]>
>(
  (value): value is NonNullable<PluginDefinition["onInit"]> =>
    typeof value === "function",
  "Expected a plugin lifecycle hook",
);

export const pluginDefinitionSchema = z
  .object({
    onInit: lifecycleHookSchema.optional(),
    onDestroy: lifecycleHookSchema.optional(),
    routes: z.array(pluginRouteSchema),
  })
  .strict();
