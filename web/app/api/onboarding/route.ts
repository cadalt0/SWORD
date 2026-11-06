import { relayerSdk } from "@/lib/server/sdk";
import { chainIdFrom, errorResponse, requireUser } from "@/lib/server/api";

export const runtime = "nodejs";

/// GET: whether the merchant is ready. Created, registered on chain, and for the signless option the relayer's
/// permission is active. The dashboard opens only when this is ready.
export async function GET(request: Request) {
  try {
    const asked = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, accounts } = await requireUser();
    const account = accounts.find((a) => a.kind === user.role);
    if (!account) return Response.json({ ready: false, hasAccount: false, registered: false, grantActive: false, signing: null, chainId: asked });
    // An account lives on one chain. Its setup is always checked there, whatever chain was asked.
    const chainId = account.chain_id;

    const sdk = relayerSdk(chainId);
    // Customers have no registration step.
    const registered = user.role === "customer" ? true : (await sdk.merchant.getBook(account.address)) !== undefined;
    let grantActive = true;
    if (account.signing === "signless" && registered) {
      grantActive = account.is_eoa
        ? (await sdk.permission.status(account.address)).state === "active"
        : (await sdk.accounts.status(account.address)).grantActive;
    } else if (account.signing === "signless") {
      grantActive = false;
    }
    return Response.json({
      ready: registered && grantActive,
      hasAccount: true,
      chainId,
      accountAddress: account.address,
      /// The wallet that must sign for a self-custody account.
      ownerAddress: account.custody === "self" ? account.owner_address : null,
      signing: account.signing,
      registered,
      grantActive,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
