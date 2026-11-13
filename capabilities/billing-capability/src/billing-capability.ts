import { Inject, Injectable } from "@nestjs/common";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { z } from "zod";
import { BillingAdapter, BillingAdapterError } from "@api-platform/billing-adapter";
import type { CapabilityProvider, CapabilityShim } from "@api-platform/plugin-api";

const msisdnSchema = z.string().regex(/^\+?[1-9]\d{6,14}$/);
const customerSchema = z.object({ id: z.string().min(1), active: z.boolean() });
const billSchema = z.object({
  id: z.string().min(1),
  resendAllowed: z.boolean(),
});
const resendResultSchema = z.object({ accepted: z.literal(true) });

export interface BillingRequestV2 {
  readonly msisdn: string;
}

export interface BillingResultV1 {
  readonly success: true;
}

export interface BillingResultV2 {
  readonly status: "accepted";
  readonly billId: string;
}

export interface BillingProviderV1 extends CapabilityProvider {
  resendLatestBill(msisdn: string): Promise<BillingResultV1>;
}

export interface BillingProviderV2 extends CapabilityProvider {
  resendLatestBill(request: BillingRequestV2): Promise<BillingResultV2>;
}

export type BillingDomainErrorCode =
  | "INVALID_INPUT"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_INACTIVE"
  | "BILL_NOT_FOUND"
  | "RESEND_NOT_ALLOWED"
  | "BACKEND_UNAVAILABLE"
  | "BACKEND_TIMEOUT"
  | "BACKEND_INVALID_RESPONSE";

export class BillingDomainError extends Error {
  constructor(
    readonly code: BillingDomainErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BillingDomainError";
  }
}

@Injectable()
export class BillingCapability {
  constructor(@Inject(BillingAdapter) private readonly adapter: BillingAdapter) {}

  resendLatestBill(msisdn: string): Promise<BillingResultV1>;
  resendLatestBill(request: BillingRequestV2): Promise<BillingResultV2>;
  async resendLatestBill(input: string | BillingRequestV2): Promise<BillingResultV1 | BillingResultV2> {
    return trace.getTracer("@api-platform/billing-capability").startActiveSpan(
      "billing.capability.resendLatestBill",
      async (span): Promise<BillingResultV1 | BillingResultV2> => {
        try {
          const parsed = z.union([
            msisdnSchema,
            z.object({ msisdn: msisdnSchema }).strict(),
          ]).safeParse(input);
          if (!parsed.success) {
            throw new BillingDomainError("INVALID_INPUT", "Invalid billing request");
          }
          const legacy = typeof parsed.data === "string";
          const msisdn = typeof parsed.data === "string" ? parsed.data : parsed.data.msisdn;
          const customerValue = await this.adapter.findCustomer(msisdn);
          if (customerValue === null) {
            throw new BillingDomainError("CUSTOMER_NOT_FOUND", "Customer not found");
          }
          const customer = customerSchema.safeParse(customerValue);
          if (!customer.success) {
            throw new BillingDomainError("BACKEND_INVALID_RESPONSE", "Invalid customer response");
          }
          if (!customer.data.active) {
            throw new BillingDomainError("CUSTOMER_INACTIVE", "Customer is inactive");
          }
          const billValue = await this.adapter.findLatestBill(customer.data.id);
          if (billValue === null) {
            throw new BillingDomainError("BILL_NOT_FOUND", "Bill not found");
          }
          const bill = billSchema.safeParse(billValue);
          if (!bill.success) {
            throw new BillingDomainError("BACKEND_INVALID_RESPONSE", "Invalid bill response");
          }
          if (!bill.data.resendAllowed) {
            throw new BillingDomainError("RESEND_NOT_ALLOWED", "Bill resend is not allowed");
          }
          const result = resendResultSchema.safeParse(
            await this.adapter.resendBill(customer.data.id, bill.data.id),
          );
          if (!result.success) {
            throw new BillingDomainError("BACKEND_INVALID_RESPONSE", "Invalid resend response");
          }
          span.setStatus({ code: SpanStatusCode.OK });
          return legacy ? { success: true } : { status: "accepted", billId: bill.data.id };
        } catch (error: unknown) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          if (error instanceof BillingAdapterError) {
            const code = error.code === "TIMEOUT" ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE";
            throw new BillingDomainError(code, "Billing backend request failed");
          }
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  provider(version: "v1"): CapabilityShim<BillingProviderV1>;
  provider(version: "v2"): BillingProviderV2;
  provider(version: "v1" | "v2"): CapabilityShim<BillingProviderV1> | BillingProviderV2 {
    if (version === "v1") {
      return {
        name: "billing",
        version: "1.0.0",
        compatibility: {
          requestedVersion: "1.0.0",
          resolvedVersion: "2.0.0",
          deprecated: true,
          shimmed: true,
        },
        resendLatestBill: (msisdn: string) => this.resendLatestBill(msisdn),
      };
    }
    if (version === "v2") {
      return {
        name: "billing",
        version: "2.0.0",
        resendLatestBill: (request: BillingRequestV2) => this.resendLatestBill(request),
      };
    }
    throw new Error("Unsupported billing capability version");
  }
}
