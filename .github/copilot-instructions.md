# GitHub Copilot Instructions — API Platform Core

## 1. Core Philosophy & Anti-Hallucination Guardrails
- **Simplicity First:** Write clean, explicit, and readable TypeScript. Avoid over-engineering, unnecessary design patterns, deep inheritance trees, or clever metaprogramming.
- **No Hallucinations:** Only import packages and modules that already exist in `package.json` or the workspace (`libs/`, `capabilities/`, `backend-adapters/`, `platform/`, `shared-models/`). If a dependency or file does not exist yet, explicitly state it or use a standard workspace interface rather than inventing external libraries.
- **Incremental Scope:** Only modify or generate files explicitly requested in the prompt. Do not refactor unrelated modules.

---

## 2. Technology Stack & Standards
- **Language:** TypeScript (Strict Mode enabled; never use `any`—use `unknown` with type guards or Zod schemas).
- **Runtime & Framework:** Node 22 LTS, NestJS.
- **Monorepo Tooling:** Nx with npm workspaces.
- **Validation:** Zod (mandatory for all runtime schemas, configurations, and API contracts).
- **Observability:** OpenTelemetry (distributed tracing across runtime, plugins, capabilities, and adapters).
- **Infrastructure & CI/CD:** Docker, Kubernetes, Helm, GitHub Actions, Changesets.

---

## 3. Architectural Boundaries (Strict Enforcement)

### Repository Structure
Respect the exact Nx monorepo layout:
- `apps/runtime/` — Core NestJS runtime application.
- `libs/plugin-api/` — Public SDK contracts (`PluginManifest`, `PluginDefinition`, `PluginRoute`, `PluginContext`, `CapabilityProvider`).
- `capabilities/` — Business logic, semantic validation, and backend orchestration (`customer-capability`, `billing-capability`, `payment-capability`, `notification-capability`).
- `backend-adapters/` — External system/database integrations (`crm-adapter`, `billing-adapter`, `payment-adapter`, `notification-adapter`).
- `platform/` — Core platform concerns (`auth`, `authorization`, `validation`, `telemetry`, `plugin-loader`, `plugin-registry`).
- `shared-models/` — Shared domain types and DTOs.
- `plugins/core-team-plugins/` — Platform-owned reference or core plugins.
- `plugin-catalog/plugins.yaml` — Declarative registry of enabled plugins and versions.
- `deployment/helm/platform-runtime/` — Kubernetes Helm charts.
- `environments/` — Isolated environment configs (`dev`, `qa`, `staging`, `preprod`, `prod`).

### Ownership & Isolation Rules
- **Plugins (`plugins/` & external plugin repos):**
  - May ONLY interact with the platform via `context.capabilities.*` from `libs/plugin-api`.
  - **NEVER** import from `backend-adapters/` or `platform/` directly.
  - **NEVER** implement database queries, direct HTTP calls to external backends, authentication, authorization, or semantic business rules.
- **Capabilities (`capabilities/`):**
  - Own business rules, semantic validation (e.g., verifying customer/bill existence and eligibility), data mapping, and error translation.
  - May ONLY call `backend-adapters/` for external data access—never bypass adapters.
- **Runtime (`apps/runtime/`):**
  - Must remain completely stateless to support 50+ horizontal replicas in Kubernetes.
  - Must follow the exact boot sequence: Load Catalog → Validate Compatibility → Load Plugins → Inject Capabilities → Register Routes → Start Runtime.
  - Wrap plugin loading and execution in strict error boundaries so a failing plugin never crashes the host runtime.

---

## 4. Two-Layer Validation Standard
1. **Layer 1 (Runtime Validation — `platform/validation`):** Use Zod to validate incoming HTTP request payloads/params and outgoing responses against route schemas.
2. **Layer 2 (Capability Validation — `capabilities/*`):** Enforce domain/semantic rules and business state invariants before invoking backend adapters.

---

## 5. Observability, Reliability & Deployment Rules
- **Tracing:** Propagate OpenTelemetry trace context across all runtime boundaries, plugin invocations, capability calls, and backend adapters.
- **Resilience:** Implement explicit timeouts, bounded retries, and circuit breakers inside `backend-adapters/`.
- **Kubernetes & Helm:** All Kubernetes manifests must support stateless execution, include `livenessProbe`, `readinessProbe`, and `startupProbe`, and isolate configurations/secrets per environment (`dev`, `qa`, `staging`, `preprod`, `prod`).
- **Immutable Promotion:** Never generate CI/CD workflows that rebuild container images or packages between environments (`DEV → QA → STAGING → PREPROD → PROD`).