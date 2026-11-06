import { periodSecondsOf } from "@/lib/shared/billing";
import { addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { recordEvent, saveOrder, saveSubscriptionOrder } from "@/lib/server/repo";

export const runtime = "nodejs";

/// Event types the website records. Relayer actions are recorded by their own routes; this route records actions
/// the owner's wallet sent directly.
const TYPES = new Set([
  "merchant.registered",
  "order.created",
  "order.paid",
  "order.withdrawn",
  "refund.requested",
  "refund.approved",
  "refund.denied",
  "refund.paid",
  "funds.sent",
  "subscription.created",
  "subscription.subscribed",
  "subscription.cancelled",
  "subscription.withdrawn",
  "subscription.refunded",
  "subscription.refund_denied",
]);

/// POST {type, details, txHash, order?, subscription?}. For order.created and subscription.created, the record is saved
/// so it appears in the merchant's lists.
export async function POST(request: Request) {
  try {
    const { user, accounts } = await requireUser();
    const body = await bodyOf(request);
    if (typeof body.type !== "string" || !TYPES.has(body.type)) throw new HttpError(400, "INVALID_EVENT", "Unknown event");
    const details = (typeof body.details === "object" && body.details !== null ? body.details : {}) as Record<string, unknown>;
    const chainId = chainIdFrom(details.chainId);
    const txHash = typeof body.txHash === "string" ? body.txHash : undefined;

    if (body.type === "order.created") {
      const order = body.order as
        | { chainId: number; merchantAddress: string; orderId: string; reference: string; collector: string; amount: string }
        | undefined;
      if (!order) throw new HttpError(400, "INVALID_INPUT", "order details are required");
      const merchant = accounts.find((a) => a.kind === "merchant");
      if (!merchant || merchant.address.toLowerCase() !== addressFrom(order.merchantAddress, "Merchant").toLowerCase()) {
        throw new HttpError(403, "NOT_YOUR_ACCOUNT", "This order belongs to another account");
      }
      await saveOrder({
        chainId: chainIdFrom(order.chainId),
        merchantAddress: merchant.address,
        orderId: order.orderId,
        reference: order.reference,
        collector: order.collector,
        amount: order.amount,
      });
    }

    if (body.type === "subscription.created") {
      const sub = body.subscription as
        | { id: string; merchantAddress: string; reference: string; name: string; description?: string | null; amount: string; periodDays?: number; periodSeconds?: number; periods: number; vault: string | null }
        | undefined;
      if (!sub || !/^0x[0-9a-fA-F]{64}$/.test(sub.id)) throw new HttpError(400, "INVALID_INPUT", "subscription details are required");
      const merchant = accounts.find((a) => a.kind === "merchant");
      if (!merchant || merchant.address.toLowerCase() !== addressFrom(sub.merchantAddress, "Merchant").toLowerCase()) {
        throw new HttpError(403, "NOT_YOUR_ACCOUNT", "This subscription belongs to another account");
      }
      await saveSubscriptionOrder({
        id: sub.id,
        chainId,
        merchantAddress: merchant.address,
        reference: sub.reference,
        name: sub.name,
        description: sub.description ?? null,
        amount: sub.amount,
        periodSeconds: sub.periodSeconds ?? periodSecondsOf(Number(sub.periodDays)),
        periods: Number(sub.periods),
        vault: sub.vault,
      });
    }

    await recordEvent({ userId: user.id, type: body.type, details, txHash });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
