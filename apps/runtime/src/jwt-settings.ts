import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const clockSkewSchema = z.string().regex(/^\d{2}:[0-5]\d:[0-5]\d$/);

export const jwtSettingsSchema = z.object({
  Issuer: z.string().url(),
  Audience: z.string().min(1),
  MetadataAddress: z.string().url(),
  RequireHttpsMetadata: z.boolean().default(true),
  TokenValidationParameters: z.object({
    ValidateIssuer: z.literal(true).default(true),
    ValidateAudience: z.literal(true).default(true),
    ValidateLifetime: z.literal(true).default(true),
    ValidateIssuerSigningKey: z.literal(true).default(true),
    ClockSkew: clockSkewSchema.default("00:05:00"),
  }).strict().default({}),
}).strict().superRefine((settings, context) => {
  const metadata = new URL(settings.MetadataAddress);
  if (!["http:", "https:"].includes(metadata.protocol) || metadata.username || metadata.password || metadata.hash) {
    context.addIssue({ code: "custom", path: ["MetadataAddress"], message: "Invalid metadata URL" });
  }
  if (settings.RequireHttpsMetadata && metadata.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["MetadataAddress"], message: "HTTPS metadata is required" });
  }
});

export type JwtSettings = z.output<typeof jwtSettingsSchema>;
export type JwtSettingsInput = z.input<typeof jwtSettingsSchema>;

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

export async function loadJwtSettings(env: NodeJS.ProcessEnv, cwd: string): Promise<JwtSettingsInput | undefined> {
  const explicitPath = env.APP_SETTINGS_PATH;
  const path = explicitPath ? resolve(cwd, explicitPath) : resolve(cwd, "appsettings.json");
  let contents: string | undefined;
  try {
    contents = await readFile(path, "utf8");
  } catch (error: unknown) {
    if (explicitPath || !(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  let fileSettings: Record<string, unknown> = {};
  let hasFileSettings = false;
  if (contents !== undefined) {
    const root: unknown = JSON.parse(contents);
    const parsed = z.object({ JwtSettings: z.record(z.unknown()).optional() }).passthrough().parse(root);
    hasFileSettings = parsed.JwtSettings !== undefined;
    fileSettings = parsed.JwtSettings ?? {};
  }
  const mapping = {
    Issuer: env.JWT__ISSUER,
    Audience: env.JWT__AUDIENCE,
    MetadataAddress: env.JWT__METADATA_ADDRESS,
    RequireHttpsMetadata: env.JWT__REQUIRE_HTTPS_METADATA === undefined
      ? undefined : booleanString.parse(env.JWT__REQUIRE_HTTPS_METADATA),
  };
  const validationMapping = {
    ValidateIssuer: env.JWT__VALIDATE_ISSUER,
    ValidateAudience: env.JWT__VALIDATE_AUDIENCE,
    ValidateLifetime: env.JWT__VALIDATE_LIFETIME,
    ValidateIssuerSigningKey: env.JWT__VALIDATE_ISSUER_SIGNING_KEY,
    ClockSkew: env.JWT__CLOCK_SKEW,
  };
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (value !== undefined) overrides[key] = value;
  }
  const validationOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(validationMapping)) {
    if (value !== undefined) validationOverrides[key] = key === "ClockSkew" ? value : booleanString.parse(value);
  }
  const hasSettings = hasFileSettings
    || Object.keys(overrides).length > 0 || Object.keys(validationOverrides).length > 0;
  if (!hasSettings) return undefined;
  const validation = fileSettings.TokenValidationParameters === undefined
    ? {} : z.record(z.unknown()).parse(fileSettings.TokenValidationParameters);
  const input = {
    ...fileSettings,
    ...overrides,
    TokenValidationParameters: { ...validation, ...validationOverrides },
  };
  return jwtSettingsSchema.parse(input);
}
