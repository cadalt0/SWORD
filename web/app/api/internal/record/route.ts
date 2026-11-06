import { periodSecondsOf } from "@/lib/shared/billing";
import { timingSafeEqual } from "node:crypto";

import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { requireEnv } from "@/lib/server/env";
import { recordEvent, saveOrder, saveSubscriptionOrder } from "@/lib/server/repo";

export const runtime = "nodejs";

/// Internal: the API server (server/) records what it did through here, so the website keeps one way of saving orders,
/// subscriptions and events, and notifications follow. Protected by INTERNAL_API_SECRET, shared by both apps only.
///
/// POST {userId, type, details, txHash?, order?, subscription?}
function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("x-sword-internal") ?? "");
  const secret = Buffer.from(requireEnv("INTERNAL_API_SECRET"));
  return given.length === secret.length && timingSafeEqual(given, secret);
}

export async function POST(request: Request) {
  try {
    if (!authorized(request)) throw new HttpError(401, "UNAUTHORIZED", "Not allowed");
    const body = await bodyOf(request);
    if (typeof body.userId !== "string" || typeof body.type !== "string") throw new HttpError(400, "INVALID_INPUT", "userId and type are required");
    const details = (typeof body.details === "object" && body.details !== null ? body.details : {}) as Record<string, unknown>;
    const txHash = typeof body.txHash === "string" ? body.txHash : undefined;

    const order = body.order as { chainId: number; merchantAddress: string; orderId: string; reference: string; collector: string; amount: string } | undefined;
    if (order) {
      await saveOrder({ chainId: chainIdFrom(order.chainId), merchantAddress: order.merchantAddress, orderId: order.orderId, reference: order.reference, collector: order.collector, amount: order.amount });
    }
    const sub = body.subscription as
      | { id: string; chainId: number; merchantAddress: string; reference: string; name: string; description?: string | null; amount: string; periodDays?: number; periodSeconds?: number; periods: number; vault: string | null }
      | undefined;
    if (sub) {
      await saveSubscriptionOrder({
        id: sub.id,
        chainId: chainIdFrom(sub.chainId),
        merchantAddress: sub.merchantAddress,
        reference: sub.reference,
        name: sub.name,
        description: sub.description ?? null,
        amount: sub.amount,
        periodSeconds: sub.periodSeconds ?? periodSecondsOf(Number(sub.periodDays)),
        periods: Number(sub.periods),
        vault: sub.vault,
      });
    }
    await recordEvent({ userId: body.userId, type: body.type, details, txHash });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
