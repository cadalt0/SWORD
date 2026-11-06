import { errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { subscriptionMoney } from "@/lib/server/repo";

export const runtime = "nodejs";

/// GET: every subscription payment the merchant has received, newest first. For the overview, the chart, and orders.
export async function GET() {
  try {
    const { user } = await requireUser();
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants see subscription payments");
    const rows = await subscriptionMoney(user.id);
    return Response.json({
      payments: rows.map((r) => ({
        subscriptionId: r.subscription_id,
        name: r.name ?? "Subscription",
        subscriber: r.subscriber_address,
        period: r.period,
        periods: r.periods,
        amount: r.amount ?? "0",
        txHash: r.tx_hash,
        at: r.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
