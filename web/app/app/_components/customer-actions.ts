import { api } from "@/lib/client/api";

import type { SwordAction } from "./SwordPay";

/// What a customer's Sword account does on a subscription or an order, ready for the shared "Pay with Sword"
/// element: how the server does it (the relayer), and how the owner's wallet does it.

type Subject = { id: string; name: string; amount: string };

export function subscriptionAction(chainId: number, sub: Subject, kind: "subscribe" | "cancel"): SwordAction {
  const id = sub.id as `0x${string}`;
  const details = { chainId, subscriptionId: sub.id, name: sub.name };
  return {
    relayer: () => api("/api/subscriptions/customer", { chainId, action: kind, id: sub.id }),
    owner: async (sdk, account) => {
      const tx =
        kind === "subscribe"
          ? await sdk.accounts.customer.subscribe({ account: account.address, id })
          : await sdk.accounts.customer.cancelSubscription({ account: account.address, id });
      // Tell the merchant's side, the same way the server does when the relayer sends it.
      if (kind === "subscribe") {
        await fetch("/api/subscriptions/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: sub.id, subscriber: account.address, txHash: tx.hash }),
        });
      }
      return { hash: tx.hash, data: {} };
    },
    record: (r) => ({ type: kind === "subscribe" ? "subscription.subscribed" : "subscription.cancelled", details: kind === "subscribe" ? { ...details, amount: sub.amount } : details, txHash: r.hash }),
  };
}

export function subscriptionRefundAction(chainId: number, sub: Pick<Subject, "id" | "name">, amount: string, reason: string): SwordAction {
  return {
    relayer: () => api("/api/subscriptions/customer", { chainId, action: "refund", id: sub.id, amount, reason }),
    owner: async (sdk, account) => ({
      hash: (await sdk.accounts.customer.requestSubscriptionRefund({ account: account.address, id: sub.id as `0x${string}`, amount, reason })).hash,
      data: {},
    }),
    record: (r) => ({ type: "refund.requested", details: { chainId, subscriptionId: sub.id, name: sub.name, amount }, txHash: r.hash }),
  };
}

export function orderRefundAction(chainId: number, order: { orderId: string; merchant: string }, amount: string, reason: string): SwordAction {
  return {
    relayer: () => api("/api/refunds", { chainId, action: "request", merchantAddress: order.merchant, orderId: order.orderId, amount, reason }),
    owner: async (sdk, account) => ({
      hash: (
        await sdk.accounts.customer.requestOrderRefund({
          account: account.address,
          merchant: order.merchant as `0x${string}`,
          orderId: order.orderId as `0x${string}`,
          amount,
          reason,
        })
      ).hash,
      data: {},
    }),
    record: (r) => ({ type: "refund.requested", details: { chainId, orderId: order.orderId, amount }, txHash: r.hash }),
  };
}
