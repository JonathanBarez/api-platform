import { z } from "zod";

export const resendBillRequestSchema = z.object({
  msisdn: z.string().regex(/^\+?[1-9]\d{6,14}$/),
}).strict();

export const resendBillResponseSchema = z.object({
  success: z.literal(true),
}).strict();

export type ResendBillRequest = z.infer<typeof resendBillRequestSchema>;
export type ResendBillResponse = z.infer<typeof resendBillResponseSchema>;
