import type { Hex, TransactionReceipt } from "viem";

import { ApiError } from "../errors.js";
import type { ChainKit } from "./relayer.js";

const sameHex = (a: string | null | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();

/// Checks that a hash a merchant reported is the transaction we prepared: from the merchant's wallet, to the same
/// contract, with the same data, and that it succeeded on chain. Waits for it to be mined.
export async function verifySubmitted(kit: ChainKit, expected: { from: string; to: string; data: string }, hash: Hex): Promise<TransactionReceipt> {
  const { publicClient } = kit;
  let tx: Awaited<ReturnType<typeof publicClient.getTransaction>> | undefined;
  for (let i = 0; i < 20 && !tx; i++) {
    try {
      tx = await publicClient.getTransaction({ hash });
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!tx) throw new ApiError(404, "TRANSACTION_NOT_FOUND", "That transaction isn't on chain. Check the hash and the network.");
  if (!sameHex(tx.from, expected.from)) throw new ApiError(400, "WRONG_SENDER", "That transaction was not sent by the merchant's wallet");
  if (!sameHex(tx.to, expected.to) || !sameHex(tx.input, expected.data)) throw new ApiError(400, "WRONG_TRANSACTION", "That transaction is not the one prepared for this action");

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new ApiError(400, "TRANSACTION_REVERTED", "That transaction failed on chain");
  return receipt;
}
