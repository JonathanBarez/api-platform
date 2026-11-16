import type { PluginContext, PluginDefinition, PluginManifest } from "@api-platform/plugin-api";
import type { Compatibility } from "@api-platform/plugin-loader";

export interface RegisteredPlugin {
  readonly manifest: PluginManifest;
  readonly compatibility: Compatibility;
  readonly definition: PluginDefinition;
  readonly context: PluginContext;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, RegisteredPlugin>();

  add(plugin: RegisteredPlugin): void {
    if (this.plugins.has(plugin.manifest.name)) {
      throw new Error(`Duplicate plugin name: ${plugin.manifest.name}`);
    }
    this.plugins.set(plugin.manifest.name, plugin);
  }

  values(): readonly RegisteredPlugin[] {
    return [...this.plugins.values()];
  }
}
