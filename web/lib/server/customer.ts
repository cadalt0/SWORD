import "server-only";

import type { Address, Hex } from "viem";

import type { AccountRow } from "./repo";
import { relayerSdk } from "./sdk";
import { readState, type SubscriptionState } from "./subscriptions";
import { purchasesOf, subscriptionsHeldBy, type CustomerSubscriptionRow, type PurchaseRow } from "./repo";

const toUsdt = (base: bigint) => (Number(base) / 1e6).toString();

/// The addresses that count as this customer: their Sword account, and for a self-custody customer also their
/// own wallet (which may have subscribed or paid directly).
export function addressesOf(account: AccountRow): string[] {
  return account.custody === "self" ? [account.address, account.owner_address] : [account.address];
}

/// A subscription the customer holds, with where it stands on chain.
export type MySubscription = SubscriptionState & { merchant: string; merchantLabel: string | null; viaAccount: boolean };

export async function mySubscriptions(account: AccountRow): Promise<MySubscription[]> {
  const rows: CustomerSubscriptionRow[] = (await subscriptionsHeldBy(addressesOf(account))).filter((r) => r.chain_id === account.chain_id);
  const states = await Promise.all(
    rows.map(async (row) => {
      try {
        const state = await readState(row);
        return { ...state, merchant: row.merchant_address, merchantLabel: row.merchant_label, viaAccount: row.subscriber_address?.toLowerCase() === account.address.toLowerCase() };
      } catch {
        return null;
      }
    }),
  );
  return states.filter((s): s is MySubscription => s !== null);
}

/// An order the customer paid, with its refund progress read from the chain.
export type MyPurchase = {
  orderId: string;
  merchant: string;
  merchantLabel: string | null;
  reference: string;
  /// Decimal USDT.
  amount: string;
  status: string;
  refundStatus: string;
  refundedAmount: string;
  refundRequestedAmount: string;
  refundApprovedAmount: string;
  /// What can still be refunded.
  refundable: string;
  paidAt: string;
  txHash: string | null;
  /// Paid from the customer's Sword account. Only then can the account ask for a refund.
  viaAccount: boolean;
};

export async function myPurchases(userId: string, account: AccountRow): Promise<MyPurchase[]> {
  const rows: PurchaseRow[] = await purchasesOf(userId, addressesOf(account), account.chain_id);
  const sdk = relayerSdk(account.chain_id);
  const list = await Promise.all(
    rows.map(async (row): Promise<MyPurchase | null> => {
      try {
        const o = await sdk.orders.get(row.merchant_address as Address, row.order_id as Hex);
        return {
          orderId: row.order_id,
          merchant: row.merchant_address,
          merchantLabel: row.merchant_label,
          reference: row.reference,
          amount: toUsdt(o.amount),
          status: o.status,
          refundStatus: o.refundStatus,
          refundedAmount: toUsdt(o.refundedAmount),
          refundRequestedAmount: toUsdt(o.refundRequestedAmount),
          refundApprovedAmount: toUsdt(o.refundApprovedAmount),
          refundable: toUsdt(o.amount - o.refundedAmount),
          paidAt: (o.paidAt > BigInt(0) ? new Date(Number(o.paidAt) * 1000) : row.paid_at).toISOString(),
          txHash: row.tx_hash ?? (/^0x0*$/.test(o.paymentTxHash) ? null : o.paymentTxHash),
          viaAccount: o.payer.toLowerCase() === account.address.toLowerCase(),
        };
      } catch {
        return null;
      }
    }),
  );
  // Only orders that were actually paid. An order that was merely linked to the customer but never settled is left out.
  return list.filter((p): p is MyPurchase => p !== null && p.status !== "open" && p.status !== "failed");
}
