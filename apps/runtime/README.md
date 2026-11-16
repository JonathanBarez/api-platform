# Runtime bootstrap

Build `@api-platform/plugin-api`, `@api-platform/plugin-loader`, and
`@api-platform/plugin-registry` before building this package. Start from the
repository root with `npm start --workspace @api-platform/runtime`.
`PORT`, `HOST`, and `PLUGIN_CATALOG_PATH` configure the listener and catalog.

Plugins export a default `PluginDefinition`; the catalog must specify the
installed package's exact version and supported SDK range. Invalid catalog
structure stops startup; invalid or broken plugins are logged and skipped.
Only literal routes are supported and `/health` is reserved. Request bodies
and responses are validated with the route's Zod schemas.

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
