import { accountOfUser, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { addressesOf } from "@/lib/server/customer";
import { subscriptionHistory, subscriptionWithMerchant } from "@/lib/server/repo";
import { readState } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

/// GET ?id: one of the customer's subscriptions with every payment and refund, each with its transaction for a receipt.
export async function GET(request: Request) {
  try {
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers have subscriptions here");
    const account = accountOfUser(accounts, user);
    const row = await subscriptionWithMerchant(new URL(request.url).searchParams.get("id") ?? "");
    const mine = row?.subscriber_address && addressesOf(account).some((a) => a.toLowerCase() === row.subscriber_address!.toLowerCase());
    if (!row || !mine) throw new HttpError(404, "NOT_FOUND", "No such subscription on your account");

    const [state, history] = await Promise.all([readState(row), subscriptionHistory(row.id)]);
    return Response.json({
      ...state,
      merchant: row.merchant_address,
      merchantLabel: row.merchant_label,
      viaAccount: row.subscriber_address!.toLowerCase() === account.address.toLowerCase(),
      history: history.map((h) => ({ kind: h.type === "subscription.refunded" ? "refund" : "payment", period: h.period, amount: h.amount ?? state.amount, txHash: h.tx_hash, at: h.created_at })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
