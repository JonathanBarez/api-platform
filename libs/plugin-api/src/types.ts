import type { z } from "zod";

export type PluginHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface PluginManifest {
  readonly name: string;
  readonly package: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly supportedSdkRange: string;
}

export interface CapabilityCompatibility {
  readonly requestedVersion: string;
  readonly resolvedVersion: string;
  readonly deprecated: boolean;
  readonly shimmed: boolean;
  readonly deprecationEndsAt?: string;
}

export interface CapabilityProvider {
  readonly name: string;
  readonly version: string;
  readonly compatibility?: CapabilityCompatibility;
}

export type CapabilityShim<TCapability extends CapabilityProvider> = TCapability & {
  readonly compatibility: CapabilityCompatibility;
};

export type CapabilitySet = Readonly<Record<string, CapabilityProvider>>;

export interface PluginContext<
  TCapabilities extends CapabilitySet = CapabilitySet,
> {
  readonly capabilities: TCapabilities;
}

export type MaybePromise<T> = T | Promise<T>;

export interface PluginRoute<
  TRequestSchema extends z.ZodType<unknown> = z.ZodType<unknown>,
  TResponseSchema extends z.ZodType<unknown> = z.ZodType<unknown>,
  TCapabilities extends CapabilitySet = CapabilitySet,
> {
  readonly path: string;
  readonly method: PluginHttpMethod;
  readonly requestSchema: TRequestSchema;
  readonly responseSchema: TResponseSchema;
  readonly handler: (
    request: z.output<TRequestSchema>,
    context: PluginContext<TCapabilities>,
  ) => MaybePromise<z.output<TResponseSchema>>;
}

export interface PluginDefinition<
  TCapabilities extends CapabilitySet = CapabilitySet,
> {
  readonly onInit?: (
    context: PluginContext<TCapabilities>,
  ) => MaybePromise<void>;
  readonly onDestroy?: (
    context: PluginContext<TCapabilities>,
  ) => MaybePromise<void>;
  readonly routes: readonly PluginRoute<
    z.ZodType<unknown>,
    z.ZodType<unknown>,
    TCapabilities
  >[];
}
