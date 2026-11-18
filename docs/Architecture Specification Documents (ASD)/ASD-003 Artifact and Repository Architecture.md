# ASD-003 Artifact and Repository Architecture

## API Platform Modernization Initiative

### Document Information

| Attribute | Value |
|------------|---------|
| Document ID | ASD-003 |
| Title | Artifact and Repository Architecture |
| Version | 3.2 |
| Status | Proposed |
| Audience | Architects, Platform Team, Feature Teams, DevOps Engineers |
| Parent Specification | ASD-001 Platform Vision and Scope |
| Related Specification | ASD-002 Solution Architecture Overview |

---

# 1. Purpose

The purpose of this document is to define:

- Managed platform artifacts
- Repository ownership
- Repository structure
- Artifact lifecycles
- Publishing responsibilities
- Version ownership
- Dependency ownership

This document establishes where platform assets reside, who owns them, and how they are distributed.

Implementation behavior of capabilities, plugins, runtime execution, compatibility validation, startup procedures, deployment workflows, and security concerns are defined in subsequent Architecture Specification Documents. 【1-bf2ca1】【2-30b71d】

---

# 2. Architectural Principles

The repository architecture shall support:

- Independent Team Ownership
- Independent Release Cycles
- Capability Reuse
- Runtime Governance
- Controlled Compatibility
- Minimal Cross-Team Dependencies

Repository structure shall reflect ownership boundaries rather than deployment boundaries.

Artifact publication shall remain independent wherever possible.

---

# 3. Managed Artifact Types

The platform manages three primary artifact types.

## 3.1 Capability SDK Packages

Capability SDK Packages are build-time artifacts consumed by Feature API Plugin Packages.

Examples:

```text
@company/capability-customer
@company/capability-billing
@company/capability-notification
```

Capability SDK Packages provide:

- Capability Contracts
- Type Definitions
- Development Interfaces
- Developer Tooling
- Version Metadata

Capability SDK Packages do not provide runtime hosting.

---

## 3.2 Feature API Plugin Packages

Feature API Plugin Packages are deployable plugin artifacts developed by Feature Teams.

Examples:

```text
@company/customer-api-plugin
@company/billing-api-plugin
@company/notification-api-plugin
```

Feature API Plugin Packages provide:

- Route Definitions
- API Contracts
- Request Mapping
- Response Mapping
- OpenAPI Metadata

Feature API Plugin Packages do not contain Capability Implementations.

---

## 3.3 Runtime Image

The Runtime Image is the deployable execution environment of the platform.

Examples:

```text
runtime:1.0.0
runtime:1.5.0
runtime:2.0.0
```

The Runtime Image provides:

- Capability Implementation Hosting
- Plugin Hosting
- Runtime Governance
- Capability Selection
- Capability Governance
- API Exposure

The Runtime Image is the authoritative owner of Runtime-hosted Capability Implementations.

---

# 4. Repository Distribution Model

The platform follows a centralized capability ownership model and decentralized plugin ownership model.

```text
Platform Repository
│
├── Runtime
├── Capability SDK Packages
└── Deployment Assets

Feature Repositories
│
├── customer-api-plugin
├── billing-api-plugin
├── notification-api-plugin
└── weather-api-plugin
```

Runtime and Capability SDK Packages are owned by the Platform Team.

Feature API Plugin Packages are owned by Feature Teams.

---

## 4.1 Package Distribution Infrastructure

Published platform artifacts are distributed through platform-approved package distribution mechanisms.

The package distribution mechanism is responsible for storing and distributing:

- Capability SDK Packages
- Feature API Plugin Packages

The package distribution mechanism is not responsible for:

- Plugin Activation
- Plugin Discovery
- Capability Selection
- Runtime Governance

Examples of package distribution mechanisms include:

- Nexus Repository
- Azure Artifacts
- GitHub Packages
- Private npm Registries

The specific implementation is outside the scope of this document.

---

# 5. Platform Repository

## 5.1 Purpose

The Platform Repository contains all platform-owned assets.

Repository:

```text
api-platform-runtime
```

Owner:

```text
Platform Team
```

---

## 5.2 Repository Structure

```text
api-platform-runtime
│
├── apps/
│   └── runtime/
│
├── capabilities/
│   ├── capability-customer/
│   ├── capability-billing/
│   ├── capability-notification/
│   └── capability-weather/
│
├── catalog/
│
├── deployment/
│
├── environments/
│
├── .changeset/
│
└── .github/
```

---

## 5.3 Produced Artifacts

The Platform Repository produces:

### Runtime Image

```text
runtime:<version>
```

### Capability SDK Packages

```text
@company/capability-customer
@company/capability-billing
@company/capability-notification
@company/capability-weather
```

The Platform Repository does not produce Feature API Plugin Packages.

Runtime-hosted Capability Implementations are runtime artifacts and not independently distributed artifacts.

---

# 6. Feature Repository Model

## 6.1 Purpose

Feature repositories contain independently developed APIs.

---

## 6.2 Examples

```text
customer-api-plugin
billing-api-plugin
notification-api-plugin
weather-api-plugin
```

---

## 6.3 Produced Artifacts

Each repository produces exactly one Feature API Plugin Package.

Example:

```text
customer-api-plugin
      ↓
@company/customer-api-plugin
```

---

## 6.4 Feature Team Responsibilities

Feature Teams own:

- API Contracts
- Route Definitions
- Request Mapping
- Response Mapping
- Plugin Packaging

Feature Teams do not own:

- Capability Contracts
- Capability Implementations
- Runtime Governance
- Capability Compatibility Governance

---

# 7. Artifact Ownership

| Artifact | Owner |
|-----------|---------|
| Runtime Image | Platform Team |
| Capability SDK Package | Platform Team |
| Capability Contract | Platform Team |
| Capability Implementation | Platform Team |
| Plugin Catalog | Platform Team |
| Platform Configuration | Platform Team |
| Feature API Plugin Package | Feature Team |
| Feature API Plugin | Feature Team |

---

# 8. Publishing Model

## 8.1 Capability SDK Package Publishing

Capability SDK Packages shall be published independently.

Example:

```text
capability-customer changed
        ↓
Publish:
@company/capability-customer
```

Publishing one capability shall not require publishing unrelated capabilities.

---

## 8.2 Feature API Plugin Publishing

Feature API Plugin Packages shall be published independently.

Example:

```text
customer-api-plugin changed
        ↓
Publish:
@company/customer-api-plugin
```

Publishing one plugin shall not require publication of unrelated plugins.

---

## 8.3 Runtime Publishing

Runtime releases shall produce:

```text
Runtime Container Image
```

Runtime releases shall not automatically republish Capability SDK Packages.

---

## 8.4 Independent Publication Principle

The publication of a Capability SDK Package shall not require publication of:

- Unrelated Capability SDK Packages
- Feature API Plugin Packages
- Runtime Images

The publication of a Feature API Plugin Package shall not require publication of:

- Capability SDK Packages
- Runtime Images

The publication of a Runtime Image shall not require publication of:

- Feature API Plugin Packages
- Capability SDK Packages

Artifact publication boundaries remain intentionally independent.

---

# 9. Version Ownership Model

## 9.1 Capability SDK Package Versions

Examples:

```text
@company/capability-customer

1.0.0
1.1.0
2.0.0
```

Capability SDK Packages are versioned independently.

---

## 9.2 Feature API Plugin Versions

Examples:

```text
customer-api-plugin

1.0.0
1.1.0
```

Feature API Plugin Packages are versioned independently.

---

## 9.3 Runtime Versions

Examples:

```text
runtime

1.0.0
1.1.0
2.0.0
```

Runtime versions are independent from plugin versions.

---

## 9.4 Independent Version Streams

The architecture maintains independent version streams for:

- Capability SDK Packages
- Feature API Plugin Packages
- Runtime Images

A version change in one artifact type does not imply a version change in another artifact type.

Examples:

```text
Runtime:
  2.0.0

Capability SDK:
  customer-sdk 3.1.0

Plugin:
  customer-api-plugin 1.4.0
```

All version streams evolve independently.

Version dependency governance is defined in ASD-007 Capability Compatibility and Governance.

---

# 10. Build-Time Dependency Model

Feature API Plugin Packages may consume Capability SDK Packages during:

- Development
- Build
- Testing
- Local Debugging

Example:

```json
{
  "dependencies": {
    "@company/capability-customer": "^2.0.0"
  }
}
```

Capability SDK Packages provide:

- Contracts
- Interfaces
- Type Definitions
- Development Tooling

This dependency exists only during development and build activities.

---

# 11. Runtime Dependency Model

During runtime execution:

- Capability SDK Packages are not used directly.
- Runtime-hosted Capability Implementations are used.
- Runtime selects active Capability Implementations.
- Runtime governs Capability Implementation selection.

Feature API Plugins do not determine which Capability Implementation versions are active.

---

# 12. Artifact Distribution Model

## Development Flow

```text
Capability SDK Package
        ↓
Feature API Plugin Development
        ↓
Plugin Build
```

---

## Runtime Flow

```text
Capability Implementation
        ↓
Runtime
        ↓
Feature API Plugin
        ↓
Consumer Request
```

Build-time and runtime responsibilities remain intentionally separated.

---

# 13. Package Distribution

The platform requires a package distribution mechanism capable of storing:

- Capability SDK Packages
- Feature API Plugin Packages

Examples include:

- Private npm Registry
- Nexus Repository
- Azure Artifacts
- GitHub Packages

The specific implementation remains outside the scope of this document.

---

# 14. Versioning Strategy

Semantic Versioning shall be used.

Format:

```text
Major.Minor.Patch
```

Examples:

```text
1.0.0
1.1.0
1.1.1
2.0.0
```

Versioning policies governing capability contracts are defined in ASD-007 Capability Compatibility and Governance.

---

# 15. Release Governance

The Platform Team governs:

- Runtime Releases
- Capability SDK Releases
- Capability Contract Evolution
- Compatibility Policies

Feature Teams govern:

- Feature API Plugin Releases

Publication and activation remain separate processes.

---

# 16. Architectural Constraints

The following constraints apply:

- Capability SDK Packages shall not expose HTTP endpoints.
- Feature API Plugin Packages shall not contain Capability Implementations.
- Feature API Plugin Packages shall not determine Runtime Capability Implementation versions.
- Runtime Capability Implementation selection shall remain under Runtime control.
- Runtime Image releases shall remain independent from Plugin releases.
- Capability SDK Package releases shall remain independent from Runtime releases.
- Capability SDK Packages shall remain consumable as standard package dependencies during development and build activities.
- Plugin Catalog metadata and package distribution mechanisms shall remain independently governed.

---

# 17. Related Documents

## Foundational Documents

- ASD-001 Platform Vision and Scope
- ASD-002 Solution Architecture Overview

## Core Architecture Documents

- ASD-004 Capability SDK Architecture
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