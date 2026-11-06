import { Hono } from "hono";
import type { Hex } from "viem";

import { pendingState, submit } from "../../services/actions.js";
import { parse, submitBody } from "../../validation.js";
import type { AppEnv } from "../../types.js";
import { body, respond } from "../respond.js";

/// /v1/transactions: the transactions a self-signing merchant signs. sword-merchant uses these by itself.
export const transactionRoutes = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const state = await pendingState(c.get("merchant"), c.req.param("id"));
    return state.status === "expired" ? c.json({ object: "pending_transaction", status: "expired" }, 410) : respond(c, state);
  })
  /// Report the hash of the signed transaction. Answers with the next one to sign, or the action's result.
  .post("/:id/submit", async (c) => {
    const { txHash } = parse(submitBody, await body(c));
    return respond(c, await submit(c.get("merchant"), c.req.param("id"), txHash as Hex));
  });
