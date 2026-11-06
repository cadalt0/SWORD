import { CHAINS, DEFAULT_CHAIN_ID } from "sword-sdk";

/// The block explorer of a chain, from the SDK: Arc's for Arc, Whitechain's for Whitechain. Never mixes chains.
export function explorerOf(chainId: number | undefined): string {
  const entry = CHAINS[chainId ?? DEFAULT_CHAIN_ID] ?? CHAINS[DEFAULT_CHAIN_ID]!;
  return (entry.chain.blockExplorers?.default.url ?? "").replace(/\/+$/, "");
}

export const explorerTx = (chainId: number | undefined, hash: string) => `${explorerOf(chainId)}/tx/${hash}`;
export const explorerAddress = (chainId: number | undefined, address: string) => `${explorerOf(chainId)}/address/${address}`;
