import "reflect-metadata";
import {
  Body, Controller, Get, Head, HttpCode, Injectable, Module, Options, Patch,
  Post, Put, Delete, Req, UseGuards, UseInterceptors,
  InternalServerErrorException, Logger,
} from "@nestjs/common";
import type { INestApplication, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { pluginContextSchema } from "@api-platform/plugin-api";
import type { CapabilitySet, PluginContext, PluginDefinition, PluginManifest, PluginRoute } from "@api-platform/plugin-api";
import {
  checkCompatibility, installedPackageVersion, loadCatalog, loadPlugin,
  validateManifest, validatePolicy,
} from "@api-platform/plugin-loader";
import type { Compatibility, CompatibilityPolicy } from "@api-platform/plugin-loader";
import { PluginRegistry } from "@api-platform/plugin-registry";
import { getValidatedRequestMetadata, PluginValidationInterceptor } from "@api-platform/validation";
import { traceCapability, withPluginTelemetry } from "@api-platform/telemetry";
import { z } from "zod";
import { AuthenticationGuard } from "./jwt-auth";
import { jwtSettingsSchema } from "./jwt-settings";
import type { JwtSettingsInput } from "./jwt-settings";

const logger = new Logger("Runtime");
const log = (level: "log" | "warn" | "error", event: string, details: Record<string, unknown> = {}) =>
  logger[level](JSON.stringify({ event, ...details }));

async function pluginSpan<T>(step: string, manifest: PluginManifest, action: () => Promise<T>): Promise<T> {
  return withPluginTelemetry(manifest, () => trace.getTracer("@api-platform/runtime").startActiveSpan(`plugin.${step}`, async (span) => {
    try {
      const result = await action();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: unknown) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }));
}

@Controller("health")
class HealthController {
  @Get("live")
  live(): object { return { status: "ok" }; }

  @Get("ready")
  ready(): object { return { status: "ok" }; }

  @Get("startup")
  startup(): object { return { status: "ok" }; }
}

type Candidate = { manifest: PluginManifest; compatibility: Compatibility };
type Loaded = Candidate & { definition: PluginDefinition };
type Initialized = Loaded & { context: PluginContext };

export interface RuntimeOptions {
  catalogPath: string;
  port: number;
  host: string;
  legacy: CompatibilityPolicy["legacy"];
  jwtSettings?: JwtSettingsInput;
  shutdownTelemetry?: () => Promise<void>;
  capabilityFactory?: (manifest: PluginManifest, compatibility: Compatibility) => Promise<CapabilitySet> | CapabilitySet;
}

const routeDecorators = { GET: Get, POST: Post, PUT: Put, PATCH: Patch, DELETE: Delete, HEAD: Head, OPTIONS: Options };
const pathSchema = z.string().regex(/^\/(?:[a-zA-Z0-9_-]+|:[a-zA-Z_][a-zA-Z0-9_]*)(?:\/(?:[a-zA-Z0-9_-]+|:[a-zA-Z_][a-zA-Z0-9_]*))*$/);

function routesOverlap(first: PluginRoute, second: PluginRoute): boolean {
  if (first.method !== second.method) return false;
  const left = first.path.toLowerCase().split("/");
  const right = second.path.toLowerCase().split("/");
  return left.length === right.length && left.every(
    (segment, index) => segment.startsWith(":") || right[index].startsWith(":") || segment === right[index],
  );
}

function controllerFor(plugin: Initialized, authGuard: AuthenticationGuard): Type<unknown> {
  class PluginController {}
  Controller()(PluginController);
  UseGuards(authGuard)(PluginController);
  plugin.definition.routes.forEach((route: PluginRoute, index) => {
    const key = `route${index}`;
    Object.defineProperty(PluginController.prototype, key, {
      configurable: true,
      value: async (body: unknown, request: Parameters<typeof getValidatedRequestMetadata>[0]): Promise<unknown> =>
        withPluginTelemetry(plugin.manifest, () => trace.getTracer("@api-platform/runtime").startActiveSpan(
          "plugin.route",
          async (span) => {
            span.setAttribute("plugin.name", plugin.manifest.name);
            try {
              const result: unknown = await route.handler(body, plugin.context, getValidatedRequestMetadata(request));
              span.setStatus({ code: SpanStatusCode.OK });
              return result;
            } catch (error: unknown) {
              span.setStatus({ code: SpanStatusCode.ERROR });
              if (error instanceof InternalServerErrorException) throw error;
              log("error", "plugin_execution_failed", { plugin: plugin.manifest.name, route: route.path });
              throw new InternalServerErrorException("Plugin execution failed");
            } finally {
              span.end();
            }
          },
        )),
    });
    const descriptor = Object.getOwnPropertyDescriptor(PluginController.prototype, key);
    if (!descriptor) throw new Error("Unable to define plugin route");
    routeDecorators[route.method](route.path)(PluginController.prototype, key, descriptor);
    UseInterceptors(new PluginValidationInterceptor(route, plugin.manifest.name))(PluginController.prototype, key, descriptor);
    HttpCode(200)(PluginController.prototype, key, descriptor);
    Body()(PluginController.prototype, key, 0);
    Req()(PluginController.prototype, key, 1);
  });
  return PluginController;
}

export async function startRuntime(options: RuntimeOptions): Promise<INestApplication> {
  const parsedOptions = z.object({
    catalogPath: z.string().min(1),
    host: z.string().min(1),
    port: z.number().int().min(0).max(65535),
  }).passthrough().parse(options);
  const jwtSettings = options.jwtSettings === undefined ? undefined : jwtSettingsSchema.parse(options.jwtSettings);
  if (jwtSettings) {
    log("warn", "authorization_policy_not_configured", {
      message: "All valid JWTs can access all plugin routes until RBAC is configured",
    });
    if (!jwtSettings.RequireHttpsMetadata) {
      log("warn", "jwt_https_metadata_disabled", { message: "OIDC discovery and signing keys may use HTTP" });
    }
  } else {
    log("warn", "jwt_authentication_not_configured", { message: "Plugin routes deny all requests" });
  }
  const policy = validatePolicy({
    sdkVersion: installedPackageVersion("@api-platform/plugin-api"),
    legacy: options.legacy,
  });

  log("log", "load_catalog");
  const catalog = await loadCatalog(parsedOptions.catalogPath);
  const candidates: Candidate[] = [];
  const names = new Set<string>();
  log("log", "validate_compatibility");
  for (const raw of catalog) {
    try {
      const manifest = validateManifest(raw);
      if (!manifest.enabled) continue;
      if (names.has(manifest.name)) throw new Error("Duplicate enabled plugin name");
      names.add(manifest.name);
      const compatibility = checkCompatibility(manifest, policy);
      if (compatibility.kind === "legacy") {
        log("warn", "plugin_sdk_deprecated", { plugin: manifest.name, ...compatibility });
      }
      candidates.push({ manifest, compatibility });
    } catch (error: unknown) {
      const identity = z.object({ name: z.string() }).passthrough().safeParse(raw);
      log("error", "plugin_compatibility_rejected", {
        severity: "critical",
        plugin: identity.success ? identity.data.name : undefined,
        reason: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  log("log", "load_plugins");
  const loaded: Loaded[] = [];
  for (const candidate of candidates) {
    try {
      const definition = await pluginSpan("load", candidate.manifest, () => loadPlugin(candidate.manifest));
      loaded.push({ ...candidate, definition });
    } catch (error: unknown) {
      log("error", "plugin_load_failed", { plugin: candidate.manifest.name, reason: error instanceof Error ? error.message : "unknown error" });
    }
  }

  log("log", "inject_capabilities");
  const initialized: Initialized[] = [];
  for (const plugin of loaded) {
    let context: PluginContext | undefined;
    try {
      if (plugin.compatibility.kind === "legacy" && !options.capabilityFactory) {
        throw new Error("Legacy capability factory is not configured");
      }
      context = await pluginSpan("initialize", plugin.manifest, async () => {
        const capabilities = options.capabilityFactory
          ? await options.capabilityFactory(plugin.manifest, plugin.compatibility)
          : {};
        const instrumented: Record<string, CapabilitySet[string]> = {};
        for (const [name, provider] of Object.entries(capabilities)) {
          instrumented[name] = traceCapability(provider, name);
        }
        const result = pluginContextSchema.parse({ capabilities: instrumented });
        context = result;
        await plugin.definition.onInit?.(result);
        return result;
      });
      initialized.push({ ...plugin, context });
    } catch (error: unknown) {
      log("error", "plugin_initialization_failed", { plugin: plugin.manifest.name, reason: error instanceof Error ? error.message : "unknown error" });
      if (context) {
        const initializedContext = context;
        try { await withPluginTelemetry(plugin.manifest, () => plugin.definition.onDestroy?.(initializedContext)); }
        catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
      }
    }
  }

  log("log", "register_routes");
  const registry = new PluginRegistry();
  const authGuard = new AuthenticationGuard(jwtSettings);
  const controllers: Type<unknown>[] = [HealthController];
  const routes: PluginRoute[] = [];
  for (const plugin of initialized) {
    try {
      for (const route of plugin.definition.routes) {
        pathSchema.parse(route.path);
        if (route.path.toLowerCase() === "/health" || route.path.toLowerCase().startsWith("/health/")) {
          throw new Error("Health routes are reserved");
        }
        if (routes.some((existing) => routesOverlap(route, existing))) {
          throw new Error("Overlapping plugin route");
        }
      }
      if (plugin.definition.routes.some((route, index) =>
        plugin.definition.routes.slice(0, index).some((existing) => routesOverlap(route, existing)))) {
        throw new Error("Overlapping plugin route");
      }
      const controller = controllerFor(plugin, authGuard);
      registry.add(plugin);
      routes.push(...plugin.definition.routes);
      controllers.push(controller);
    } catch (error: unknown) {
      log("error", "plugin_registration_failed", { plugin: plugin.manifest.name, reason: error instanceof Error ? error.message : "unknown error" });
      try { await withPluginTelemetry(plugin.manifest, () => plugin.definition.onDestroy?.(plugin.context)); }
      catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
    }
  }

  @Injectable()
  class Shutdown {
    async onApplicationShutdown(): Promise<void> {
      for (const plugin of [...registry.values()].reverse()) {
        try { await withPluginTelemetry(plugin.manifest, () => plugin.definition.onDestroy?.(plugin.context)); }
        catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
      }
      await options.shutdownTelemetry?.();
    }
  }
  @Module({ controllers, providers: [Shutdown] })
  class RuntimeModule {}

  log("log", "start_runtime");
  let app: INestApplication;
  try {
    app = await NestFactory.create(RuntimeModule, { abortOnError: false });
  } catch (error: unknown) {
    for (const plugin of [...registry.values()].reverse()) {
      try { await withPluginTelemetry(plugin.manifest, () => plugin.definition.onDestroy?.(plugin.context)); }
      catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
    }
    throw error;
  }
  app.enableShutdownHooks();
  try {
    await app.listen(parsedOptions.port, parsedOptions.host);
  } catch (error: unknown) {
    await app.close();
    throw error;
  }
  return app;
}
