/// What the customer's pages know about their subscriptions and purchases, and the rules built on it.

export type MySub = {
  id: string;
  status: string;
  name: string;
  description: string | null;
  reference: string;
  periodDays: number;
  amount: string;
  periods: number;
  paidPeriods: number;
  subscriber: string | null;
  vault: string;
  collected: string;
  refunded: string;
  withdrawn: string;
  held: string;
  refundRequested: boolean;
  requestedAmount: string;
  createdAt: string;
  startedAt: string | null;
  cancelledAt: string | null;
  nextChargeAt: string | null;
  accessUntil: string | null;
  due: boolean;
  merchant: string;
  merchantLabel: string | null;
  /// Held by the signed-in customer's Sword account, so the account can act on it.
  viaAccount: boolean;
};

export type MyPurchase = {
  orderId: string;
  merchant: string;
  merchantLabel: string | null;
  reference: string;
  amount: string;
  status: string;
  refundStatus: string;
  refundedAmount: string;
  refundRequestedAmount: string;
  refundApprovedAmount: string;
  refundable: string;
  paidAt: string;
  txHash: string | null;
  viaAccount: boolean;
};

/// How far ahead a payment counts as "coming up" for the warning.
export const WARN_DAYS = 7;

const live = (s: MySub) => s.status === "active" && s.nextChargeAt !== null;

/// The payments still to come, soonest first.
export function upcoming(subs: MySub[]): MySub[] {
  return subs.filter(live).sort((a, b) => Number(a.nextChargeAt) - Number(b.nextChargeAt));
}

/// The payments due now or within the warning window, soonest first.
export function dueSoon(subs: MySub[], now = Date.now() / 1000): MySub[] {
  return upcoming(subs).filter((s) => Number(s.nextChargeAt) <= now + WARN_DAYS * 86_400);
}

/// Which upcoming payments the balance can't cover, counting them in date order. A payment is "short" when the balance
/// runs out before it. Returns the ids, and how much is needed in total.
export function shortfall(subs: MySub[], balance: number | undefined): { shortIds: Set<string>; needed: number; first: MySub | undefined } {
  const soon = dueSoon(subs);
  const total = soon.reduce((n, s) => n + Number(s.amount), 0);
  const shortIds = new Set<string>();
  if (balance === undefined) return { shortIds, needed: total, first: soon[0] };
  let running = 0;
  for (const s of soon) {
    running += Number(s.amount);
    if (running > balance) shortIds.add(s.id);
  }
  return { shortIds, needed: total, first: soon.find((s) => shortIds.has(s.id)) };
}

/// A short, friendly date for a time in seconds.
export function niceDate(seconds: string | null | undefined, withYear = false): string {
  if (!seconds) return "—";
  return new Date(Number(seconds) * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/// "Today", "Tomorrow", "in 5 days", or "3 days overdue".
export function inDays(seconds: string | null | undefined, now = Date.now() / 1000): string {
  if (!seconds) return "";
  const days = Math.ceil((Number(seconds) - now) / 86_400);
  if (days < 0) return `${-days} ${-days === 1 ? "day" : "days"} late`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

/// The link to a receipt for a transaction.
export const receiptHref = (txHash: string, chainId: number) => `/receipt?tx=${txHash}&chain=${chainId}`;
