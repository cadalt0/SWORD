import { errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { checkoutOriginAllowed } from "@/lib/server/developers";
import { subscriptionOrderById } from "@/lib/server/repo";
import { readState } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

/// Public: what a customer needs to take a subscription. With ?wallet=, says whether that wallet is its customer and,
/// if so, includes where the subscription stands. Another customer's details are never returned.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const row = await subscriptionOrderById(params.get("id") ?? "");
    if (!row) throw new HttpError(404, "NOT_FOUND", "This subscription does not exist");
    const state = await readState(row);
    // Whose subscription this is: a connected wallet, or the Sword account of the signed-in customer.
    const viewer = await requireUser().then((v) => v.accounts.find((a) => a.kind === "customer" && v.user.role === "customer")?.address.toLowerCase()).catch(() => undefined);
    const wallet = params.get("wallet")?.toLowerCase();
    const subscriber = state.subscriber?.toLowerCase();
    const viaAccount = !!viewer && subscriber === viewer;
    const mine = viaAccount || (!!wallet && subscriber === wallet);
    const origin = params.get("origin");
    const originAllowed = origin ? await checkoutOriginAllowed(row.merchant_address, row.chain_id, origin) : undefined;
    return Response.json({
      id: row.id,
      chainId: row.chain_id,
      merchant: row.merchant_address,
      name: row.name,
      description: row.description,
      amount: state.amount,
      periodDays: row.period_seconds / 86_400,
      periods: row.periods,
      status: state.status,
      taken: state.subscriber !== null || !!state.paidWith,
      mine,
      /// True when it belongs to the signed-in customer's Sword account, so actions go through that account.
      viaAccount,
      state: mine ? state : null,
      originAllowed,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
