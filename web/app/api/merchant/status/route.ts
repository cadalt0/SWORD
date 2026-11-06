import { relayerSdk } from "@/lib/server/sdk";
import { chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { ownAccount } from "@/lib/server/owned";

export const runtime = "nodejs";

/// GET: whether the merchant account is registered, and its order book address. Read from the chain.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants have a registration");

    const book = await relayerSdk(chainId).merchant.getBook(account.address);
    return Response.json({ merchantId: account.address, registered: book !== undefined, orderBook: book ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
