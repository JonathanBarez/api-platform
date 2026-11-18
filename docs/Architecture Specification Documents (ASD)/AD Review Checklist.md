# ASD Review Checklist
## Terminology, Scope, Consistency, and Governance Review

### Purpose

This checklist shall be completed before any ASD document is approved or updated.

The objective is to:

- Prevent terminology drift
- Prevent architectural contradictions
- Prevent scope leakage between ASD documents
- Enforce ownership boundaries
- Ensure alignment across ASD-001 through ASD-011

This checklist is mandatory for:

```text
ASD-001 through ASD-011
FRS
ASD → FRS Traceability Matrix
Platform Governance Documents
```

---

# 1. Terminology Validation

## T-001 Capability SDK Package

Verify every occurrence of:

```text
Capability SDK Package
```

means:

```text
Build-Time Artifact
```

Allowed Uses:

- Contracts
- Type Definitions
- Developer Tooling
- Development Interfaces
- Packaging Metadata

Forbidden Uses:

- Business Logic
- Runtime Execution
- Enterprise Integration
- Domain Validation

Result:

```text
Pass / Fail
```

---

## T-002 Capability Contract

Verify every occurrence of:

```text
Capability Contract
```

means:

```text
Public Capability Interface
```

Allowed Uses:

- Contract Versioning
- Interface Definitions
- Compatibility Policies

Forbidden Uses:

- Capability SDK Package
- Capability Implementation

Result:

```text
Pass / Fail
```

---

## T-003 Capability Implementation

Verify every occurrence of:

```text
Capability Implementation
```

means:

```text
Runtime-Hosted Executable Capability
```

Allowed Uses:

- Business Logic
- Domain Validation
- Enterprise Integration
- Error Translation
- Compatibility Support

Forbidden Uses:

- SDK Package
- Published npm Package
- Build Artifact

Result:

```text
Pass / Fail
```

---

## T-004 Feature API Plugin Package

Verify every occurrence of:

```text
Feature API Plugin Package
```

means:

```text
Build-Time Deployable Artifact
```

Forbidden Uses:

```text
Runtime Plugin Instance
```

Result:

```text
Pass / Fail
```

---

## T-005 Feature API Plugin

Verify every occurrence of:

```text
Feature API Plugin
```

means:

```text
Runtime-Loaded Plugin Instance
```

Allowed Uses:

- Plugin Activation
- Route Execution
- OpenAPI Exposure

Result:

```text
Pass / Fail
```

---

## T-006 Runtime Image

Verify every occurrence of:

```text
Runtime Image
```

means:

```text
Deployable Runtime Host
```

Allowed Uses:

- Hosting
- Governance
- Capability Selection
- Capability Injection

Forbidden Uses:

```text
Capability SDK Package
Feature API Plugin Package
```

Result:

```text
Pass / Fail
```

---

## T-007 Plugin Catalog

Verify every occurrence of:

```text
Plugin Catalog
```

means:

```text
Metadata Source
```

Allowed Uses:

- Discovery
- Registration Metadata
- Activation Metadata

Forbidden Uses:

```text
Artifact Storage
Binary Repository
Package Registry
```

Result:

```text
Pass / Fail
```

---

## T-008 Platform Configuration

Verify every occurrence of:

```text
Platform Configuration
```

remains implementation-neutral.

Allowed Uses:

```text
Feature Exposure
Runtime Configuration
Platform Settings
```

Forbidden Uses outside implementation documents:

```text
Azure App Configuration
LaunchDarkly
Unleash
```

Exceptions:

```text
ASD-006 Runtime Architecture
ASD-010 Deployment and Release Architecture
```

Result:

```text
Pass / Fail
```

---

# 2. Lifecycle Separation Validation

## L-001 Build-Time vs Runtime Model

Verify the document clearly separates:

### Build-Time

```text
Capability SDK Package
Feature API Plugin Package
```

from:

### Runtime

```text
Capability Implementation
Feature API Plugin
```

Result:

```text
Pass / Fail
```

---

## L-002 Runtime Ownership

Verify the document never implies:

```text
Feature API Plugins
```

select runtime capability versions.

Runtime must remain authoritative owner of:

```text
Capability Implementation Selection
Capability Compatibility Enforcement
Capability Hosting
```

Result:

```text
Pass / Fail
```

---

## L-003 Capability Consumption Model

Verify the document correctly describes:

```text
Development / Build
    ↓
Consumes Capability SDK Packages

Runtime
    ↓
Consumes Capability Implementations
```

Result:

```text
Pass / Fail
```

---

# 3. Scope Validation

## S-001 ASD-001 Platform Vision and Scope

Must Define:

- Purpose
- Scope
- Vision
- Goals
- Principles
- Stakeholders

Must Not Define:

- Startup Sequence
- Runtime Internals
- Compatibility Algorithms
- CI/CD Pipelines

Result:

```text
Pass / Fail
```

---

## S-002 ASD-002 Solution Architecture Overview

Must Define:

- Architectural Structure
- Solution Relationships
- Architectural Boundaries

Must Not Define:

- Startup Procedures
- Compatibility Decisions
- Deployment Strategy

Result:

```text
Pass / Fail
```

---

## S-003 ASD-003 Artifact and Repository Architecture

Must Define:

- Artifact Types
- Repository Ownership
- Publishing Strategy
- Versioning Strategy

Must Not Define:

- Runtime Lifecycle

Result:

```text
Pass / Fail
```

---

## S-004 ASD-004 Capability SDK Architecture

Must Define:

- Capability SDK Design
- Capability Contracts
- Capability Lifecycle
- Capability Consumption

Must Not Define:

- Runtime Startup Logic

Result:

```text
Pass / Fail
```

---

## S-005 ASD-005 Feature API Plugin Architecture

Must Define:

- Plugin Design
- Plugin Packaging
- Plugin Manifest
- Route Ownership

Must Not Define:

- Compatibility Enforcement

Result:

```text
Pass / Fail
```

---

## S-006 ASD-006 Runtime Architecture

Must Define:

- Runtime Components
- Capability Resolution
- Capability Hosting
- Plugin Hosting

Must Not Define:

- Deployment Pipelines

Result:

```text
Pass / Fail
```

---

## S-007 ASD-007 Capability Compatibility and Governance

Must Define:

- Contract Compatibility Model
- Compatibility States
- Compatibility Windows
- Adapter Strategy

Must Not Define:

- CI/CD Pipelines

Result:

```text
Pass / Fail
```

---

## S-008 ASD-008 Runtime Operations and Lifecycle

Must Define:

- Startup Sequence
- Refresh Sequence
- Failure Handling
- Runtime Lifecycle

Must Not Define:

- Security Rules

Result:

```text
Pass / Fail
```

---

## S-009 ASD-009 Security Validation and Observability

Must Define:

- Validation
- Security
- Observability

Must Not Define:

- Repository Ownership

Result:

```text
Pass / Fail
```

---

## S-010 ASD-010 Deployment and Release Architecture

Must Define:

- Deployment
- Release
- Promotion
- Environment Strategy

Must Not Define:

- Capability Modeling

Result:

```text
Pass / Fail
```

---

## S-011 ASD-011 Future Architecture Roadmap

Must Define:

- Future-State Concepts
- Strategic Evolutions

Must Not Define:

- Current Requirements

Result:

```text
Pass / Fail
```

---

# 4. Ownership Validation

## O-001 Platform Team Ownership

Verify ownership includes:

- Runtime Image
- Capability SDK Packages
- Capability Implementations
- Capability Compatibility Governance

Result:

```text
Pass / Fail
```

---

## O-002 Feature Team Ownership

Verify ownership includes:

- Feature API Plugin Packages
- API Contracts
- Route Definitions

Result:

```text
Pass / Fail
```

---

## O-003 Operations Team Ownership

Verify ownership includes:

- Deployment
- Monitoring
- Runtime Operations

Result:

```text
Pass / Fail
```

---

# 5. Build-Time vs Runtime Review

## BR-001

Verify no document implies:

```text
Capability SDK Package
=
Capability Implementation
```

Result:

```text
Pass / Fail
```

---

## BR-002

Verify Feature API Plugins may consume Capability SDK Packages during:

- Development
- Build
- Testing

Result:

```text
Pass / Fail
```

---

## BR-003

Verify Runtime controls:

- Capability Selection
- Capability Hosting
- Capability Compatibility
- Capability Injection

Result:

```text
Pass / Fail
```

---

# 6. Compatibility Model Validation

## C-001

Verify the document uses:

```text
Capability Compatibility
```

and not:

```text
SDK Compatibility
Plugin SDK Compatibility
```

Result:

```text
Pass / Fail
```

---

## C-002

Verify compatibility states appear only within ASD-007:

```text
Compatible
Legacy Compatible
Incompatible
```

Result:

```text
Pass / Fail
```

---

## C-003

Verify compatibility ownership remains:

```text
Runtime
```

and not:

```text
Feature API Plugin
```

Result:

```text
Pass / Fail
```

---

# 7. Forbidden Terminology Review

The following terms should not appear.

| Forbidden | Approved Alternative |
|------------|------------|
| Capability Package | Capability SDK Package or Capability Implementation |
| Capability Library | Capability SDK Package |
| Shared Library | Capability SDK Package |
| Plugin SDK | Removed |
| Platform SDK | Removed |
| SDK Compatibility | Capability Compatibility |
| SDK Version | Capability Contract Version |
| Runtime Capability Package | Capability Implementation |

Review Result:

```text
Pass / Fail
```

---

# 8. Cross-ASD Alignment Validation

## A-001

Verify terminology matches ASD-000 Terminology and Vocabulary Standard.

Result:

```text
Pass / Fail
```

---

## A-002

Verify no architectural statement contradicts any previously approved ASD document.

Result:

```text
Pass / Fail
```

---

## A-003

Verify document references the correct downstream ASD documents.

Result:

```text
Pass / Fail
```

---

# 9. Approval Gate

The document may only progress to Approved status when:

- All terminology checks pass.
- All lifecycle checks pass.
- All scope checks pass.
- All ownership checks pass.
- All compatibility checks pass.
- No forbidden terminology remains.
- Cross-document alignment passes.

## Reviewer Sign-Off

| Reviewer | Status |
|-----------|---------|
| Architecture Review | Pass / Fail |
| Platform Review | Pass / Fail |
| Operational Review | Pass / Fail |
| Terminology Review | Pass / Fail |

## Final Outcome

```text
☐ Rejected
☐ Requires Revision
☐ Approved
```