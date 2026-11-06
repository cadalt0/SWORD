import { createWalletClient, custom, toHex, type Address, type Hex } from "viem";
import { SwordSDK } from "sword-sdk";

import { ApiError } from "../errors.js";
import type { ChainKit } from "./relayer.js";

/// A transaction for a merchant's own wallet to sign.
export type PreparedTransaction = { to: Address; data: Hex; value: bigint };

/// Thrown inside the SDK when it reaches the point of sending, so nothing is sent.
class Captured extends Error {}

/// Runs an SDK action as if `signer` were connected, and returns the first transaction it would send, without sending it.
/// The SDK still does all its checks first (input, chain state, and a simulation from the signer's address), so a
/// transaction that would fail is refused here, before the merchant signs anything.
export async function prepareFor(kit: ChainKit, signer: Address, run: (sdk: SwordSDK) => Promise<unknown>): Promise<PreparedTransaction> {
  let captured: PreparedTransaction | undefined;
  const provider = {
    async request({ method, params }: { method: string; params?: unknown }) {
      if (method === "eth_sendTransaction") {
        const tx = (params as [{ to: Address; data?: Hex; input?: Hex; value?: Hex }])[0];
        captured = { to: tx.to, data: tx.data ?? tx.input ?? "0x", value: tx.value ? BigInt(tx.value) : 0n };
        throw new Captured("captured");
      }
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [signer];
      if (method === "eth_chainId") return toHex(kit.id);
      return kit.publicClient.request({ method, params } as never);
    },
  };
  const walletClient = createWalletClient({ account: signer, chain: kit.entry.chain, transport: custom(provider) });
  const sdk = new SwordSDK({ mode: "merchant", chainId: kit.id, rpcUrl: kit.rpcUrl, walletClient });
  try {
    await run(sdk);
  } catch (error) {
    if (!captured) throw error;
  }
  if (!captured) throw new ApiError(409, "NOTHING_TO_SIGN", "There is nothing to sign for this action right now");
  return captured;
}
