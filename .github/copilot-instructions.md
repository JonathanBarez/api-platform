# API Platform Modernisation PoC

## GitHub Copilot Instructions

### Overview

This repository implements a Proof of Concept (PoC) capability platform.

The purpose is to validate:

- Runtime-hosted capabilities
- Runtime-loaded feature API plugins
- Contract-based capability resolution
- Feature flag driven API exposure
- OpenAPI aggregation

This is an MVP / architecture validation exercise, not a production platform.

---

# Core Architectural Principles

## Principle 1: Capabilities Own Business Logic

Capabilities contain:

- Business logic
- Domain validation
- Data access
- External integrations

Capabilities do NOT expose HTTP endpoints.

Example:

```text
CustomerCapability
 └─ Retrieves customer information
 └─ Validates business rules
 └─ Integrates with external systems
```

---

## Principle 2: Plugins Are Thin

Feature API Plugins may:

- Define routes
- Map requests
- Map responses
- Contribute OpenAPI metadata

Feature API Plugins must NOT:

- Implement business logic
- Implement domain validation
- Access databases directly
- Call enterprise services directly

Plugins should primarily delegate to capabilities.

Correct:

```typescript
return customerCapability.getCustomer(id);
```

Incorrect:

```typescript
const customer = await database.query(...)
```

---

## Principle 3: Runtime Owns Composition

Only the Runtime:

- Loads plugins
- Resolves capabilities
- Injects dependencies
- Activates plugins
- Generates OpenAPI

Plugins never instantiate capabilities.

Correct:

```typescript
constructor(
  customerCapability: CustomerCapabilityContract
)
```

Incorrect:

```typescript
new CustomerCapability()
```

---

# Repository Architecture

```text
apps/
 └── runtime/

packages/
 ├── runtime-core/
 ├── runtime-contracts/
 ├── capability-weather/
 ├── capability-time/
 ├── capability-customer/
 ├── capability-random-quote/
 ├── plugin-weather-api/
 ├── plugin-time-api/
 ├── plugin-customer-api/
 └── plugin-random-quote-api/

catalog/
 └── plugins.json
```

---

# Runtime Contracts

Every plugin must implement:

```typescript
export interface FeatureApiPlugin {
  manifest: PluginManifest;

  registerRoutes(
    server: FastifyInstance
  ): Promise<void>;

  getOpenApiDefinition(): OpenAPIDocument;
}
```

---

# Plugin Manifest

Every plugin must expose:

```typescript
export interface PluginManifest {
  id: string;
  version: string;
  featureFlag: string;
  capabilities: CapabilityReference[];
}
```

Example:

```typescript
{
  id: "weather-api",
  version: "1.0.0",
  featureFlag: "WeatherApi",
  capabilities: [
    {
      name: "@company/capability-weather",
      contract: "1.x"
    }
  ]
}
```

---

# Capability Contracts

Capabilities are consumed through interfaces.

Example:

```typescript
export interface WeatherCapabilityContract {
  getForecast(
    city: string
  ): Promise<WeatherForecast>;
}
```

Plugins must depend on capability contracts only.

---

# Compatibility Rules

Compatibility is contract based.

Allowed:

```text
Plugin Contract 1.x
Capability Contract 1.x
```

Rejected:

```text
Plugin Contract 1.x
Capability Contract 2.x
```

No adapters.
No compatibility windows.
No automatic upgrades.

---

# Feature Flags

A plugin becomes active only when:

- Plugin is registered
- Contract compatibility passes
- Feature flag is enabled

Activation formula:

```text
Registered
+
Compatible
+
Enabled
=
Active
```

---

# OpenAPI Rules

Each plugin contributes OpenAPI metadata.

The Runtime:

- Collects metadata from active plugins
- Generates a single OpenAPI document
- Excludes inactive plugins

---

# Technology Choices

Language:

- TypeScript

Runtime:

- Node.js LTS

Package Manager:

- pnpm

Validation:

- Zod

API Framework:

- Fastify

Documentation:

- OpenAPI 3

---

# Coding Rules

Prefer:

- Interfaces
- Constructor injection
- Dependency inversion
- Explicit typing

Avoid:

- Service locators
- Global state
- Singleton business services
- Reflection-heavy patterns

---

# PoC Non-Goals

Do not generate:

- Authentication
- Authorization
- Multi-tenancy
- Distributed runtime coordination
- Marketplace distribution
- Plugin approval workflows
- Dynamic plugin downloads
- Hot plugin replacement
- Advanced observability
- Kubernetes-specific code

If unsure, choose the simplest possible implementation.

---

# Success Criteria

The PoC is successful when:

1. Capabilities are independently developed.
2. Plugins are independently developed.
3. Runtime injects capabilities into plugins.
4. Feature flags control exposure.
5. Incompatible plugins are rejected.
6. OpenAPI is generated from active plugins.
7. Weather, Time, Customer, and Random Quote examples function end-to-end.
```