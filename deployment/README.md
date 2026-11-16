# Build, release and promote

## Required repository setup

Use Node 22.15+ (CI uses Node 22) or Node 26. Commit `package-lock.json`:
it records exact versions and integrity hashes without internal tarball URLs.
CI uses `npm ci`, caching npm downloads, not installed `node_modules`.
The generated lockfile still requires registry access on cache misses.

Protect `main`, require the Build and Test checks, and configure GitHub
environments named `dev`, `qa`, `staging`, `preprod`, `prod`, and `packages`.
Restrict deployment branches to `main`. Configure required reviewers and
other approval rules for the environments, especially production stages.
Those repository settings are external to these workflow files.

Each Kubernetes environment needs its own base64-encoded `KUBE_CONFIG`
GitHub environment secret. Grant its service account only the permissions
needed for Helm in the corresponding `api-platform-<environment>` namespace.
Pre-create the namespaces if that account cannot create namespaces.
Helm requires a working Kubernetes API and metrics-server for HPA.

## Environment isolation

The chart requires the environment-specific namespace and a digest.
Each environment has an independent `values.yaml` and `plugins.yaml`; the
deployment workflow passes that catalog explicitly rather than using the root
development catalog. Catalog updates roll pods through a configuration checksum.
Promoted catalogs must only refer to plugin versions already present in the
image; deployment never downloads or builds plugins.

Before deploying, pre-provision `platform-runtime-<environment>` in the matching
namespace. Populate it with that environment's `JWT__*` values and any adapter
credentials or connection strings. Use separate database instances/databases,
users, credentials and authorization grants per environment; never copy a shared
connection string across environments. This project has no database integration
or cloud provisioning implementation, so the chart cannot create those databases
or independently verify that external endpoints do not share data. That isolation
must be enforced in infrastructure provisioning and network/access policy.

No secrets or database endpoints are checked in. The optional Secret template
is off by default; enabling it stores values in Helm release history, so prefer
externally managed secrets. Rotate external secrets through your secret manager
and trigger a rollout after rotation. The chart intentionally does not generate
production credentials.

Ingress is off until each environment supplies a DNS host, ingress class and
TLS secret in its own values. For private GHCR images, provision a read-only
image pull secret in every namespace and set `imagePullSecrets` accordingly.
The deployment uses a non-root, read-only container and scales to 60 replicas.
Probes use `/health/startup`, `/health/ready` and `/health/live`. There is no
persistent local application storage.

The current runtime is authenticated-only, not RBAC-protected, as explicitly
chosen during runtime development. Do not expose production APIs until the
required scope/role policies are implemented. Catalogs start empty.

## CI

- `build.yml`: Nx affected build/lint, Helm render checks for every environment,
  and a Docker build and HTTP health smoke test without publishing.
- `test.yml`: Nx affected unit/integration tests on Node 22 and 26.
- Nx compares against the last successful workflow commit (PRs use their base),
  not `main` against itself. Checkouts retain history for that comparison.
- Nx build dependencies are ordered using `^build`; test prerequisites build
  their own project and dependencies even in a clean checkout.

Local verification (Helm 3.17.3 and Docker required for infrastructure/image):

```powershell
npm ci
npx nx run-many -t build lint test --parallel=3
node --test deployment/test/infrastructure.test.cjs
docker build -f deployment/docker/Dockerfile -t platform-runtime:test .
```

## Independently versioned packages

Add release notes with `npm run changeset` in package-changing PRs.
Changesets manages independent version bumps (no fixed or linked groups) and
opens a version PR after changes merge to `main`. Merging that PR publishes
unpublished versions. Private runtime/capability/adapter packages are not
published. The reference plugin is publishable alongside the SDK/models.
Build artifacts are generated before publishing; tsc does not bundle peers.

Configure `NPM_REGISTRY_URL` as a variable and `PACKAGES_TOKEN` as a secret in
the GitHub `packages` environment. The default registry is npmjs. The token must
be permitted to publish the `@api-platform` scope. Allow Actions to create PRs.

GHCR is for OCI/container images, not npm packages. To publish npm packages to
GitHub Packages, use `https://npm.pkg.github.com` and a scope matching the owning
GitHub user or organization. The current `@api-platform` scope does not match
`JonathanBarez`; renaming scopes or moving to a matching organization is a
separate migration. Do not point the existing scope at GitHub Packages and
expect publication to work unchanged.

## Build once, promote the digest

`release-runtime.yml` validates the workspace and chart, builds one image on
`main`, and publishes `ghcr.io/<owner>/api-platform-runtime:sha-<commit>`.
The tag is a human-readable label; the returned `sha256` digest is the immutable
deployment identity. Re-running a release can create another build, but all
stages within a promotion use exactly the one returned digest.

The workflow calls `deploy.yml` sequentially:
DEV -> QA -> STAGING -> PREPROD -> PROD. GitHub environment protection gates
each stage. A failure prevents downstream deployment; Helm uses atomic rollback
and waits for readiness. Deployment calls receive both the same image digest
and the source commit so values, charts, and catalogs cannot drift with `main`.
No deployment job rebuilds or repackages anything. The full promotion is
serialized; GitHub concurrency may replace older pending runs with newer ones.

For a manual Helm deployment, supply the same digest, release commit's chart,
and matching environment files:

```powershell
helm upgrade --install platform deployment/helm/platform-runtime `
  --namespace api-platform-dev --create-namespace `
  --values environments/dev/values.yaml `
  --set-file pluginCatalog=environments/dev/plugins.yaml `
  --set-string image.repository=ghcr.io/jonathanbarez/api-platform-runtime `
  --set-string image.digest=sha256:<64-hex-digest> --atomic --wait --timeout 10m
```
