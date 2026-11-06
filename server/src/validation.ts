import { z } from "zod";

import { ApiError } from "./errors.js";

/// Request bodies, checked before anything touches the chain.

const amount = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "a decimal USDT amount with up to 6 decimals, such as \"1.50\"")
  .refine((v) => Number(v) > 0, "more than zero");
const reference = z.string().trim().min(1).max(128);
const note = z.string().max(500).optional();
export const hexId = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "0x followed by 64 hex characters");

export const createOrderBody = z.object({
  amount,
  /// Your own id for the order, such as an invoice number. Each reference makes one order.
  reference,
  refundDays: z.number().int().min(1).max(365).optional(),
});
export const refundBody = z.object({ amount, note });
export const approveBody = z.object({ amount });
export const denyBody = z.object({ note });

export const createSubscriptionBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    reference,
    amount,
    /// The length of one period: whole days (1 to 365), or exact seconds (10 to 31536000), not both.
    periodDays: z.number().int().min(1).max(365).optional(),
    periodSeconds: z.number().int().min(10).max(365 * 86_400).optional(),
    periods: z.number().int().min(1).max(120),
    description: z.string().max(500).optional(),
  })
  .refine((b) => (b.periodDays === undefined) !== (b.periodSeconds === undefined), { message: "give periodDays or periodSeconds, not both", path: ["periodSeconds"] })
  .transform(({ periodDays, periodSeconds, ...rest }) => ({ ...rest, periodSeconds: periodSeconds ?? (periodDays ?? 0) * 86_400 }));

export const submitBody = z.object({ txHash: hexId });

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.iso.datetime().optional(),
});

/// Parses a body or throws a 400 that says which field is wrong.
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const fields = result.error.issues.map((i) => ({ field: i.path.join(".") || "(body)", problem: i.message }));
  throw new ApiError(400, "INVALID_INPUT", fields.map((f) => `${f.field}: ${f.problem}`).join("; "), { fields });
}
