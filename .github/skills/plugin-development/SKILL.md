Intent:
Create Feature API Plugins.

Plugins own:
- Routes
- Request mapping
- Response mapping
- OpenAPI metadata

Plugins consume:
- Capability contracts

Plugins must NOT:
- Contain business logic
- Contain domain validation
- Access data sources directly
- Instantiate capabilities

Keep plugins thin.