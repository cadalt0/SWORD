import { erc20Abi, parseAbiItem, type Address, type Hex } from "viem";
import type { OrderView } from "sword-sdk";

import type { ChainKit } from "../chain/relayer.js";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
/// The RPC answers log queries over at most about 5,000 blocks. An order is open for 20 minutes, about 1,200 blocks.
const LOOKBACK = 4_900n;

export type FoundTransfer = { payer: Address; transferTime: bigint; txHash: Hex };

/// Finds the plain USDT transfer that paid an open order (a scanned QR, or any wallet sending to its deposit address).
/// "pending": not fully paid yet. "late": paid after the window closed, so it can't be accepted.
export async function findTransfer(kit: ChainKit, order: OrderView): Promise<FoundTransfer | "pending" | "late"> {
  const { publicClient } = kit;
  const usdt = kit.entry.addresses.usdt;
  const balance = await publicClient.readContract({ address: usdt, abi: erc20Abi, functionName: "balanceOf", args: [order.collector] });
  if (balance < order.amount) return "pending";

  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getLogs({ address: usdt, event: TRANSFER, args: { to: order.collector }, fromBlock: latest > LOOKBACK ? latest - LOOKBACK : 0n, toBlock: latest });
  const log = logs[logs.length - 1];
  if (!log?.args.from || !log.transactionHash || log.blockNumber === null) return "pending";
  const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
  if (block.timestamp > order.expiresAt) return "late";
  return { payer: log.args.from, transferTime: block.timestamp, txHash: log.transactionHash };
}
