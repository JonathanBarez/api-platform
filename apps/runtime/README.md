# Runtime bootstrap

Build `@api-platform/plugin-api`, `@api-platform/plugin-loader`,
`@api-platform/plugin-registry`, `@api-platform/validation`, and
`@api-platform/telemetry` before
building this package. Start from the repository root with
`npm start --workspace @api-platform/runtime`.
`PORT`, `HOST`, and `PLUGIN_CATALOG_PATH` configure the listener and catalog.

Plugins export a default `PluginDefinition`; the catalog must specify the
installed package's exact version and supported SDK range. Invalid catalog
structure stops startup; invalid or broken plugins are logged and skipped.
Literal route segments and named `:param` segments are supported; `/health`
is reserved. `requestSchema` validates the request body and `responseSchema`
validates the response. Routes may also declare `paramsSchema` and
`querySchema`. Their parsed values are available in the handler's third
argument, `{ params, query }`; an undeclared section is `undefined`.
Validation failures return sanitized 400 or 500 responses.

The default runtime has no capabilities or legacy SDK policies. A host may
call `startRuntime` with an explicit legacy SDK version and expiry and a
`capabilityFactory` that returns the corresponding providers or shims.
Legacy compatibility without a factory fails closed. Legacy SDK versions are
exact versions, not capability versions; the host is responsible for mapping
them to the correct capability shims.

## JWT authentication

The runtime reads optional `appsettings.json` from its working directory, or
the path specified by `APP_SETTINGS_PATH`. It accepts a `JwtSettings` object:

```json
{
  "JwtSettings": {
    "Issuer": "https://auth.internal.platform.net/issuer",
    "Audience": "https://api.platform.net/plugins",
    "MetadataAddress": "https://auth.internal.platform.net/issuer/.well-known/openid-configuration",
    "RequireHttpsMetadata": true,
    "TokenValidationParameters": {
      "ValidateIssuer": true,
      "ValidateAudience": true,
      "ValidateLifetime": true,
      "ValidateIssuerSigningKey": true,
      "ClockSkew": "00:05:00"
    }
  }
}
```

Environment variables override individual settings:
`JWT__ISSUER`, `JWT__AUDIENCE`, `JWT__METADATA_ADDRESS`,
`JWT__REQUIRE_HTTPS_METADATA`, `JWT__VALIDATE_ISSUER`,
`JWT__VALIDATE_AUDIENCE`, `JWT__VALIDATE_LIFETIME`,
`JWT__VALIDATE_ISSUER_SIGNING_KEY`, and `JWT__CLOCK_SKEW`. Boolean
values must be lowercase `true` or `false`. The four validation flags must
be true; unsafe or incomplete configuration fails startup. Clock skew is
`HH:MM:SS` and defaults to five minutes.

The guard verifies RS256 signatures using keys from OIDC discovery, requires
the configured issuer, audience and expiration, and checks token lifetime.
Discovery and JWKS require HTTPS by default; disable HTTPS only for local
development. Without JWT settings all plugin requests return 401.

**Temporary authorization policy:** until scopes or roles are defined, any
valid JWT for the configured issuer and audience can access every plugin
route. The runtime logs a warning on startup. This is not RBAC and must be
replaced before scope- or role-based access control is required.

Health endpoints `/health/live`, `/health/ready`, and `/health/startup` are
public and become available only after bootstrap completes.

## Tracing

The entry point initializes OpenTelemetry before loading the engine and flushes
pending spans on application shutdown. Configure OTLP export and sampling with
standard `OTEL_*` variables; see [telemetry](../../../platform/telemetry/README.md).
The selected SDK requires Node 22.15+ or Node 26. Injected capability facades are
instrumented automatically and inherit the plugin's name and version.
