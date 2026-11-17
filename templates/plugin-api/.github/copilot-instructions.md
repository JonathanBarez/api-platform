# API Plugin Development Guidelines

These guidelines apply to this feature-team plugin repository. Keep them aligned
with the API Platform Core standards for the SDK version this plugin targets.
The platform team owns the runtime, capabilities, adapters and security policy.

## Implementation standards

- Use strict TypeScript; never use `any`. Narrow `unknown` with type guards or Zod.
- Use Node 22.15+ within the 22 LTS line, or Node 26 LTS, consistent with the host.
- Keep code explicit and focused. Follow existing repository conventions and
  avoid unrelated changes, speculative abstractions and invented dependencies.
- Inspect package manifests, installed SDK declarations and existing code before
  importing a package or calling a capability. Do not invent capability methods.
- Use the repository's configured package manager, build, lint and test commands.
  Update its lockfile when dependency manifests change.

## Plugin boundaries

- Access platform operations only through `context.capabilities.*`.
- Never import core `platform/`, `backend-adapters/` or capability implementation
  modules. Use SDK contracts and host-provided capability facades.
- Never query databases, make direct external backend HTTP calls, implement
  authentication/authorization, or duplicate capability-owned business rules.
- Own only API schemas, request/response mapping and capability orchestration.
- Ask for a platform capability when an operation is unavailable; do not bypass
  the boundary or return a fabricated success response.
- Remain stateless across requests. Do not use in-memory state, local files or
  plugin instances as shared business storage across runtime replicas.

## Contracts and compatibility

- Export a default `PluginDefinition` using the installed
  `@api-platform/plugin-api` contracts and declare routes with `PluginRoute`.
- Use Zod for request bodies, optional params/query and response schemas.
  Layer 1 validates shapes; capabilities own Layer 2 semantic validation.
- Use published `@api-platform/shared-models` contracts where applicable.
- Preserve existing clients and documented payload shapes. Request a
  versioned capability facade/shim for compatibility; do not implement platform
  shims or silently switch capability versions inside a plugin.
- Declare a tested `supportedSdkRange` in catalog registration metadata and an
  exact plugin package version. SDK and capability versions are independent.
- Keep initialization/destruction bounded; clean up owned resources. Propagate
  failures explicitly instead of swallowing errors or exposing backend details.

## Packaging and observability

- Declare `@api-platform/plugin-api`, shared models, `zod`, and any used
  `@nestjs/*` or `@opentelemetry/*` packages as `peerDependencies`.
  Development dependencies may supply peers for standalone local testing.
- Never bundle or vendor host framework/SDK packages. Inspect the package
  contents and bundler externals before publishing.
- Use the host OpenTelemetry API/context if adding spans; do not initialize
  another SDK, exporter, tracer provider or context manager in the plugin.
- Never log credentials, JWTs, full payloads or customer identifiers such as
  MSISDNs. Do not commit credentials or environment-specific secrets.
- Publish immutable versions. Do not rebuild plugin artifacts between
  DEV, QA, STAGING, PREPROD and PROD; catalog entries select installed versions.

## Verification and maintenance

- Test handlers with mocked `PluginContext` capabilities, without live backends.
  Cover argument mapping, invalid schemas, response shapes and error propagation.
- Run the repository's build, lint and relevant tests; verify peer dependencies
  are excluded from published artifacts. Update API documentation and release
  notes using the repository's release tooling.
- Keep this file and local contribution instructions current when adopting a
  new core SDK or capability version. Team-specific additions must not weaken
  the platform boundaries. Resolve conflicting requirements with the platform
  team before implementation; do not assume agent instructions enforce policy.
