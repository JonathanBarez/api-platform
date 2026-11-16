# Billing reference plugin

Build `@api-platform/plugin-api` and `@api-platform/shared-models` before this
plugin. Run `npm test --workspace @api-platform/billing-reference-plugin` for
isolated tests with a mocked `PluginContext`; no billing backend is needed.

`POST /bills/resend` accepts `{ "msisdn": "+123456789" }` and returns
`{ "success": true }`. Runtime Layer 1 validation uses the declared schemas.
The handler delegates only to `context.capabilities.billing.resendLatestBill`.
Business validation and backend access belong to the host capability.

The catalog entry is disabled until the host supplies the billing v1 facade
(string input and `{ success: true }` output) through its capability factory.
The SDK version range is independent of the billing capability version.
The real billing transport is not yet implemented.

Peer packages use the repository's existing `@api-platform/*` namespace.
TypeScript compilation does not bundle these host-provided packages.
