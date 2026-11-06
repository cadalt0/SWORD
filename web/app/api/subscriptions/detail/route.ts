import { accountOfUser, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { subscriptionMoney, subscriptionOrderById } from "@/lib/server/repo";
import { readState } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

/// GET ?id: one of the merchant's subscriptions: its state, and every payment and refund recorded.
export async function GET(request: Request) {
  try {
    const { user, accounts } = await requireUser();
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants see subscriptions");
    const account = accountOfUser(accounts, user);
    const row = await subscriptionOrderById(new URL(request.url).searchParams.get("id") ?? "");
    if (!row || row.merchant_address.toLowerCase() !== account.address.toLowerCase()) throw new HttpError(404, "NOT_FOUND", "No such subscription");
    const [state, money] = await Promise.all([readState(row), subscriptionMoney(user.id, { subscriptionId: row.id, withRefunds: true })]);
    return Response.json({
      ...state,
      history: money.map((m) => ({ kind: m.type === "subscription.refunded" ? "refund" : "payment", period: m.period, amount: m.amount ?? state.amount, txHash: m.tx_hash, at: m.created_at })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
