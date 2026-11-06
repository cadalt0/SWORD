import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { createKey, DEFAULT_SCOPES, keysOf, SCOPES } from "@/lib/server/developers";
import { ownAccount } from "@/lib/server/owned";
import { relayerSdk } from "@/lib/server/sdk";

export const runtime = "nodejs";

const view = (k: Awaited<ReturnType<typeof keysOf>>[number]) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  scopes: k.scopes,
  account: k.account_address,
  chainId: k.chain_id,
  createdAt: k.created_at,
  lastUsedAt: k.last_used_at,
  revokedAt: k.revoked_at,
});

/// How the API signs for this merchant: "relayer" (custodial), "permission" (a wallet merchant's active permission), or
/// "self" (the merchant's backend signs with its own key). Matches server/src/services/merchant.ts.
async function signingOf(account: { custody: string; is_eoa: boolean; address: string }, chainId: number): Promise<"relayer" | "permission" | "self"> {
  if (account.custody === "custodial") return "relayer";
  try {
    const sdk = relayerSdk(chainId);
    const active = account.is_eoa ? (await sdk.permission.status(account.address)).state === "active" : (await sdk.accounts.status(account.address)).grantActive;
    return active ? "permission" : "self";
  } catch {
    return "self";
  }
}

/// GET: the merchant's API keys (never the keys themselves), the scopes a key can hold, and how the API signs.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants have API keys");
    const [keys, signing] = await Promise.all([keysOf(user.id), signingOf(account, chainId)]);
    return Response.json({ keys: keys.map(view), scopes: SCOPES, defaultScopes: DEFAULT_SCOPES, signing });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {name, scopes}: creates a key for the merchant's account. The full key is in this answer only.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants create API keys");
    const scopes = Array.isArray(body.scopes) ? body.scopes.map(String) : DEFAULT_SCOPES;
    const { key, row } = await createKey({ userId: user.id, accountAddress: account.address, chainId, name: typeof body.name === "string" ? body.name : "", scopes });
    return Response.json({ key, apiKey: view(row) });
  } catch (error) {
    return errorResponse(error);
  }
}
