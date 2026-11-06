import { CHAINS, formatUsdt, type OrderView, type SubscriptionView } from "sword-sdk";

import { config } from "../config.js";
import type { OrderRecord } from "../repo/orders.js";
import type { SubscriptionRecord } from "../repo/subscriptions.js";

/// The JSON the API answers with. Amounts are decimal strings in the chain's stablecoin (`currency`); times are ISO strings or null.

const ZERO = "0x0000000000000000000000000000000000000000";
const iso = (seconds: bigint | undefined) => (seconds && seconds > 0n ? new Date(Number(seconds) * 1000).toISOString() : null);
const nonZero = (a: string) => (a.toLowerCase() === ZERO ? null : a);

/// The page a customer pays an order on. The widget opens it.
export const checkoutUrlOf = (chainId: number, merchant: string, orderId: string) => `${config.webUrl}/pay?chain=${chainId}&merchant=${merchant}&order=${orderId}`;
/// The page a customer takes a subscription on.
export const subscribeUrlOf = (id: string) => `${config.webUrl}/subscribe?id=${id}`;

/// pending and expired are both "open" on chain; the API tells them apart by the payment window.
function orderStatus(o: OrderView): string {
  if (o.status !== "open") return o.status;
  return Date.now() / 1000 > Number(o.expiresAt) ? "expired" : "pending";
}

export function orderJson(chainId: number, merchant: string, o: OrderView, record?: OrderRecord) {
  return {
    object: "order" as const,
    id: o.orderId,
    reference: record?.reference ?? null,
    merchant,
    amount: formatUsdt(o.amount),
    currency: CHAINS[chainId]?.token.symbol ?? "USDT",
    status: orderStatus(o),
    /// Customers can also pay by sending exactly `amount` USDT here from any wallet.
    depositAddress: o.collector,
    expiresAt: iso(o.expiresAt),
    payer: nonZero(o.payer),
    paidAt: iso(o.paidAt),
    paymentTransaction: o.paymentTxHash && !/^0x0+$/.test(o.paymentTxHash) ? o.paymentTxHash : null,
    withdrawn: o.withdrawn,
    refund: {
      status: o.refundStatus,
      requested: formatUsdt(o.refundRequestedAmount),
      approved: formatUsdt(o.refundApprovedAmount),
      refunded: formatUsdt(o.refundedAmount),
    },
    checkoutUrl: checkoutUrlOf(chainId, merchant, o.orderId),
    createdAt: record?.createdAt.toISOString() ?? null,
  };
}

export function subscriptionJson(chainId: number, s: SubscriptionView, record?: SubscriptionRecord) {
  return {
    object: "subscription" as const,
    id: s.id,
    reference: record?.reference ?? null,
    name: record?.name ?? null,
    description: record?.description ?? null,
    merchant: s.merchant,
    status: s.status,
    amount: formatUsdt(s.amount),
    currency: CHAINS[chainId]?.token.symbol ?? "USDT",
    /// The exact length of one period. `periodDays` is the same length in days, a fraction for periods under a day.
    periodSeconds: Number(s.periodLength),
    periodDays: Number(s.periodLength) / 86_400,
    periods: s.periods,
    paidPeriods: s.paidPeriods,
    subscriber: s.subscriber ?? null,
    depositAddress: s.vault,
    collected: formatUsdt(s.collected),
    refunded: formatUsdt(s.refunded),
    withdrawn: formatUsdt(s.withdrawn),
    held: formatUsdt(s.held),
    refundRequest: s.refundRequested ? { amount: formatUsdt(s.requestedAmount) } : null,
    nextChargeAt: iso(s.nextChargeAt),
    accessUntil: iso(s.accessUntil),
    startedAt: iso(s.startedAt),
    cancelledAt: iso(s.cancelledAt),
    subscribeUrl: subscribeUrlOf(s.id),
    createdAt: record?.createdAt.toISOString() ?? iso(s.createdAt),
  };
}
