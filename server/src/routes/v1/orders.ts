import { Hono } from "hono";

import { requireScope } from "../../middleware/scope.js";
import { perform } from "../../services/actions.js";
import { approveRefund, confirmOrder, createOrder, denyRefund, getOrder, listOrders, payRefund, readOrder, refundOrder, withdrawOrder } from "../../services/orders.js";
import { approveBody, createOrderBody, denyBody, listQuery, parse, refundBody } from "../../validation.js";
import type { AppEnv } from "../../types.js";
import { body, respond } from "../respond.js";

/// /v1/orders
export const orderRoutes = new Hono<AppEnv>()
  /// Create an order. The answer has `checkoutUrl` for the pay button.
  .post("/", requireScope("orders:write"), async (c) => respond(c, await perform(createOrder, c.get("merchant"), parse(createOrderBody, await body(c)))))
  .get("/", requireScope("orders:read"), async (c) => {
    const q = parse(listQuery, c.req.query());
    return c.json({ object: "list", ...(await listOrders(c.get("merchant"), q.limit, q.before ? new Date(q.before) : undefined)) });
  })
  .get("/:id", requireScope("orders:read"), async (c) => c.json(await getOrder(c.get("merchant"), c.req.param("id"))))
  /// Marks the order paid if a wallet sent the full amount to its deposit address. Safe to call repeatedly.
  .post("/:id/confirm", requireScope("orders:write"), async (c) => respond(c, await confirmOrder(c.get("merchant"), c.req.param("id"))))
  /// Refund without a request from the customer.
  .post("/:id/refund", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    const input = parse(refundBody, await body(c));
    await readOrder(m, c.req.param("id"));
    return respond(c, await perform(refundOrder, m, { orderId: c.req.param("id"), ...input }));
  })
  /// Answer a customer's refund request: approve an amount, decline it, or pay what was approved.
  .post("/:id/refund/approve", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    const input = parse(approveBody, await body(c));
    await readOrder(m, c.req.param("id"));
    return respond(c, await perform(approveRefund, m, { orderId: c.req.param("id"), ...input }));
  })
  .post("/:id/refund/deny", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    const input = parse(denyBody, await body(c));
    await readOrder(m, c.req.param("id"));
    return respond(c, await perform(denyRefund, m, { orderId: c.req.param("id"), note: input.note ?? "" }));
  })
  .post("/:id/refund/pay", requireScope("refunds:write"), async (c) => {
    const m = c.get("merchant");
    await readOrder(m, c.req.param("id"));
    return respond(c, await perform(payRefund, m, { orderId: c.req.param("id") }));
  })
  /// Move a paid order's money to the merchant account.
  .post("/:id/withdraw", requireScope("withdrawals:write"), async (c) => {
    const m = c.get("merchant");
    await readOrder(m, c.req.param("id"));
    return respond(c, await perform(withdrawOrder, m, { orderId: c.req.param("id") }));
  });
