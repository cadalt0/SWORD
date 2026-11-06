import type { Address } from "viem";

import type { KeyRecord, MerchantAccountRecord } from "../repo/keys.js";
import { chainKit, type ChainKit } from "../chain/relayer.js";

/// How actions are signed for a merchant:
/// - relayer: a custodial account. The relayer owns it and signs.
/// - permission: a self-custody merchant that gave the relayer a permission. The relayer signs within it.
/// - self: a self-custody merchant without a permission. Its own backend signs, through sword-merchant.
export type Signing = "relayer" | "permission" | "self";

/// The merchant a request acts for, from its API key. Set by the auth middleware.
export type Merchant = {
  keyId: string;
  userId: string;
  keyPrefix: string;
  scopes: string[];
  chainId: number;
  /// The merchant on chain: the wallet itself for wallet merchants, the smart account otherwise.
  address: Address;
  /// A wallet merchant (no smart account). Decides which SDK calls apply.
  isEoa: boolean;
  custody: "custodial" | "self";
  signing: Signing;
  /// The wallet that signs when `signing` is "self": the merchant wallet, or the smart account's owner.
  signer: Address;
  /// The merchant's chain: its relayer, reader, addresses and token.
  kit: ChainKit;
};

/// Permission checks read the chain, so a merchant's answer is kept for a short while.
const CACHE_MS = 30_000;
const cache = new Map<string, { signing: Signing; at: number }>();

async function hasPermission(account: MerchantAccountRecord): Promise<boolean> {
  try {
    const { relayer } = chainKit(account.chainId);
    return account.isEoa ? (await relayer.permission.status(account.address)).state === "active" : (await relayer.accounts.status(account.address)).grantActive;
  } catch {
    return false;
  }
}

export async function signingOf(account: MerchantAccountRecord): Promise<Signing> {
  if (account.custody === "custodial") return "relayer";
  const key = `${account.chainId}:${account.address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.signing;
  const signing: Signing = (await hasPermission(account)) ? "permission" : "self";
  cache.set(key, { signing, at: Date.now() });
  return signing;
}

/// Forgets a merchant's cached answer, for example after a relayer call was refused for lack of permission.
export const forgetSigning = (chainId: number, address: string) => cache.delete(`${chainId}:${address.toLowerCase()}`);

export async function merchantFor(key: KeyRecord, account: MerchantAccountRecord): Promise<Merchant> {
  return {
    keyId: key.id,
    userId: key.userId,
    keyPrefix: key.prefix,
    scopes: key.scopes,
    chainId: key.chainId,
    address: account.address as Address,
    isEoa: account.isEoa,
    custody: account.custody,
    signing: await signingOf(account),
    signer: (account.isEoa ? account.address : account.ownerAddress) as Address,
    kit: chainKit(account.chainId),
  };
}
