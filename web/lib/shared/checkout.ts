/// Checkout mode, shared by the server pages and the client. See lib/client/checkout.ts for how the result is handed back.

export type CheckoutParams = { origin?: string; returnUrl?: string };

export type CheckoutResult =
  | { type: "paid"; orderId: string; merchant: string; txHash?: string }
  | { type: "subscribed"; subscriptionId: string; merchant: string; txHash?: string };

/// Reads checkout mode from the page's search params.
export function checkoutParams(q: Record<string, string | string[] | undefined>): CheckoutParams | undefined {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const origin = one(q.origin);
  const returnUrl = one(q.return);
  if (!origin && !returnUrl) return undefined;
  return { origin, returnUrl };
}

/// The origin the page checks with the server: the opener's origin, or the return URL's.
export function checkoutOrigin(params: CheckoutParams | undefined): string | undefined {
  if (!params) return undefined;
  if (params.origin) return params.origin;
  try {
    return params.returnUrl ? new URL(params.returnUrl).origin : undefined;
  } catch {
    return undefined;
  }
}

