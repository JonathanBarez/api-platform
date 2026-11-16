import type {
  CapabilityProvider,
  PluginDefinition,
  PluginRoute,
} from "@api-platform/plugin-api";
import {
  resendBillRequestSchema,
  resendBillResponseSchema,
} from "@api-platform/shared-models";
import type { ResendBillResponse } from "@api-platform/shared-models";

export type BillingCapabilities = {
  readonly billing: CapabilityProvider & {
    resendLatestBill(msisdn: string): Promise<ResendBillResponse>;
  };
};

export const resendBillRoute: PluginRoute<
  typeof resendBillRequestSchema,
  typeof resendBillResponseSchema,
  BillingCapabilities
> = {
  path: "/bills/resend",
  method: "POST",
  requestSchema: resendBillRequestSchema,
  responseSchema: resendBillResponseSchema,
  handler: ({ msisdn }, context) =>
    context.capabilities.billing.resendLatestBill(msisdn),
};

const plugin: PluginDefinition<BillingCapabilities> = {
  routes: [{
    ...resendBillRoute,
    handler: (request, context, metadata) =>
      resendBillRoute.handler(resendBillRequestSchema.parse(request), context, metadata),
  }],
};

export default plugin;
