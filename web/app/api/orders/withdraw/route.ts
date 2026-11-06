import { relayerSdk } from "@/lib/server/sdk";
import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { ownAccount } from "@/lib/server/owned";
import { recordEvent } from "@/lib/server/repo";

export const runtime = "nodejs";

/// POST {orderId}: moves a paid order's balance to the merchant's account. Anyone may do this on chain;
/// the website does it for the merchant.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants withdraw");
    if (typeof body.orderId !== "string") throw new HttpError(400, "INVALID_INPUT", "orderId is required");

    const result = await relayerSdk(chainId).orders.withdraw(account.address, body.orderId as `0x${string}`);
    await recordEvent({ userId: user.id, type: "order.withdrawn", details: { chainId, orderId: body.orderId }, txHash: result.hash });
    return Response.json({ hash: result.hash });
  } catch (error) {
    return errorResponse(error);
  }
}
