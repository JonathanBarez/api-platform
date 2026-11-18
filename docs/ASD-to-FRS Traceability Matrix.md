# ASD → FRS Requirements Traceability Matrix

## API Platform Modernization Initiative

Version: 3.1

---

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Purpose | Dynamic API Exposure | FR-006–FR-015 |
| Architectural Goals | Rapid API Development | FR-019–FR-024 |
| Architectural Goals | Reusable Business Capabilities | FR-025–FR-031 |
| Architectural Goals | Dynamic Feature Enablement | FR-006–FR-015 |
| Architectural Goals | Independent Release Cycles | FR-032–FR-037 |

---

## Runtime

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Capability Runtime | Plugin Discovery | FR-001 |
| Capability Runtime | Plugin Loading | FR-002 |
| Capability Runtime | OpenAPI Exposure | FR-003, FR-045 |
| Capability Runtime | Telemetry Collection | FR-004, FR-061 |
| Capability Runtime | Stateless Runtime | FR-005, FR-054 |

---

## Azure App Configuration

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Azure App Configuration | Feature Management Integration | FR-006 |
| Azure App Configuration | Authoritative Activation Control | FR-007 |
| Azure App Configuration | Feature Evaluation | FR-008 |
| Azure App Configuration | Missing Flags Disabled | FR-009 |
| Azure App Configuration | Dynamic Refresh | FR-010, FR-011 |

---

## Plugin Activation

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Plugin Catalog | Registered Plugin Requirement | FR-012, FR-075 |
| Plugin Catalog | Feature Driven Activation | FR-012–FR-015 |
| OpenAPI Architecture | Enabled Plugins Only | FR-045–FR-047 |

---

## Plugin SDK

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Plugin SDK | Independent Versioning | FR-016, FR-033 |
| Plugin SDK | Standard Contracts | FR-017 |
| Plugin SDK | Plugin Consumption | FR-018 |

---

## Feature API Plugins

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Feature API Plugins | Independent Development | FR-019 |
| Feature API Plugins | REST Endpoints | FR-020 |
| Feature API Plugins | Consume Capabilities | FR-021 |
| Feature API Plugins | No Direct System Access | FR-022 |
| Feature API Plugins | No Business Validation | FR-023 |
| Feature API Plugins | No Security Ownership | FR-024 |

---

## Capability Packages

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Capability Packages | npm Distribution | FR-025 |
| Capability Packages | Independent Versioning | FR-026, FR-034 |
| Capability Packages | Backend Integrations | FR-027 |
| Capability Packages | Domain Validation | FR-028, FR-044 |
| Capability Packages | Business Rules | FR-029 |
| Capability Packages | Strong Typing | FR-030 |
| Capability Packages | No HTTP Endpoints | FR-031 |

---

## Dependency Model

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Dependency Model | Capability Package Dependencies | FR-038 |
| Dependency Model | Single Active Major Version | FR-039 |

---

## Validation

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Layer 1 Validation | Request Validation | FR-040 |
| Layer 1 Validation | Response Validation | FR-041 |
| Layer 1 Validation | Schema Validation | FR-042 |
| Layer 1 Validation | Zod Usage | FR-043 |
| Layer 2 Validation | Domain Validation | FR-044 |

---

## Security

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| JWT Authentication | Authentication Support | FR-048 |
| RBAC Authorization | Authorization Support | FR-049 |
| Centralized Security | Runtime Ownership | FR-050 |

---

## Deployment

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Kubernetes Deployment | Kubernetes Support | FR-051 |
| Runtime Replicas | Horizontal Scale | FR-052 |
| Rolling Deployments | Deployment Strategy | FR-053 |
| Stateless Runtime | Stateless Execution | FR-054 |
| Externalized State | State Management | FR-055 |

---

## Observability

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Distributed Tracing | Tracing Support | FR-059 |
| End-to-End Tracing | Runtime → Plugin → Capability | FR-060 |
| Central Telemetry | Unified Collection | FR-061 |
| Trace Metadata | plugin.name, plugin.version, capability.name | FR-062 |

---

## Reliability

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Plugin Isolation | Runtime Stability | FR-063 |
| Capability Isolation | Failure Boundaries | FR-064 |
| Health Endpoints | Health Monitoring | FR-065 |
| Health Monitoring Scope | Runtime, Azure App Configuration, Plugin Catalog, Loaded Plugins | FR-066 |

---

## Version Visibility

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Version Visibility | Runtime Version | FR-067 |
| Version Visibility | Plugin SDK Version | FR-068 |
| Version Visibility | Plugin Versions | FR-069 |
| Version Visibility | Capability Versions | FR-070 |

---

## Lifecycle

| ASD Section | Architectural Decision | FRS References |
|------------|------------------------|----------------|
| Independent Publishing | Capability Release Independence | FR-071, FR-072 |
| Activation Separation | Publication ≠ Activation | FR-073 |
| Feature-Flag Activation | Azure Driven Activation | FR-074 |
| Catalog Governance | Registered Plugin Activation | FR-075 |

---

## Future Evolution

| ASD Future Capability | FRS References |
|----------------------|----------------|
| Per-Tenant Feature Enablement | FR-076 |
| Plugin Marketplace | FR-077 |
| Dependency Scanning | FR-078 |
| Usage Analytics | FR-079 |
| Multi-Region Deployment | FR-080 |