import { erc20Abi } from "viem";
import { formatUsdt } from "sword-sdk";

import { ApiError } from "../errors.js";
import type { Merchant } from "./merchant.js";

/// A refund paid from a wallet merchant's own wallet (after it withdrew, or beyond what a subscription holds) goes
/// through the spender, which needs that wallet's allowance. Smart accounts raise it themselves; a wallet must approve.

/// What the wallet has allowed the spender to take.
export function walletAllowance(m: Merchant): Promise<bigint> {
  const { publicClient, entry } = m.kit;
  return publicClient.readContract({ address: entry.addresses.usdt, abi: erc20Abi, functionName: "allowance", args: [m.address, entry.addresses.spender] });
}

/// For a wallet merchant whose relayer signs: refuses with a clear, fixable error when the wallet's allowance is short,
/// instead of letting the transaction fail on chain. Self-signing wallets get an approval step instead.
export async function assertWalletAllowance(m: Merchant, needed: bigint): Promise<void> {
  if (!m.isEoa || m.signing === "self" || needed === 0n) return;
  const allowed = await walletAllowance(m);
  if (allowed >= needed) return;
  throw new ApiError(
    409,
    "MERCHANT_ALLOWANCE_TOO_LOW",
    `This refund is paid from your wallet, which has allowed ${formatUsdt(allowed)} ${m.kit.entry.token.symbol} but needs ${formatUsdt(needed)}. Approve the Sword spender for at least ${formatUsdt(needed)} ${m.kit.entry.token.symbol} from your wallet, then try again.`,
    { needed: formatUsdt(needed), allowed: formatUsdt(allowed), spender: m.kit.entry.addresses.spender },
  );
}
