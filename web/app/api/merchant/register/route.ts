import { relayerSdk } from "@/lib/server/sdk";
import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { ownAccount } from "@/lib/server/owned";
import { recordEvent } from "@/lib/server/repo";

export const runtime = "nodejs";

/// Registers a custodial merchant account (the relayer owns it). Safe to call again: an account that is already
/// registered is reported as registered. Self-custody merchants register from their own wallet.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchant accounts register");
    if (account.custody !== "custodial") {
      throw new HttpError(400, "SELF_CUSTODY", "Self-custody merchants register from their own wallet");
    }

    const sdk = relayerSdk(chainId);
    // Already registered (a retried or resumed setup): nothing to do, and that is success.
    const existing = await sdk.merchant.getBook(account.address);
    if (existing) return Response.json({ registered: true, alreadyRegistered: true, orderBook: existing });

    try {
      const result = await sdk.accounts.merchant.register(account.address);
      await recordEvent({ userId: user.id, type: "merchant.registered", details: { chainId }, txHash: result.hash });
      return Response.json({ registered: true, hash: result.hash });
    } catch (error) {
      // Another request registered it first: also success.
      const book = await sdk.merchant.getBook(account.address).catch(() => undefined);
      if (book) return Response.json({ registered: true, alreadyRegistered: true, orderBook: book });
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
