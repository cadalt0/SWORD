import { addressFrom, bodyOf, errorResponse, HttpError } from "@/lib/server/api";
import { subscriptionOrderById } from "@/lib/server/repo";
import { recordStart } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

/// Public: called right after a customer's wallet took a subscription on chain (which already paid the first period).
/// Checks the chain agrees and records it for the merchant. Moves no money.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const row = await subscriptionOrderById(typeof body.id === "string" ? body.id : "");
    if (!row) throw new HttpError(404, "NOT_FOUND", "This subscription does not exist");
    const subscriber = addressFrom(body.subscriber, "Subscriber");
    const txHash = typeof body.txHash === "string" ? body.txHash : undefined;
    return Response.json({ state: await recordStart(row, subscriber, txHash) });
  } catch (error) {
    return errorResponse(error);
  }
}
