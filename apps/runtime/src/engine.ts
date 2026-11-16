import "reflect-metadata";
import {
  Body, Controller, Get, Head, HttpCode, Injectable, Module, Options, Patch,
  Post, Put, Delete, UseGuards,
  BadRequestException, InternalServerErrorException, Logger,
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
import { z } from "zod";
import { AuthenticationGuard } from "./jwt-auth";
import { jwtSettingsSchema } from "./jwt-settings";
import type { JwtSettingsInput } from "./jwt-settings";

const logger = new Logger("Runtime");
const log = (level: "log" | "warn" | "error", event: string, details: Record<string, unknown> = {}) =>
  logger[level](JSON.stringify({ event, ...details }));

async function pluginSpan<T>(step: string, name: string, action: () => Promise<T>): Promise<T> {
  return trace.getTracer("@api-platform/runtime").startActiveSpan(`plugin.${step}`, async (span) => {
    span.setAttribute("plugin.name", name);
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
  });
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
  capabilityFactory?: (manifest: PluginManifest, compatibility: Compatibility) => Promise<CapabilitySet> | CapabilitySet;
}

const routeDecorators = { GET: Get, POST: Post, PUT: Put, PATCH: Patch, DELETE: Delete, HEAD: Head, OPTIONS: Options };
const pathSchema = z.string().regex(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/);

function controllerFor(plugin: Initialized, authGuard: AuthenticationGuard): Type<unknown> {
  class PluginController {}
  Controller()(PluginController);
  UseGuards(authGuard)(PluginController);
  plugin.definition.routes.forEach((route: PluginRoute, index) => {
    const key = `route${index}`;
    Object.defineProperty(PluginController.prototype, key, {
      configurable: true,
      value: async (body: unknown): Promise<unknown> =>
        trace.getTracer("@api-platform/runtime").startActiveSpan(
          "plugin.route",
          async (span) => {
            span.setAttribute("plugin.name", plugin.manifest.name);
            try {
              const request = await route.requestSchema.safeParseAsync(body);
              if (!request.success) throw new BadRequestException("Invalid request");
              const result: unknown = await route.handler(request.data, plugin.context);
              const response = await route.responseSchema.safeParseAsync(result);
              if (!response.success) {
                log("error", "plugin_response_invalid", { plugin: plugin.manifest.name, route: route.path });
                throw new InternalServerErrorException("Invalid plugin response");
              }
              span.setStatus({ code: SpanStatusCode.OK });
              return response.data;
            } catch (error: unknown) {
              span.setStatus({ code: SpanStatusCode.ERROR });
              if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
              log("error", "plugin_execution_failed", { plugin: plugin.manifest.name, route: route.path });
              throw new InternalServerErrorException("Plugin execution failed");
            } finally {
              span.end();
            }
          },
        ),
    });
    const descriptor = Object.getOwnPropertyDescriptor(PluginController.prototype, key);
    if (!descriptor) throw new Error("Unable to define plugin route");
    routeDecorators[route.method](route.path)(PluginController.prototype, key, descriptor);
    HttpCode(200)(PluginController.prototype, key, descriptor);
    Body()(PluginController.prototype, key, 0);
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
      const definition = await pluginSpan("load", candidate.manifest.name, () => loadPlugin(candidate.manifest));
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
      context = await pluginSpan("initialize", plugin.manifest.name, async () => {
        const capabilities = options.capabilityFactory
          ? await options.capabilityFactory(plugin.manifest, plugin.compatibility)
          : {};
        const result = pluginContextSchema.parse({ capabilities });
        context = result;
        await plugin.definition.onInit?.(result);
        return result;
      });
      initialized.push({ ...plugin, context });
    } catch (error: unknown) {
      log("error", "plugin_initialization_failed", { plugin: plugin.manifest.name, reason: error instanceof Error ? error.message : "unknown error" });
      if (context) {
        try { await plugin.definition.onDestroy?.(context); }
        catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
      }
    }
  }

  log("log", "register_routes");
  const registry = new PluginRegistry();
  const authGuard = new AuthenticationGuard(jwtSettings);
  const controllers: Type<unknown>[] = [HealthController];
  const routes = new Set<string>();
  for (const plugin of initialized) {
    try {
      const keys = plugin.definition.routes.map((route) => {
        pathSchema.parse(route.path);
        if (route.path.toLowerCase() === "/health" || route.path.toLowerCase().startsWith("/health/")) {
          throw new Error("Health routes are reserved");
        }
        return `${route.method} ${route.path.toLowerCase()}`;
      });
      if (new Set(keys).size !== keys.length || keys.some((key) => routes.has(key))) {
        throw new Error("Duplicate plugin route");
      }
      const controller = controllerFor(plugin, authGuard);
      registry.add(plugin);
      keys.forEach((key) => routes.add(key));
      controllers.push(controller);
    } catch (error: unknown) {
      log("error", "plugin_registration_failed", { plugin: plugin.manifest.name, reason: error instanceof Error ? error.message : "unknown error" });
      try { await plugin.definition.onDestroy?.(plugin.context); }
      catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
    }
  }

  @Injectable()
  class Shutdown {
    async onApplicationShutdown(): Promise<void> {
      for (const plugin of [...registry.values()].reverse()) {
        try { await plugin.definition.onDestroy?.(plugin.context); }
        catch { log("error", "plugin_cleanup_failed", { plugin: plugin.manifest.name }); }
      }
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
      try { await plugin.definition.onDestroy?.(plugin.context); }
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
