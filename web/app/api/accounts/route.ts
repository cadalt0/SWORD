import { relayerSdk } from "@/lib/server/sdk";
import { accountsOf, recordEvent, saveAccount } from "@/lib/server/repo";
import { addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";

export const runtime = "nodejs";

/// Creates the user's account on the chosen chain.
/// - Custodial merchant or customer: a smart account the relayer runs.
/// - Non-custodial merchant: no smart account. The merchant's own wallet is the merchant.
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const signing = body.signing === "manual" || body.signing === "signless" ? body.signing : body.signing === "relayer" || body.custody === "custodial" ? "relayer" : undefined;
    if (!signing) throw new HttpError(400, "NO_CUSTODY", "Choose how the account signs");
    const custody = signing === "relayer" ? "custodial" : "self";
    const walletMerchant = user.role === "merchant" && signing !== "relayer";

    const existing = (await accountsOf(user.id)).find((a) => a.kind === user.role);
    if (existing && existing.chain_id !== chainId) {
      throw new HttpError(409, "ACCOUNT_ON_OTHER_CHAIN", "Your account was created on another chain. Use that chain.");
    }
    if (existing) {
      return Response.json({ account: existing.address, created: false, custody: existing.custody, signing: existing.signing });
    }

    let address: `0x${string}`;
    let owner: `0x${string}`;
    let created = true;
    if (walletMerchant) {
      // The merchant's wallet is the merchant. Nothing is created on chain here; registration happens from the wallet.
      owner = addressFrom(body.ownerAddress, "Wallet address");
      address = owner;
    } else {
      const sdk = relayerSdk(chainId);
      owner = custody === "custodial" ? sdk.address : addressFrom(body.ownerAddress, "Wallet address");
      const result = await sdk.accounts.create({ kind: user.role, identifier: user.google_sub, owner });
      address = result.account;
      created = result.created;
    }

    const saved = await saveAccount({
      userId: user.id,
      kind: user.role,
      custody,
      signing,
      isEoa: walletMerchant,
      address,
      ownerAddress: owner,
      chainId,
    });
    if (created) {
      await recordEvent({ userId: user.id, type: "account.created", details: { kind: user.role, custody, signing, chainId, wallet: walletMerchant } });
    }
    return Response.json({ account: saved.address, created, custody: saved.custody, signing: saved.signing });
  } catch (error) {
    return errorResponse(error);
  }
}
