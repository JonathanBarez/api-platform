# ASD-005 Feature API Plugin Architecture

## API Platform Modernization Initiative

### Document Information

| Attribute | Value |
|------------|---------|
| Document ID | ASD-005 |
| Title | Feature API Plugin Architecture |
| Version | 3.2 |
| Status | Proposed |
| Audience | Architects, Platform Team, Feature Teams |
| Parent Specification | ASD-001 Platform Vision and Scope |
| Related Specifications | ASD-002 Solution Architecture Overview, ASD-003 Artifact and Repository Architecture, ASD-004 Capability SDK Architecture |

---

# 1. Purpose

The purpose of this document is to define the architecture of Feature API Plugins.

Feature API Plugins are the mechanism through which Feature Teams expose business functionality as APIs.

A Feature API Plugin provides:

- API Contracts
- Routes
- Request Mapping
- Response Mapping
- OpenAPI Metadata

Feature API Plugins do not contain reusable business functionality.

Reusable business functionality remains encapsulated within Runtime-hosted Capability Implementations.

---

# 2. Plugin Architecture Overview

Feature API Plugins act as orchestration and presentation layers.

They expose APIs while delegating business functionality to Capability Implementations.

The architecture intentionally separates:

```text
Feature API Plugin
        ↓
Capability Contract
        ↓
Capability Implementation
```

This separation enables:

- Capability Reuse
- Independent Team Ownership
- Controlled Capability Evolution
- Centralized Runtime Governance

---

# 3. Plugin Building Blocks

## 3.1 Feature API Plugin Package

Feature API Plugin Packages are build-time artifacts.

Examples:

```text
@company/weather-api-plugin
@company/time-api-plugin
@company/customer-api-plugin
@company/random-quote-api-plugin
```

Feature API Plugin Packages contain:

- Route Definitions
- API Models
- Request Mapping
- Response Mapping
- OpenAPI Metadata
- Plugin Metadata

Feature API Plugin Packages do not contain:

- Capability Implementations
- Business Rules
- Runtime Governance Logic

---

## 3.2 Feature API Plugin

A Feature API Plugin is the runtime-loaded instance of a Feature API Plugin Package.

Feature API Plugins execute inside the Runtime.

Feature API Plugins interact with Runtime-provided Capability Implementations through Capability Contracts.

---

## 3.3 Plugin Manifest

Every Feature API Plugin shall expose a Plugin Manifest.

The Plugin Manifest provides metadata used by the Runtime.

Example:

```ts
export const manifest = {
  id: "weather-api",

  version: "1.0.0",

  featureFlag: "WeatherApi",

  capabilities: [
    {
      name: "@company/capability-weather",
      contract: "1.x"
    }
  ]
};
```

The Plugin Manifest shall not determine:

- Runtime Capability Implementation Versions
- Runtime Compatibility Decisions
- Runtime Capability Selection

These responsibilities remain under Runtime governance.

---

## 3.4 OpenAPI Contribution

Feature API Plugins contribute OpenAPI metadata.

The Runtime aggregates metadata from active plugins to generate the complete OpenAPI specification.

---

# 4. Plugin Lifecycle

The Feature API Plugin lifecycle is:

```text
Design Plugin
        ↓
Implement Plugin
        ↓
Package Plugin
        ↓
Publish Plugin
        ↓
Register Plugin
        ↓
Runtime Activation
```

Activation and publication remain separate processes.

Publishing a plugin does not imply activation.

---

# 5. Capability Consumption Model

Feature API Plugins may consume Capability SDK Packages during:

- Development
- Build
- Testing
- Local Debugging

Example:

```json
{
  "dependencies": {
    "@company/capability-weather": "^1.0.0"
  }
}
```

Capability SDK Packages provide:

- Contracts
- Interfaces
- Type Definitions

At runtime, the plugin executes against Runtime-hosted Capability Implementations.

---

## 5.1 Build-Time Dependency

Development-time dependency model:

```text
Feature API Plugin
        ↓
Capability SDK Package
```

Used for:

- Compilation
- Type Safety
- Local Testing

---

## 5.2 Runtime Dependency

Runtime execution model:

```text
Feature API Plugin
        ↓
Capability Contract
        ↓
Capability Implementation
```

Capability Implementations are selected and provided by the Runtime.

Plugins do not determine Capability Implementation versions.

---

# 6. API Design Model

Feature API Plugins expose API contracts to consumers.

Responsibilities include:

- Route Definitions
- Request Models
- Response Models
- Status Codes
- API Documentation

Business functionality remains delegated to Capability Implementations.

---

## Example: Weather API Route

```ts
export class WeatherApiPlugin {

  constructor(
    private readonly weather:
      WeatherCapabilityContract
  ) {}

  async forecast(
    city: string
  ) {

    return this.weather
      .getForecast(city);
  }
}
```

---

## Example: Customer API Route

```ts
export class CustomerApiPlugin {

  constructor(
    private readonly customer:
      CustomerCapabilityContract
  ) {}

  async customerDetails(
    customerId: string
  ) {

    return this.customer
      .getCustomer(customerId);
  }
}
```

---

# 7. Request and Response Mapping

Feature API Plugins are responsible for API-level transformation.

Examples:

```text
Request Mapping
Response Mapping
Filtering
Formatting
API Model Translation
```

Plugins shall not implement:

```text
Business Validation
Business Rules
Enterprise Integration
```

---

## Example Request Mapping

```ts
export interface ForecastRequest {
  city: string;
}
```

---

## Example Response Mapping

```ts
export interface ForecastResponse {
  city: string;
  temperature: number;
  conditions: string;
}
```

---

# 8. Plugin Design Principles

## 8.1 Thin Orchestration Layer

Plugins should remain lightweight.

Business functionality belongs within Capability Implementations.

---

## 8.2 Capability Reuse

Plugins should reuse existing capabilities whenever possible.

---

## 8.3 Strong Typing

Plugins shall consume strongly typed capability contracts.

---

## 8.4 Runtime Independence

Plugins shall not directly interact with Runtime internals.

---

## 8.5 Transport Ownership

Plugins own API transport concerns.

Examples:

```text
Routes
API Models
OpenAPI Metadata
Status Codes
```

---

# 9. OpenAPI Model

Feature API Plugins provide route-level OpenAPI metadata.

Example:

```ts
{
  summary: "Retrieve weather forecast",
  operationId: "getForecast",
  tags: ["Weather"]
}
```

The Runtime aggregates all active plugin OpenAPI definitions into a single platform specification.

---

# 10. Plugin Packaging Model

Feature API Plugin Packages are distributed through platform-approved package distribution mechanisms.

Example package:

```text
@company/weather-api-plugin
```

Typical structure:

```text
weather-api-plugin
│
├── routes/
├── contracts/
├── models/
├── openapi/
├── manifest.ts
└── index.ts
```

---

# 11. Plugin Constraints

The following constraints apply.

Feature API Plugins:

- Shall not contain Capability Implementations.
- Shall not contain reusable business functionality.
- Shall not directly access Enterprise Systems.
- Shall not determine Runtime Capability Implementation versions.
- Shall not bypass Capability Contracts.
- Shall not implement Runtime Governance.
- Shall not expose Runtime internals.

Feature API Plugins may:

- Consume Capability SDK Packages.
- Define Routes.
- Define API Models.
- Contribute OpenAPI Metadata.

---

# 12. Ownership Responsibilities

## Feature Teams

Own:

- Feature API Plugin Packages
- API Contracts
- Route Definitions
- Request Mapping
- Response Mapping
- Plugin Packaging

---

## Platform Team

Owns:

- Runtime
- Capability SDK Packages
- Capability Contracts
- Capability Implementations
- Compatibility Governance
- Runtime Governance

---

# 13. Related Documents

## Foundational Documents

- ASD-001 Platform Vision and Scope
- ASD-002 Solution Architecture Overview

## Core Architecture Documents

- ASD-003 Artifact and Repository Architecture
- ASD-004 Capability SDK Architecture
- ASD-006 Runtime Architecture

## Governance Documents

- ASD-007 Capability Compatibility and Governance

## Operational Documents

- ASD-008 Runtime Operations and Lifecycle
- ASD-009 Security Validation and Observability
- ASD-010 Deployment and Release Architecture

## Strategic Documents

- ASD-011 Future Architecture Roadmap