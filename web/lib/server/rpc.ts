import "server-only";

import { CHAINS } from "sword-sdk";

/// The RPC endpoint the server uses for a chain: the chain's environment variable (WHITECHAIN_RPC_URL, ARC_RPC_URL),
/// or the chain's public endpoint. Throws for a chain Sword does not run on.
export function rpcUrlFor(chainId: number): string {
  const entry = CHAINS[chainId];
  if (!entry) throw new Error(`Sword does not run on chain ${chainId}`);
  return process.env[entry.rpcEnvName] || entry.defaultRpcUrl;
}
