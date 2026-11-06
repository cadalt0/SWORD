import { Hono } from "hono";

import { requireScope } from "../../middleware/scope.js";
import { perform } from "../../services/actions.js";
import {
  assertDue,
  cancelSubscription,
  chargeSubscription,
  createSubscription,
  denySubscriptionRefund,
  getSubscription,
  listSubscriptions,
  readSubscription,
  refundSubscription,
  withdrawSubscription,
} from "../../services/subscriptions.js";
import { ApiError } from "../../errors.js";
import { formatUsdt } from "sword-sdk";
import { createSubscriptionBody, denyBody, listQuery, parse, refundBody } from "../../validation.js";
import type { AppEnv } from "../../types.js";
import { body, respond } from "../respond.js";

/// /v1/subscriptions
export const subscriptionRoutes = new Hono<AppEnv>()
  /// Create a subscription. The answer has `subscribeUrl` for the subscribe button.
  .post("/", requireScope("subscriptions:write"), async (c) => respond(c, await perform(createSubscription, c.get("merchant"), parse(createSubscriptionBody, await body(c)))))
  .get("/", requireScope("subscriptions:read"), async (c) => {
    const q = parse(listQuery, c.req.query());
    return c.json({ object: "list", ...(await listSubscriptions(c.get("merchant"), q.limit, q.before ? new Date(q.before) : undefined)) });
  })
  .get("/:id", requireScope("subscriptions:read"), async (c) => c.json(await getSubscription(c.get("merchant"), c.req.param("id"))))
  /// Collect the next period, when it is due.
  .post("/:id/charge", requireScope("subscriptions:write"), async (c) => {
    const m = c.get("merchant");
    const { view } = await readSubscription(m, c.req.param("id"));
    await assertDue(m, view);
    return respond(c, await perform(chargeSubscription, m, { id: c.req.param("id") }));
  })
  .post("/:id/cancel", requireScope("subscriptions:write"), async (c) => {
    const m = c.get("merchant");
    const { view } = await readSubscription(m, c.req.param("id"));
    if (view.status === "cancelled" || view.status === "completed") throw new ApiError(409, "ALREADY_ENDED", `This subscription is already ${view.status}`);
    return respond(c, await perform(cancelSubscription, m, { id: c.req.param("id") }));
  })
  .post("/:id/withdraw", requireScope("withdrawals:write"), async (c) => {
    const m = c.get("merchant");
    const { view } = await readSubscription(m, c.req.param("id"));
    if (view.held === 0n) throw new ApiError(409, "NOTHING_TO_WITHDRAW", "This subscription holds nothing right now");
    return respond(c, await perform(withdrawSubscription, m, { id: c.req.param("id"), held: formatUsdt(view.held) }));
  })
  .post("/:id/refund", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    const input = parse(refundBody, await body(c));
    await readSubscription(m, c.req.param("id"));
    return respond(c, await perform(refundSubscription, m, { id: c.req.param("id"), ...input }));
  })
  .post("/:id/refund/deny", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    const input = parse(denyBody, await body(c));
    const { view } = await readSubscription(m, c.req.param("id"));
    if (!view.refundRequested) throw new ApiError(409, "NO_REFUND_REQUEST", "There is no open refund request on this subscription");
    return respond(c, await perform(denySubscriptionRefund, m, { id: c.req.param("id"), note: input.note }));
  });
