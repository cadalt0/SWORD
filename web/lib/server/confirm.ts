import "server-only";

import { createPublicClient, erc20Abi, http, parseAbiItem, type Address, type Hex } from "viem";
import { CHAINS } from "sword-sdk";

import { rpcUrlFor } from "./rpc";
import { merchantAccountByAddress, recordEvent, updateOrderStatus } from "./repo";
import { relayerSdk } from "./sdk";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const PAID = new Set(["paid", "partially_refunded", "refunded"]);
/// The RPC answers log queries over at most about 5,000 blocks. The payment window is 20 minutes (about 1,200 blocks).
const LOOKBACK = BigInt(4_900);

export type ConfirmResult = {
  /// pending: nothing received yet. paid: confirmed on chain. received: funds arrived but the merchant must confirm.
  /// late: funds arrived after the payment window. Otherwise the order's own status.
  status: string;
  paid: boolean;
  hash?: string;
  /// Who paid, when this check confirmed the payment.
  payer?: string;
  /// Set when status is "received", so the merchant's wallet can confirm the same transfer.
  transfer?: { payer: string; transferTime: string; txHash: string };
};

/// One check per order at a time, so repeated polls never send two confirmations.
const running = new Map<string, Promise<ConfirmResult>>();

/// Confirms a plain USDT transfer to an order's collector. The relayer sends the confirmation, so the payer only
/// scans and pays. Safe to call repeatedly: it sends a transaction only when the full amount is in the collector.
export function confirmTransferPayment(chainId: number, merchant: Address, orderId: Hex): Promise<ConfirmResult> {
  const key = `${chainId}:${merchant.toLowerCase()}:${orderId.toLowerCase()}`;
  const existing = running.get(key);
  if (existing) return existing;
  const job = check(chainId, merchant, orderId).finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

async function check(chainId: number, merchant: Address, orderId: Hex): Promise<ConfirmResult> {
  const sdk = relayerSdk(chainId);
  const order = await sdk.orders.get(merchant, orderId);
  if (order.status !== "open") return { status: order.status, paid: PAID.has(order.status) };

  const client = createPublicClient({ transport: http(rpcUrlFor(chainId)) });
  const usdt = CHAINS[chainId].addresses.usdt;
  const balance = await client.readContract({ address: usdt, abi: erc20Abi, functionName: "balanceOf", args: [order.collector] });
  if (balance < order.amount) {
    const expired = Date.now() / 1000 > Number(order.expiresAt);
    return { status: expired ? "expired" : "pending", paid: false };
  }

  // The full amount is there. Find the transfer that brought it, for the payer and the time.
  const latest = await client.getBlockNumber();
  const fromBlock = latest > LOOKBACK ? latest - LOOKBACK : BigInt(0);
  const logs = await client.getLogs({ address: usdt, event: TRANSFER, args: { to: order.collector }, fromBlock, toBlock: latest });
  const log = logs[logs.length - 1];
  if (!log?.args.from || !log.transactionHash || log.blockNumber === null) return { status: "pending", paid: false };

  const block = await client.getBlock({ blockNumber: log.blockNumber });
  if (block.timestamp > order.expiresAt) return { status: "late", paid: false };

  const payer = log.args.from;
  const transfer = { payer, transferTime: block.timestamp.toString(), txHash: log.transactionHash };
  const account = await merchantAccountByAddress(chainId, merchant);
  const smartAccount = account ? !account.is_eoa : ((await client.getCode({ address: merchant })) ?? "0x").length > 2;

  try {
    const tx = smartAccount
      ? await sdk.accounts.merchant.confirmTransfer({ account: merchant, orderId, payer, transferTime: block.timestamp, txHash: log.transactionHash })
      : await sdk.orders.confirmTransfer({ merchant, orderId, payer, transferTime: block.timestamp, txHash: log.transactionHash });

    const merchantAddress = account?.address ?? merchant;
    await updateOrderStatus({ chainId, merchantAddress, orderId, status: "paid", payer });
    if (account) {
      await recordEvent({ userId: account.user_id, type: "order.paid", details: { chainId, orderId, payer, via: "transfer" }, txHash: tx.hash });
    }
    return { status: "paid", paid: true, hash: tx.hash, payer };
  } catch {
    // The relayer may not act for this merchant (for example a wallet merchant without a permission).
    // Read the order again: another check may have confirmed it in the meantime.
    const again = await sdk.orders.get(merchant, orderId);
    if (again.status !== "open") return { status: again.status, paid: PAID.has(again.status) };
    return { status: "received", paid: false, transfer };
  }
}
