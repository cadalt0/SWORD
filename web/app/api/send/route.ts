import { relayerSdk } from "@/lib/server/sdk";
import { accountOfUser, addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { recordEvent } from "@/lib/server/repo";

export const runtime = "nodejs";

/// POST {to, amount}: the signed-in customer sends USDT from their account to any address.
/// The relayer sends the transaction; for self-custody accounts it acts within the owner's grant.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers send funds");
    const account = accountOfUser(accounts, user);
    const to = addressFrom(body.to, "Recipient address");
    if (typeof body.amount !== "string") throw new HttpError(400, "INVALID_INPUT", "amount is required");

    const result = await relayerSdk(chainId).accounts.sendUsdt({ account: account.address, to, amount: body.amount });
    await recordEvent({ userId: user.id, type: "funds.sent", details: { chainId, to, amount: body.amount }, txHash: result.hash });
    return Response.json({ hash: result.hash });
  } catch (error) {
    return errorResponse(error);
  }
}
