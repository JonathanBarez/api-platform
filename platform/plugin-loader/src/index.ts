import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join, parse as parsePath } from "node:path";
import { createRequire } from "node:module";
import { parse as parseYaml } from "yaml";
import { maxSatisfying, satisfies, valid, validRange } from "semver";
import { z } from "zod";
import { pluginDefinitionSchema, pluginManifestSchema } from "@api-platform/plugin-api";
import type { PluginDefinition, PluginManifest } from "@api-platform/plugin-api";

const catalogSchema = z.object({ plugins: z.array(z.unknown()) }).strict();
const packageNameSchema = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);
const policySchema = z.object({
  sdkVersion: z.string().refine((value) => valid(value) !== null, "Invalid SDK version"),
  legacy: z.array(z.object({
    sdkVersion: z.string().refine((value) => valid(value) !== null, "Invalid legacy SDK version"),
    expiresAt: z.string().datetime({ offset: true }),
  }).strict()),
}).strict();

export interface Compatibility {
  readonly kind: "current" | "legacy";
  readonly sdkVersion: string;
  readonly expiresAt?: string;
}

export type CompatibilityPolicy = z.infer<typeof policySchema>;

export async function loadCatalog(path: string): Promise<unknown[]> {
  const document: unknown = parseYaml(await readFile(path, "utf8"), { uniqueKeys: true });
  return catalogSchema.parse(document).plugins;
}

export function validatePolicy(policy: CompatibilityPolicy): CompatibilityPolicy {
  const parsed = policySchema.parse(policy);
  if (new Set(parsed.legacy.map((entry) => entry.sdkVersion)).size !== parsed.legacy.length) {
    throw new Error("Duplicate legacy SDK versions");
  }
  return parsed;
}

export function validateManifest(input: unknown): PluginManifest {
  const manifest = pluginManifestSchema.parse(input);
  packageNameSchema.parse(manifest.package);
  if (!valid(manifest.version) || !validRange(manifest.supportedSdkRange)) {
    throw new Error("Invalid plugin version or SDK range");
  }
  return manifest;
}

export function checkCompatibility(
  manifest: PluginManifest,
  policy: CompatibilityPolicy,
  now: Date = new Date(),
): Compatibility {
  if (satisfies(policy.sdkVersion, manifest.supportedSdkRange)) {
    return { kind: "current", sdkVersion: policy.sdkVersion };
  }
  const eligible = policy.legacy.filter((entry) => Date.parse(entry.expiresAt) > now.getTime());
  const version = maxSatisfying(eligible.map((entry) => entry.sdkVersion), manifest.supportedSdkRange);
  const legacy = eligible.find((entry) => entry.sdkVersion === version);
  if (!legacy) {
    throw new Error("Plugin SDK range is incompatible or expired");
  }
  return { kind: "legacy", sdkVersion: legacy.sdkVersion, expiresAt: legacy.expiresAt };
}

const localRequire = createRequire(__filename);

export function installedPackageVersion(name: string): string {
  const entry = localRequire.resolve(name);
  let directory = dirname(entry);
  const root = parsePath(directory).root;
  while (true) {
    try {
      const pkg: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      const metadata = z.object({ name: z.string(), version: z.string() }).passthrough().parse(pkg);
      if (metadata.name === name && valid(metadata.version)) return metadata.version;
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (directory === root) break;
    directory = dirname(directory);
  }
  throw new Error(`Could not find package metadata for ${name}`);
}

export async function loadPlugin(manifest: PluginManifest): Promise<PluginDefinition> {
  const installed = installedPackageVersion(manifest.package);
  if (installed !== manifest.version) {
    throw new Error(`Installed plugin version ${installed} does not match catalog version ${manifest.version}`);
  }
  const imported: unknown = await import(manifest.package);
  const moduleSchema = z.object({ default: z.unknown() }).passthrough();
  const module = moduleSchema.parse(imported);
  return pluginDefinitionSchema.parse(module.default);
}
