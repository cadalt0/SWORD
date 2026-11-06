import { db } from "../db.js";

/// A key that is active, with the merchant account it acts for.
export type KeyRecord = {
  id: string;
  userId: string;
  prefix: string;
  scopes: string[];
  chainId: number;
  accountAddress: string;
};

export type MerchantAccountRecord = {
  address: string;
  ownerAddress: string;
  custody: "custodial" | "self";
  signing: "relayer" | "manual" | "signless";
  isEoa: boolean;
  chainId: number;
};

/// The active key with this hash, or undefined when it does not exist or was revoked.
export async function activeKeyByHash(hash: string): Promise<KeyRecord | undefined> {
  const { rows } = await db.query<{ id: string; user_id: string; prefix: string; scopes: string[]; chain_id: number; account_address: string }>(
    "SELECT id, user_id, prefix, scopes, chain_id, account_address FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
    [hash],
  );
  const r = rows[0];
  return r && { id: r.id, userId: r.user_id, prefix: r.prefix, scopes: r.scopes, chainId: r.chain_id, accountAddress: r.account_address };
}

/// The key owner's merchant account, but only if it is still the account the key was made for.
export async function merchantAccountOf(key: KeyRecord): Promise<MerchantAccountRecord | undefined> {
  const { rows } = await db.query<{ address: string; owner_address: string; custody: "custodial" | "self"; signing: "relayer" | "manual" | "signless"; is_eoa: boolean; chain_id: number }>(
    `SELECT a.address, a.owner_address, a.custody, a.signing, a.is_eoa, a.chain_id
     FROM accounts a JOIN users u ON u.id = a.user_id
     WHERE a.user_id = $1 AND a.kind = 'merchant' AND u.role = 'merchant' AND a.chain_id = $2 AND lower(a.address) = lower($3)`,
    [key.userId, key.chainId, key.accountAddress],
  );
  const r = rows[0];
  return r && { address: r.address, ownerAddress: r.owner_address, custody: r.custody, signing: r.signing, isEoa: r.is_eoa, chainId: r.chain_id };
}

/// Notes when a key was used. Called at most once a minute per key, so busy keys don't write on every call.
const touched = new Map<string, number>();
export async function touchKey(id: string): Promise<void> {
  const now = Date.now();
  if ((touched.get(id) ?? 0) > now - 60_000) return;
  touched.set(id, now);
  await db.query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [id]);
}
