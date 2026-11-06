"use client";

import { createContext, useContext, type ReactNode } from "react";

import { tokenOf } from "../shared/token";

/// Which stablecoin the page is showing amounts in. A page sets it once from its chain (the account's chain, or the
/// chain of the order or subscription it shows); everything inside reads it. Outside any page it is the default chain's.
const TokenContext = createContext<string>(tokenOf(undefined));

export function ChainToken({ chainId, children }: { chainId: number | undefined; children: ReactNode }) {
  return <TokenContext.Provider value={tokenOf(chainId)}>{children}</TokenContext.Provider>;
}

/// The page's stablecoin symbol, for text built in code.
export const useToken = () => useContext(TokenContext);

/// The page's stablecoin symbol, for text on screen: <Token />.
export function Token() {
  return <>{useContext(TokenContext)}</>;
}
