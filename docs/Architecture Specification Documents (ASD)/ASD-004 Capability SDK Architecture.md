# ASD-004 Capability SDK Architecture

## API Platform Modernization Initiative

### Document Information

| Attribute | Value |
|------------|---------|
| Document ID | ASD-004 |
| Title | Capability SDK Architecture |
| Version | 3.2 |
| Status | Proposed |
| Audience | Architects, Platform Team, Feature Teams |
| Parent Specification | ASD-001 Platform Vision and Scope |
| Related Specifications | ASD-002 Solution Architecture Overview, ASD-003 Artifact and Repository Architecture |

---

# 1. Purpose

The purpose of this document is to define the architecture of Capability SDK Packages, Capability Contracts, and Capability Implementations.

Capability SDKs are the primary mechanism used to:

- Reuse business functionality
- Encapsulate business rules
- Encapsulate domain validation
- Expose stable capability contracts
- Simplify Feature API Plugin development

This document defines capability architecture, ownership, lifecycle, and design principles.

Compatibility governance is defined in ASD-007 Capability Compatibility and Governance.

---

# 2. Capability Architecture Overview

The platform adopts a capability-centric architecture.

Capabilities provide reusable business functionality that can be consumed by multiple Feature API Plugins.

The capability model consists of three distinct elements:

```text
Capability SDK Package
        ↓
Capability Contract
        ↓
Capability Implementation
```

## Capability SDK Package

Build-time artifact.

Provides:

- Contracts
- Interfaces
- Type Definitions
- Developer Tooling

## Capability Contract

Capability interface exposed to consumers.

Defines:

- Operations
- Request Models
- Response Models
- Behavioral Expectations

## Capability Implementation

Runtime-hosted executable implementation.

Provides:

- Business Rules
- Domain Validation
- Enterprise Integration
- Error Translation

---

# 3. Capability Building Blocks

## 3.1 Capability SDK Packages

Capability SDK Packages are published development artifacts.

Examples:

```text
@company/capability-weather
@company/capability-time
@company/capability-customer
@company/capability-random-quote
```

Capability SDK Packages provide:

- Capability Contracts
- Type Definitions
- Development Interfaces
- Developer Tooling
- Version Metadata
- Compatibility Metadata

Capability SDK Packages are consumed during:

- Development
- Build
- Testing
- Local Debugging

Capability SDK Packages do not perform runtime execution.

---

## 3.2 Capability Contracts

Capability Contracts define the public interface of a capability.

Responsibilities:

- Expose operations
- Define inputs
- Define outputs
- Define capability expectations
- Provide compatibility boundaries

Capability Contracts shall be:

- Explicit
- Strongly typed
- Transport independent
- Implementation independent

---

### Example: Weather Capability Contract

```ts
export interface WeatherCapabilityContract {

  getForecast(
    city: string
  ): Promise<WeatherForecast>;
}

export interface WeatherForecast {
  city: string;
  temperature: number;
  conditions: string;
}
```

---

### Example: Time Capability Contract

```ts
export interface TimeCapabilityContract {

  getCurrentTime(
    timezone: string
  ): Promise<CurrentTime>;
}

export interface CurrentTime {
  timezone: string;
  timestamp: string;
}
```

---

### Example: Customer Capability Contract

```ts
export interface CustomerCapabilityContract {

  getCustomer(
    customerId: string
  ): Promise<Customer>;
}

export interface Customer {
  customerId: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
}
```

---

### Example: Random Quote Capability Contract

```ts
export interface RandomQuoteCapabilityContract {

  getQuote(): Promise<Quote>;
}

export interface Quote {
  quote: string;
  author?: string;
}
```

---

## 3.3 Capability Implementations

Capability Implementations provide runtime business functionality.

Responsibilities:

- Business Logic
- Domain Validation
- Enterprise Integration
- Error Translation
- Compatibility Support

Capability Implementations are selected and hosted by the Runtime.

Capability Implementations are not independently deployed.

---

### Example: Weather Capability Implementation

```ts
export class WeatherCapability
  implements WeatherCapabilityContract {

  async getForecast(
    city: string
  ): Promise<WeatherForecast> {

    return {
      city,
      temperature: 22,
      conditions: "Sunny"
    };
  }
}
```

---

### Example: Time Capability Implementation

```ts
export class TimeCapability
  implements TimeCapabilityContract {

  async getCurrentTime(
    timezone: string
  ): Promise<CurrentTime> {

    return {
      timezone,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

### Example: Customer Capability Implementation

```ts
export class CustomerCapability
  implements CustomerCapabilityContract {

  async getCustomer(
    customerId: string
  ): Promise<Customer> {

    return {
      customerId,
      displayName: "Example Customer",
      status: "ACTIVE"
    };
  }
}
```

---

### Example: Random Quote Capability Implementation

```ts
export class RandomQuoteCapability
  implements RandomQuoteCapabilityContract {

  async getQuote(): Promise<Quote> {

    return {
      quote: "Simplicity is the ultimate sophistication.",
      author: "Leonardo da Vinci"
    };
  }
}
```

---

# 4. Capability Lifecycle

A capability follows the lifecycle below.

```text
Define Contract
        ↓
Implement Capability
        ↓
Publish SDK Package
        ↓
Consume During Development
        ↓
Runtime Hosts Implementation
        ↓
Contract Evolution
```

Capability Contracts and Capability Implementations evolve independently of Feature API Plugins.

---

# 5. Capability Dependency Model

Capability Implementations may depend on:

- Capability Contracts
- Shared Models
- Supporting Capabilities

Capability Implementations shall not depend on:

- Feature API Plugins
- Runtime Internal Components
- Transport Protocols

---

## Example Capability Dependency

```ts
export class CustomerCapability
  implements CustomerCapabilityContract {

  constructor(
    private readonly quoteCapability:
      RandomQuoteCapabilityContract
  ) {}
}
```

Capability-to-capability dependencies shall occur only through contracts.

---

# 6. Capability Validation Model

Capabilities own Layer 2 validation.

Layer 2 validation includes:

- Domain Validation
- Semantic Validation
- Business Validation
- State Validation

Examples:

```text
Customer Exists
Customer Active
Customer Eligible
Supported City
Valid Timezone
```

Feature API Plugins shall not implement Layer 2 validation.

---

## Example Validation

```ts
if (!customer) {
  throw new CustomerNotFoundError();
}

if (customer.status !== "ACTIVE") {
  throw new CustomerInactiveError();
}
```

---

# 7. Capability Integration Model

Capabilities encapsulate integration concerns.

Examples:

```text
REST Services
SOAP Services
Databases
Messaging Systems
Third-Party APIs
```

Feature API Plugins remain isolated from integration details.

---

## Example

```ts
export class WeatherCapability {

  constructor(
    private readonly weatherClient:
      WeatherServiceClient
  ) {}

  async getForecast(
    city: string
  ) {

    return this.weatherClient
      .forecast(city);
  }
}
```

---

# 8. Capability Versioning Model

Capability SDK Packages are versioned independently.

Examples:

```text
@company/capability-weather
1.0.0
1.1.0
2.0.0
```

Contract versioning follows semantic versioning.

Capability compatibility governance is defined in ASD-007.

---

## Example Compatibility Metadata

```json
{
  "name": "@company/capability-weather",

  "version": "2.4.1",

  "contract": "2.x",

  "supportedLegacyContracts": [
    "1.x"
  ]
}
```

---

# 9. Capability Design Principles

## 9.1 Reusable

Capabilities shall maximize reuse.

---

## 9.2 Contract-First

Capability Contracts shall be defined before Capability Implementations.

---

## 9.3 Transport Independent

Capabilities shall not depend on:

- HTTP
- REST Controllers
- API Routing

---

## 9.4 Runtime Governed

Capability Implementations shall be selected and governed by the Runtime.

---

## 9.5 Technology Independent

Capability Contracts shall not expose technology-specific details.

---

## 9.6 Explicit Typing

Capability Contracts and Capability SDK Packages shall remain strongly typed.

---

# 10. Capability Constraints

The following constraints apply.

- Capability SDK Packages shall not expose HTTP endpoints.
- Capability SDK Packages shall not contain routing logic.
- Capability Contracts shall remain transport independent.
- Capability Implementations shall not expose transport concerns.
- Capability Implementations shall not depend on Feature API Plugins.
- Capability Implementations shall not determine runtime activation.
- Capability SDK Packages shall remain consumable as standard package dependencies.
- Feature API Plugins shall not contain reusable business functionality.

---

# 11. Ownership Responsibilities

## Platform Team

Owns:

- Capability SDK Packages
- Capability Contracts
- Capability Implementations
- Compatibility Metadata
- Capability Lifecycle
- Capability Governance

---

## Feature Teams

Consume:

- Capability SDK Packages
- Capability Contracts

Feature Teams do not own:

- Capability Implementations
- Capability Compatibility Governance
- Capability Runtime Selection

---

# 12. Related Documents

## Foundational Documents

- ASD-001 Platform Vision and Scope
- ASD-002 Solution Architecture Overview

## Core Architecture Documents

- ASD-003 Artifact and Repository Architecture
- ASD-005 Feature API Plugin Architecture
- ASD-006 Runtime Architecture

## Governance Documents

- ASD-007 Capability Compatibility and Governance

## Operational Documents

- ASD-008 Runtime Operations and Lifecycle
- ASD-009 Security Validation and Observability
- ASD-010 Deployment and Release Architecture

## Strategic Documents

- ASD-011 Future Architecture Roadmap