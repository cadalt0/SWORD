"use client";

import { CHAINS, SwordSDK } from "sword-sdk";
import type { Address } from "./types";

/// The MetaMask browser extension, when installed. WalletConnect is not used.
type Ethereum = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export function metamask(): Ethereum | undefined {
  return (globalThis as unknown as { ethereum?: Ethereum }).ethereum;
}

export function hasMetaMask(): boolean {
  return metamask() !== undefined;
}

/// The real public RPC address for a chain, given to the wallet when it adds the network. Next.js only inlines
/// NEXT_PUBLIC_ variables written out in full, so each chain's variable is named here.
const WALLET_RPC: Record<number, string | undefined> = {
  1874: process.env.NEXT_PUBLIC_WHITECHAIN_RPC_URL,
  5042002: process.env.NEXT_PUBLIC_ARC_RPC_URL,
};

export function walletRpcFor(chainId: number): string {
  const entry = CHAINS[chainId];
  if (!entry) throw new Error(`Chain ${chainId} is not supported`);
  return WALLET_RPC[chainId] || entry.defaultRpcUrl;
}

/// Where the page reads a chain: through this site (/api/rpc/<chain>), because browser shields and ad blockers often
/// block public blockchain RPC addresses. Writes never go here; the wallet sends them itself.
export function publicRpcFor(chainId: number): string {
  if (!CHAINS[chainId]) throw new Error(`Chain ${chainId} is not supported`);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/api/rpc/${chainId}`;
}

/// Asks MetaMask to switch to the chain. If MetaMask does not know the chain, it is added first.
export async function ensureChain(chainId: number): Promise<void> {
  const eth = metamask();
  if (!eth) throw new Error("Install the MetaMask extension to continue");
  const entry = CHAINS[chainId];
  if (!entry) throw new Error(`Chain ${chainId} is not supported`);
  const hex = `0x${chainId.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: entry.chain.name,
          nativeCurrency: entry.chain.nativeCurrency,
          rpcUrls: [walletRpcFor(chainId)],
          ...(entry.chain.blockExplorers ? { blockExplorerUrls: [entry.chain.blockExplorers.default.url] } : {}),
        },
      ],
    });
  }
}

/// Connects MetaMask, moves it to the chain, and returns the selected account.
export async function connectWallet(chainId: number): Promise<Address> {
  const eth = metamask();
  if (!eth) throw new Error("Install the MetaMask extension to continue");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts[0]) throw new Error("MetaMask did not return an account");
  await ensureChain(chainId);
  return accounts[0];
}

/// A browser SDK instance that sends transactions from the user's own wallet (MetaMask).
export function ownerSdk(chainId: number, owner: Address): SwordSDK {
  const eth = metamask();
  if (!eth) throw new Error("Install the MetaMask extension to continue");
  if (!CHAINS[chainId]) throw new Error(`Chain ${chainId} is not supported`);
  return new SwordSDK({ mode: "merchant", chainId, provider: eth, account: owner, rpcUrl: publicRpcFor(chainId) });
}

/// Turns the grant JSON from the server back into the bigint values the SDK signs.
export function grantFromJson(value: {
  account: string;
  terms: { relayer: string; expiry: string; maxAmount: string; nonce: string };
}) {
  return {
    account: value.account as Address,
    terms: {
      relayer: value.terms.relayer as Address,
      expiry: BigInt(value.terms.expiry),
      maxAmount: BigInt(value.terms.maxAmount),
      nonce: BigInt(value.terms.nonce),
    },
  };
}


/// A wallet merchant's permission (a mandate on its order book), from the JSON the server sent.
export function mandateFromJson(json: Record<string, unknown>) {
  const terms = json.terms as Record<string, string>;
  return {
    merchant: json.merchant as Address,
    book: json.book as Address,
    terms: {
      relayer: terms.relayer as Address,
      expiry: BigInt(terms.expiry),
      maxOrders: BigInt(terms.maxOrders),
      maxActions: BigInt(terms.maxActions),
      maxAmount: BigInt(terms.maxAmount),
      nonce: BigInt(terms.nonce),
    },
  };
}
