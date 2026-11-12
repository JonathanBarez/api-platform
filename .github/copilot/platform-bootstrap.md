# API Platform Bootstrap Context

## Objective

Create a production-grade TypeScript API Platform that supports:

- Plugin-based API development
- Centralized runtime governance
- Runtime-loaded API plugins
- Shared domain capabilities
- Contract-first development
- Semantic versioning
- Independent package releases
- Kubernetes deployment
- Multi-environment promotion

Target environments:

- DEV
- QA
- STAGING
- PREPROD
- PROD

Deployment artifacts must be containerized.

---

# Architecture Principles

## Platform Ownership

The Platform Team owns:

- Runtime
- Authentication
- Authorization
- Validation
- Telemetry
- Capability Registry
- Domain Services
- SDK Implementations
- Deployment Templates
- CI/CD Templates

Feature Teams own:

- API Plugins
- API Contracts
- Plugin Tests
- Plugin Releases

Plugins must never:

- Access databases directly
- Call backend services directly
- Implement authentication
- Implement authorization
- Implement platform telemetry

---

# Repository Type

Monorepo using Nx.

Repository name:

```text
platform-core
```

Package manager:

```text
pnpm
```

Node Version:

```text
22 LTS
```

---

# Repository Structure

Create the following structure.

```text
platform-core

├── apps
│   └── runtime
│
├── packages
│
│   ├── plugin-api
│   ├── domain-api
│   │
│   ├── customer-sdk
│   ├── billing-sdk
│   └── notification-sdk
│
├── services
│
│   ├── customer-domain
│   ├── billing-domain
│   └── notification-domain
│
├── plugins
│
│   └── billing-plugin-example
│
├── deployment
│
│   ├── helm
│   │
│   └── environments
│       ├── dev
│       ├── qa
│       ├── staging
│       ├── preprod
│       └── prod
│
├── .changeset
│
└── .github
    └── workflows
```

---

# Runtime Requirements

Framework:

```text
NestJS
```

Runtime responsibilities:

- Plugin loading
- Dependency injection
- Request validation
- Response validation
- OpenAPI generation
- Telemetry
- Capability registration

Provide:

```ts
PluginLoader
PluginRegistry
CapabilityRegistry
```

Implement runtime startup sequence.

```text
Load Plugins
Validate Compatibility
Register Routes
Start Runtime
```

---

# Package: plugin-api

Purpose:

Provide interfaces used by plugin developers.

Create:

```ts
PluginManifest
PluginDefinition
PluginRoute
PluginContext
```

Example:

```ts
export interface PluginManifest {
  name: string;
  version: string;
  runtimeVersion: string;
}
```

---

# Package: domain-api

Purpose:

Expose platform-owned contracts.

Create interfaces:

```ts
CustomerDomain
BillingDomain
NotificationDomain
```

Example:

```ts
export interface CustomerDomain {

  getActiveCustomerByMsisdn(
      msisdn: string
  ): Promise<Customer>;

}
```

No implementation.

Contracts only.

---

# SDK Packages

Create:

```text
customer-sdk
billing-sdk
notification-sdk
```

Provide:

- Contract layer
- Implementation layer
- Capability decorators

Example:

```ts
@Capability("customer.findByMsisdn")
```

SDKs must not expose persistence details.

---

# Domain Services

Implement:

```text
customer-domain
billing-domain
notification-domain
```

These services consume SDKs.

These services own:

- Semantic validation
- Shared business validation
- Capability orchestration

Example:

```ts
billingDomain.resendLatestBill()
```

---

# Example Plugin

Create:

```text
billing-plugin-example
```

Endpoint:

```http
POST /billing/resend
```

Request:

```json
{
  "msisdn": "32470123456"
}
```

Implementation:

```text
BillingPlugin
ResendBillHandler
RequestSchema
ResponseSchema
```

Plugin should only call:

```ts
billingDomain.resendLatestBill()
```

No direct SDK usage.

---

# Validation

Use:

```text
Zod
```

Runtime must enforce:

- Request validation
- Response validation

Plugins only define schemas.

Runtime executes validation.

---

# Versioning Strategy

Use:

```text
Changesets
```

Each package versioned independently.

Examples:

```text
@platform/customer-sdk
@platform/billing-sdk
@platform/domain-api
@platform/plugin-api
```

Version tags must be package-scoped.

Example:

```text
customer-sdk@1.2.0
billing-sdk@2.1.0
runtime@1.0.0
```

Avoid repository-wide versioning.

---

# CI/CD Strategy

Use GitHub Actions.

Implement reusable workflows.

Required workflows:

```text
build.yml
test.yml
release-packages.yml
release-runtime.yml
deploy.yml
```

---

# Build Workflow

Trigger:

- Pull Request

Actions:

- Install Dependencies
- Lint
- Unit Tests
- Build

---

# Package Release Workflow

Trigger:

- Merge to main

Actions:

- Detect affected packages
- Apply Changesets versioning
- Publish packages

Target:

GitHub Packages

Packages:

```text
plugin-api
domain-api
customer-sdk
billing-sdk
notification-sdk
```

---

# Runtime Release Workflow

Trigger:

Changes under:

```text
apps/runtime/**
services/**
```

Actions:

- Build runtime
- Build Docker image
- Push image to registry

Tag:

```text
runtime-x.y.z
```

---

# Deployment Strategy

Deployment must be environment-agnostic.

Create one reusable deployment workflow.

Workflow Input:

```yaml
environment:
```

Allowed values:

```text
dev
qa
staging
preprod
prod
```

---

# Environment Configuration

Create:

```text
deployment/environments/dev
deployment/environments/qa
deployment/environments/staging
deployment/environments/preprod
deployment/environments/prod
```

Each environment contains:

```yaml
runtimeVersion:
pluginVersions:
sdkVersions:
replicaCount:
```

Example:

```yaml
runtimeVersion: 1.0.0

plugins:
  billing-plugin-example: 1.0.0

replicaCount: 2
```

---

# Kubernetes

Create Helm chart.

Location:

```text
deployment/helm/platform-runtime
```

Support:

- Deployment
- Service
- ConfigMap
- Ingress
- HPA

Values must be environment-driven.

---

# Deployment Workflow

Reusable workflow:

```yaml
workflow_call:
```

Inputs:

```yaml
environment:
runtimeVersion:
```

Steps:

- Read environment configuration
- Pull runtime image
- Deploy Helm chart
- Wait for rollout
- Run smoke test

Must support all environments.

No duplicated deployment workflows.

---

# Observability

Include:

```text
OpenTelemetry
```

Provide:

- Request tracing
- Plugin tracing
- Capability tracing

All plugin requests must be traceable.

---

# Security

Provide:

- JWT Authentication
- RBAC Authorization
- Dependency Scanning
- Container Scanning

Security must be enforced by runtime.

Plugins must not implement security.

---

# Deliverables

Generate:

- Nx Workspace
- NestJS Runtime
- Package Scaffolding
- Domain Service Scaffolding
- Example Plugin
- Dockerfile
- Helm Chart
- GitHub Actions Workflows
- Changesets Configuration
- README
- Architecture Decision Records (ADR)

All generated code should be production-ready and follow enterprise coding standards.