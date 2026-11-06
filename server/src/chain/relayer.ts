import { createPublicClient, http, type PublicClient } from "viem";
import { CHAINS, SwordSDK, supportedChainIds, type ChainEntry } from "sword-sdk";

import { ApiError } from "../errors.js";

/// One kit per chain Sword runs on: the chain's entry (addresses, token), its RPC, a relayer and a reader.
/// Each request uses the kit of its merchant's chain, so one server serves every chain with the same code.
/// The RPC comes from the chain's environment variable (WHITECHAIN_RPC_URL, ARC_RPC_URL), or its public endpoint.
export type ChainKit = {
  id: number;
  entry: ChainEntry;
  rpcUrl: string;
  /// Signs for custodial merchants, and for wallet merchants within the permission they gave.
  relayer: SwordSDK;
  publicClient: PublicClient;
};

const kits = new Map<number, ChainKit>();

export function chainKit(chainId: number): ChainKit {
  const existing = kits.get(chainId);
  if (existing) return existing;
  const entry = CHAINS[chainId];
  if (!entry) throw new ApiError(400, "UNSUPPORTED_CHAIN", `Sword does not run on chain ${chainId}`);
  const rpcUrl = process.env[entry.rpcEnvName] || entry.defaultRpcUrl;
  const kit: ChainKit = {
    id: chainId,
    entry,
    rpcUrl,
    relayer: new SwordSDK({ mode: "relayer", chainId, rpcUrl }),
    publicClient: createPublicClient({ chain: entry.chain, transport: http(rpcUrl) }) as PublicClient,
  };
  kits.set(chainId, kit);
  return kit;
}

/// Every chain the server serves.
export const CHAIN_IDS = supportedChainIds();
