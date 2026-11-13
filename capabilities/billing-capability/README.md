# Billing reference boundaries

The transport and payloads are provisional. Register a `BillingTransport` using
`BILLING_TRANSPORT`, and a validated options object using
`BILLING_ADAPTER_OPTIONS` in the host NestJS module. A real transport must
implement cancellation, return `null` for missing records, and atomically
recheck resend eligibility at the backend when resending a bill.

The reference transport returns customers as `{ id, active }`, bills as
`{ id, resendAllowed }`, and successful resend responses as
`{ accepted: true }`. Resend is never retried: a timeout or transport failure
may mean the backend already sent the bill. Do not retry externally without an
end-to-end idempotency guarantee.

`BillingCapability.provider("v1")` returns a deprecated shim accepting a
string and returning `{ success: true }`. The v2 provider accepts
`{ msisdn }` and returns `{ status: "accepted", billId }`. These are mock
compatibility contracts, not existing backend specifications. Inject only a
provider into plugin context; do not expose the capability or adapter instance.
The host must select the provider version and handle deprecation windows.

The MSISDN format and `resendAllowed` flag are provisional business rules.
The circuit breaker is per adapter instance and does not coordinate replicas.
Shared platform error contracts and real billing/CRM integration do not yet
exist; `BillingDomainError` is a billing-local reference contract.

Build `@api-platform/plugin-api` and `@api-platform/billing-adapter` before
building or testing `@api-platform/billing-capability`.
