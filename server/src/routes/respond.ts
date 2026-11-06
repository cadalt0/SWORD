import type { Context } from "hono";

import type { Outcome } from "../services/actions.js";

/// Answers an action: 200 with the result when it is done, or 202 with the transaction a self-signing merchant must
/// sign. sword-merchant handles the 202 by itself.
export function respond(c: Context, outcome: Outcome<unknown>) {
  if (outcome.status === "completed") return c.json(outcome.result as object, 200);
  return c.json({ object: "pending_transaction", status: "signature_required", transaction: outcome.transaction }, 202);
}

/// Reads a JSON body. An empty or broken body is an empty object, so validation reports the missing fields.
export async function body(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}
