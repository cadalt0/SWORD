import "server-only";

import { SwordSDK } from "sword-sdk";

import { requireEnv } from "./env";
import { rpcUrlFor } from "./rpc";

/// A relayer-mode SDK for one request. The relayer key stays on the server and is never sent to the browser.
/// A new instance is made per request, so a chain choice in one request never affects another.
export function relayerSdk(chainId: number): SwordSDK {
  // The SDK expects the key with a 0x prefix. Add it if the environment value was stored without one.
  const key = requireEnv("RELAYER_PRIVATE_KEY");
  process.env.RELAYER_PRIVATE_KEY = key.startsWith("0x") ? key : `0x${key}`;
  return new SwordSDK({ mode: "relayer", chainId, rpcUrl: rpcUrlFor(chainId) });
}

/// The relayer's address, used as the owner of custodial accounts.
export function relayerAddress(chainId: number): string {
  return relayerSdk(chainId).address;
}
