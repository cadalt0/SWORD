import { CHAINS, DEFAULT_CHAIN_ID } from "sword-sdk";

/// The stablecoin a chain's payments are in: USDT on Whitechain, USDC on Arc. Safe on the server and in the browser.
export function tokenOf(chainId: number | undefined): string {
  return CHAINS[chainId ?? DEFAULT_CHAIN_ID]?.token.symbol ?? "USDT";
}
