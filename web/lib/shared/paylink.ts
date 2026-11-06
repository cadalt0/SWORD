/// The link a merchant shares for an order. It opens the payment page at /pay.
export function payLink(origin: string, chainId: number, merchant: string, orderId: string): string {
  return `${origin}/pay?chain=${chainId}&merchant=${merchant}&order=${orderId}`;
}

/// A payment request any wallet can scan (EIP-681): send `amount` (token base units) of `token` to `to` on `chainId`.
/// The wallet fills in the network, the token, the address, and the exact amount.
export function walletPayUri(chainId: number, token: string, to: string, amount: string | bigint): string {
  return `ethereum:${token}@${chainId}/transfer?address=${to}&uint256=${amount.toString()}`;
}

/// Reads a wallet payment request back: the recipient and the amount in base units. Undefined when the text is not one.
export function parseWalletPayUri(text: string): { chainId?: number; token: string; to: string; amount: bigint } | undefined {
  const match = /^ethereum:(0x[0-9a-fA-F]{40})(?:@(\d+))?\/transfer\?(.+)$/i.exec(text.trim());
  if (!match) return undefined;
  const params = new URLSearchParams(match[3]);
  const to = params.get("address");
  const raw = params.get("uint256");
  if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to) || !raw) return undefined;
  // Wallets may write the amount in scientific notation, such as 2.5e6.
  const amount = /e/i.test(raw) ? BigInt(Math.round(Number(raw))) : BigInt(raw);
  return { chainId: match[2] ? Number(match[2]) : undefined, token: match[1], to, amount };
}
