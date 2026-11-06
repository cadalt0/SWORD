"use client";

import type { SwordSDK } from "sword-sdk";

import { api } from "./api";
import type { Address } from "./types";
import { ownerSdk } from "./wallet";

/// The account an action is taken for. Custody decides who signs.
export type ActionAccount = { address: string; owner: string; custody: "custodial" | "self" };

export type ActionResult = { hash: string; data: Record<string, unknown> };

/// Records an action the owner's wallet sent, so the website's history stays complete.
type RecordBody = { type: string; details: Record<string, unknown>; txHash?: string; order?: Record<string, unknown>; subscription?: Record<string, unknown> };

/// Runs one action the right way for the account:
/// - custodial accounts, and self-custody accounts with an active permission: the relayer sends it.
/// - self-custody accounts without a permission: the owner's wallet must sign it, and it is sent from that wallet.
export async function runAction(opts: {
  account: ActionAccount;
  chainId: number;
  wallet: Address | undefined;
  relayer: () => Promise<Record<string, unknown> & { hash?: string }>;
  owner: (sdk: SwordSDK) => Promise<ActionResult>;
  record: (result: ActionResult) => RecordBody;
}): Promise<ActionResult> {
  const { account, chainId, wallet } = opts;

  if (account.custody === "custodial" || (await permissionActive(chainId, account))) {
    const data = await opts.relayer();
    return { hash: data.hash ?? "", data };
  }

  if (!wallet) throw new Error("Connect your wallet to sign this action. The relayer acts for you once a permission is granted.");
  if (wallet.toLowerCase() !== account.owner.toLowerCase()) {
    throw new Error(`Connect the owner wallet ${account.owner.slice(0, 8)}… to sign this action`);
  }

  const result = await opts.owner(ownerSdk(chainId, wallet));
  await api("/api/record", opts.record(result));
  return result;
}

/// Whether the relayer currently has a permission for a self-custody account.
async function permissionActive(chainId: number, account: ActionAccount): Promise<boolean> {
  if (account.custody !== "self") return true;
  const status = await api<{ grantActive: boolean }>(`/api/permission?chainId=${chainId}`);
  return status.grantActive;
}
