import { Inject, Injectable } from "@nestjs/common";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { z } from "zod";

export const BILLING_TRANSPORT = Symbol("BILLING_TRANSPORT");
export const BILLING_ADAPTER_OPTIONS = Symbol("BILLING_ADAPTER_OPTIONS");

export interface BillingTransport {
  findCustomer(msisdn: string, signal: AbortSignal): Promise<unknown>;
  findLatestBill(customerId: string, signal: AbortSignal): Promise<unknown>;
  // The backend must recheck eligibility atomically when it performs the resend.
  resendBill(customerId: string, billId: string, signal: AbortSignal): Promise<unknown>;
}

export const billingAdapterOptionsSchema = z.object({
  timeoutMs: z.number().int().min(1).max(60_000),
  maxReadAttempts: z.number().int().min(1).max(5),
  retryDelayMs: z.number().int().min(0).max(10_000),
  failureThreshold: z.number().int().min(1).max(100),
  resetTimeoutMs: z.number().int().min(1).max(300_000),
}).strict();

export type BillingAdapterOptions = z.infer<typeof billingAdapterOptionsSchema>;
export type BillingAdapterErrorCode = "TIMEOUT" | "UNAVAILABLE" | "CIRCUIT_OPEN";

export class BillingAdapterError extends Error {
  constructor(
    readonly code: BillingAdapterErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BillingAdapterError";
  }
}

@Injectable()
export class BillingAdapter {
  private readonly options: BillingAdapterOptions;
  private failures = 0;
  private openedAt: number | undefined;
  private probing = false;
  private generation = 0;

  constructor(
    @Inject(BILLING_TRANSPORT) private readonly transport: BillingTransport,
    @Inject(BILLING_ADAPTER_OPTIONS) options: BillingAdapterOptions,
  ) {
    this.options = billingAdapterOptionsSchema.parse(options);
  }

  findCustomer(msisdn: string): Promise<unknown> {
    return this.call("findCustomer", (signal) => this.transport.findCustomer(msisdn, signal), true);
  }

  findLatestBill(customerId: string): Promise<unknown> {
    return this.call("findLatestBill", (signal) => this.transport.findLatestBill(customerId, signal), true);
  }

  resendBill(customerId: string, billId: string): Promise<unknown> {
    return this.call("resendBill", (signal) => this.transport.resendBill(customerId, billId, signal), false);
  }

  private async call(
    operation: string,
    action: (signal: AbortSignal) => Promise<unknown>,
    retryable: boolean,
  ): Promise<unknown> {
    return trace.getTracer("@api-platform/billing-adapter").startActiveSpan(
      `billing.adapter.${operation}`,
      async (span) => {
        try {
          const result = await this.execute(action, retryable);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error: unknown) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async execute(
    action: (signal: AbortSignal) => Promise<unknown>,
    retryable: boolean,
  ): Promise<unknown> {
    let probe = false;
    if (this.openedAt !== undefined) {
      if (Date.now() - this.openedAt < this.options.resetTimeoutMs || this.probing) {
        throw new BillingAdapterError("CIRCUIT_OPEN", "Billing circuit is open");
      }
      probe = true;
      this.probing = true;
    }
    const generation = this.generation;
    const attempts = retryable ? this.options.maxReadAttempts : 1;
    try {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const value = await this.withTimeout(action);
          if (generation === this.generation) {
            this.failures = 0;
            if (probe) {
              this.openedAt = undefined;
              this.generation++;
            }
          }
          return value;
        } catch (error: unknown) {
          if (attempt === attempts) {
            throw error;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, this.options.retryDelayMs));
        }
      }
      throw new Error("Unreachable retry state");
    } catch (error: unknown) {
      if (generation === this.generation) {
        this.failures++;
        if (probe || this.failures >= this.options.failureThreshold) {
          this.openedAt = Date.now();
          this.generation++;
        }
      }
      if (error instanceof BillingAdapterError) {
        throw error;
      }
      throw new BillingAdapterError("UNAVAILABLE", "Billing backend request failed", { cause: error });
    } finally {
      if (probe) {
        this.probing = false;
      }
    }
  }

  private async withTimeout(action: (signal: AbortSignal) => Promise<unknown>): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => action(controller.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new BillingAdapterError("TIMEOUT", "Billing backend request timed out"));
            controller.abort();
          }, this.options.timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}
