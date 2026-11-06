import { relayerSdk } from "@/lib/server/sdk";
import { accountOfUser, bodyOf, chainIdFrom, errorResponse, HttpError, addressFrom, requireUser } from "@/lib/server/api";
import { recordEvent } from "@/lib/server/repo";

export const runtime = "nodejs";

/// POST {merchantAddress, orderId}: the signed-in customer pays an order from their own account.
/// The relayer sends the transaction; for self-custody accounts it acts within the owner's grant.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers pay orders");
    const account = accountOfUser(accounts, user);
    const merchant = addressFrom(body.merchantAddress, "Merchant address");
    if (typeof body.orderId !== "string") throw new HttpError(400, "INVALID_INPUT", "orderId is required");

    const result = await relayerSdk(chainId).accounts.customer.payOrder({
      account: account.address,
      merchant,
      orderId: body.orderId as `0x${string}`,
    });
    await recordEvent({ userId: user.id, type: "order.paid", details: { chainId, orderId: body.orderId, merchant }, txHash: result.hash });
    return Response.json({ hash: result.hash });
  } catch (error) {
    return errorResponse(error);
  }
}
