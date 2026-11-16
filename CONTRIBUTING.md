# Contributing

Read the [design overview](./README.md) and
[repository instructions](./.github/copilot-instructions.md) first.

## Development workflow

1. Use Node 22.15+ in the 22 LTS line or Node 26 LTS.
2. Create a feature branch from the latest `main`.
3. Install from the lockfile and run the relevant checks.

```powershell
git switch main
git pull --ff-only
git switch -c feat/my-change
npm ci
npx nx run-many -t build lint test --parallel=3
```

Make focused changes, add regression tests, and update directly related docs.
Use strict TypeScript without `any`. Use Zod for runtime contracts and
configuration. Never commit credentials, bearer tokens, local app settings,
installed dependencies, caches or generated build output. Commit package
manifest and lockfile changes together.

For a focused check with prerequisites built:

```powershell
npx nx run '@api-platform/billing-reference-plugin:test'
```

For affected checks, use an explicit baseline on a feature branch:

```powershell
npx nx affected -t build lint test --base=origin/main --head=HEAD --parallel=3
```

Include a changeset for changes to publishable package behavior/contracts:

```powershell
npm run changeset
```

Select the changed packages and explain the consumer impact. Do not manually
run publishing commands as part of routine contribution; the release workflow
owns publication.

## Plugin ownership rules

Plugins own route schemas, request/response mapping and orchestration through
`context.capabilities.*`. They must not:

- Import from backend adapters or platform implementation packages.
- Perform database queries or call external backends directly.
- Implement authentication, authorization or shared semantic business rules.
- Bundle the host SDK, shared models, NestJS, Zod or OpenTelemetry packages.
- Store shared business state in process-local memory.

Ask the platform team for a capability when the required operation does not
exist. A plugin must not bypass the boundary to implement it.

## Create a core-team plugin

Use the [billing reference](./plugins/core-team-plugins/billing-reference-plugin/)
as the working template. Add a directory under the existing workspace glob:

```powershell
New-Item -ItemType Directory -Force `
  plugins\core-team-plugins\my-plugin\src, `
  plugins\core-team-plugins\my-plugin\test
```

### 1. Package the plugin

Create a package manifest with its own version, build output and host peers:

```json
{
  "name": "@api-platform/my-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && node --test test/*.test.cjs"
  },
  "peerDependencies": {
    "@api-platform/plugin-api": "^0.1.0",
    "@api-platform/shared-models": "^0.1.0",
    "zod": "^3.25.0"
  }
}
```

Use the current repository scope, `@api-platform`, not `@platform`. If a plugin
uses NestJS or OpenTelemetry directly, declare those as peers too. The host
must supply compatible versions. For an external plugin repository, list
the peers in development dependencies as well if needed for local compilation
and tests; do not bundle them into the published artifact.

Copy the reference plugin's [TypeScript configuration](./plugins/core-team-plugins/billing-reference-plugin/tsconfig.json).
It emits ESM and declarations without bundling peers, and resolves built SDK
and model declarations. Keep the default export as the `PluginDefinition`;
the runtime imports that export. TypeScript aliases alone do not install or
bundle runtime dependencies.

Run `npm install` after adding the manifest to link the workspace and update
the lockfile. Keep the portable lockfile policy in [.npmrc](./.npmrc).

### 2. Define schemas and a route

The [reference implementation](./plugins/core-team-plugins/billing-reference-plugin/src/index.ts)
contains a complete, compiling example with `PluginRoute` and
`PluginDefinition`. For the billing operation, it uses shared request and
response schemas and this handler:

```typescript
handler: ({ msisdn }, context) =>
  context.capabilities.billing.resendLatestBill(msisdn)
```

Use shared models when a contract is shared; otherwise define local Zod
schemas. Layer 1 validates syntax/shape; eligibility, existence checks and
other business invariants belong in the capability.

The current SDK provides:

- `requestSchema`: required body schema, with parsed output passed as argument 1.
- `responseSchema`: required schema checked against the handler result.
- `paramsSchema` and `querySchema`: optional schemas; parsed outputs are passed
  as `{ params, query }` in argument 3.
- Argument 2: a typed `PluginContext` containing only capability facades.
- Optional `onInit(context)` and `onDestroy(context)` lifecycle hooks.

HTTP query and path values generally arrive as strings; use explicit Zod
coercion where intended. Support only documented literal and `:param` routes,
avoid conflicts with existing routes, and do not use `/health`.

**Current typing limitation:** `PluginDefinition.routes` erases individual
request types to `unknown`. Follow the reference adapter handler that parses
the unknown request into the typed route rather than adding an unsafe cast.
Do not assume the capability version follows the SDK package version.

### 3. Test without a backend

Mock the capability-only context and assert that the handler forwards the
correct arguments and propagates errors. The
[reference unit tests](./plugins/core-team-plugins/billing-reference-plugin/test/plugin.test.cjs)
also validate the definition and request/response schemas.

```powershell
npx nx run '@api-platform/billing-reference-plugin:test'
npm pack --workspace @api-platform/billing-reference-plugin --dry-run
```

Replace the package name for your plugin. The dry run should contain compiled
plugin code and metadata, not copies of peer runtimes. Add cases for malformed
inputs, output shape, mapping, and capability rejection. Unit tests that call
handlers directly must parse inputs explicitly; HTTP Layer 1 validation runs
in the runtime interceptor.

### 4. Register and supply the plugin

Add a manifest entry to the [local catalog](./plugin-catalog/plugins.yaml):

```yaml
plugins:
  - name: my-plugin
    package: "@api-platform/my-plugin"
    version: "0.1.0"
    enabled: false
    supportedSdkRange: "^0.1.0"
```

- `version` must exactly match the installed plugin package.
- `supportedSdkRange` declares compatible **SDK** versions, not capability
  versions. Test the range against the installed SDK.
- Start disabled until the host supplies the required capabilities.
- The normal entry point currently injects no capabilities. Host integration
  must supply a `capabilityFactory` to `startRuntime` and return the correct
  versioned providers; never inject raw adapter instances.
- Legacy SDK support requires an explicit future expiry and a factory that
  returns matching shims. It is not automatically enabled by a version string.

The billing reference needs the v1 billing facade (string input,
`{ success: true }` output) and a real billing transport before real use.
Do not merely flip its enabled flag in production.

The plugin must be installed and compiled **before the image is built**.
Core workspace packages are installed by `npm ci`; review the explicit
workspace artifact copies in the [Dockerfile](./deployment/docker/Dockerfile)
when adding a new package. Add its compiled output and metadata to the final
image. External plugins require an approved, pinned installation in the host
image; adding a catalog entry does not download the package.

Register separately in each selected
[environment catalog](./environments/) only after review. Do not reuse the
root catalog as production configuration, and never enable versions absent
from the immutable image.

## Run locally

```powershell
npx nx run-many -t build --parallel=3
$env:OTEL_SDK_DISABLED = 'true'
$env:PLUGIN_CATALOG_PATH = Join-Path (Get-Location) 'plugin-catalog\plugins.yaml'
npm start --workspace @api-platform/runtime
```

Configure JWT through environment variables or an explicit `APP_SETTINGS_PATH`;
see the [runtime guide](./apps/runtime/README.md). Local settings are not
automatically generated or loaded from `.env`. Keep any locally created
settings file outside Git; do not assume all such filenames are ignored.

The runtime currently permits any valid JWT for the issuer/audience to call
all plugin routes. RBAC is not implemented. Health endpoints are public.

## Pull request checklist

- [ ] Dependencies follow plugin/capability/adapter ownership boundaries.
- [ ] Required host packages are peer dependencies, not bundled dependencies.
- [ ] Runtime schemas and SDK/capability compatibility are explicit.
- [ ] Build, lint and focused tests pass; regression cases are included.
- [ ] Package manifests and the portable lockfile agree.
- [ ] Catalog entries use exact installed versions and correct SDK ranges.
- [ ] Image packaging includes new plugins before catalog enablement.
- [ ] A changeset covers publishable package changes.
- [ ] Documentation is updated; credentials and generated output are excluded.

## Release and infrastructure contributions

Changesets versions publishable libraries/plugins independently. Runtime and
internal packages marked private are not published. npm registry configuration,
including GitHub Packages scope restrictions, is described in the
[deployment guide](./deployment/README.md).

Infrastructure changes should run:

```powershell
node --test deployment/test/infrastructure.test.cjs
docker build -f deployment/docker/Dockerfile -t platform-runtime:test .
```

The first command requires Helm. Do not rebuild artifacts between environments:
promotion must retain the image digest and the source commit's chart/values.
Use environment-specific catalogs and secret references. Real database and
credential isolation is an infrastructure responsibility, not something a
plugin or a namespace name can guarantee.
