import "server-only";

import type { Hex } from "viem";
import { SwordError, type SubscriptionView } from "sword-sdk";

import { HttpError } from "./api";
import { merchantAccountByAddress, recordEvent, setSubscriber, type SubscriptionOrderRow } from "./repo";
import { fiatSubscriptionPayment, paidWithOf } from "./fiat";
import { relayerSdk } from "./sdk";

/// A subscription as the website shows it: what the merchant set up, plus where it stands on chain.
export type SubscriptionState = {
  id: string;
  status: string;
  name: string;
  description: string | null;
  reference: string;
  periodDays: number;
  /// Decimal USDT.
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
  /// Seconds.
  createdAt: string;
  startedAt: string | null;
  cancelledAt: string | null;
  nextChargeAt: string | null;
  accessUntil: string | null;
  /// True when a period is due now and has not been charged.
  due: boolean;
  /// Set when it was paid in local money rather than from a wallet.
  paidWith?: ReturnType<typeof paidWithOf>;
};

const toUsdt = (base: bigint) => (Number(base) / 1e6).toString();

/// Combines the merchant's record with the chain's view of the subscription.
export function stateOf(row: SubscriptionOrderRow, view: SubscriptionView, now = BigInt(Math.floor(Date.now() / 1000))): SubscriptionState {
  return {
    id: row.id,
    status: view.status,
    name: row.name,
    description: row.description,
    reference: row.reference,
    periodDays: row.period_seconds / 86_400,
    amount: toUsdt(view.amount),
    periods: view.periods,
    paidPeriods: view.paidPeriods,
    subscriber: view.subscriber ?? null,
    vault: view.vault,
    collected: toUsdt(view.collected),
    refunded: toUsdt(view.refunded),
    withdrawn: toUsdt(view.withdrawn),
    held: toUsdt(view.held),
    refundRequested: view.refundRequested,
    requestedAmount: toUsdt(view.requestedAmount),
    createdAt: view.createdAt.toString(),
    startedAt: view.subscriber ? view.startedAt.toString() : null,
    cancelledAt: view.status === "cancelled" ? view.cancelledAt.toString() : null,
    nextChargeAt: view.nextChargeAt?.toString() ?? null,
    accessUntil: view.accessUntil?.toString() ?? null,
    due: view.nextChargeAt !== undefined && now >= view.nextChargeAt,
  };
}

/// Reads one subscription from the chain and returns the website's view of it.
export async function readState(row: SubscriptionOrderRow): Promise<SubscriptionState> {
  const [view, fiat] = await Promise.all([relayerSdk(row.chain_id).subscriptions.get(row.id as Hex), fiatSubscriptionPayment(row.id)]);
  const state = stateOf(row, view);
  if (!fiat || view.subscriber) return state;
  // Paid in local money: active from the payment, for the period it paid.
  const started = Math.floor(fiat.created_at.getTime() / 1000);
  return {
    ...state,
    status: state.status === "open" ? "active" : state.status,
    paidPeriods: Math.max(1, state.paidPeriods),
    startedAt: started.toString(),
    accessUntil: (started + row.period_seconds).toString(),
    nextChargeAt: null,
    due: false,
    paidWith: paidWithOf(fiat),
  };
}

export type ChargeOutcome = { id: string; charged: number; error?: string };

/// Pulls every period that is due into each subscription's deposit address. The relayer pays the gas. A subscription
/// that cannot be charged (for example the customer's balance is too low) is reported and skipped.
export async function collectDue(rows: SubscriptionOrderRow[]): Promise<ChargeOutcome[]> {
  const outcomes: ChargeOutcome[] = [];
  for (const row of rows) {
    const sdk = relayerSdk(row.chain_id);
    const outcome: ChargeOutcome = { id: row.id, charged: 0 };
    // At most three periods per run, so one long-overdue subscription cannot hold up the rest.
    for (let i = 0; i < 3; i++) {
      let view: SubscriptionView;
      try {
        view = await sdk.subscriptions.get(row.id as Hex);
      } catch {
        break;
      }
      if (!stateOf(row, view).due) break;
      try {
        const tx = await sdk.subscriptions.charge(row.id as Hex);
        outcome.charged += 1;
        const account = await merchantAccountByAddress(row.chain_id, row.merchant_address);
        if (account) {
          await recordEvent({
            userId: account.user_id,
            type: "subscription.charged",
            details: { chainId: row.chain_id, subscriptionId: row.id, name: row.name, period: view.paidPeriods + 1, periods: view.periods, amount: toUsdt(view.amount), subscriber: view.subscriber },
            txHash: tx.hash,
          });
        }
      } catch (error) {
        outcome.error = error instanceof SwordError ? (error.contractError ?? error.code) : "CHARGE_FAILED";
        break;
      }
    }
    outcomes.push(outcome);
  }
  return outcomes;
}

/// Called after a customer's wallet took a subscription on chain (which paid the first period). Checks that the chain
/// agrees, saves the customer, and records the start and the first payment for the merchant.
export async function recordStart(row: SubscriptionOrderRow, subscriber: string, txHash?: string): Promise<SubscriptionState> {
  const view = await relayerSdk(row.chain_id).subscriptions.get(row.id as Hex);
  if (!view.subscriber || view.subscriber.toLowerCase() !== subscriber.toLowerCase()) {
    throw new HttpError(400, "NOT_SUBSCRIBED", "This wallet has not taken the subscription");
  }
  const fresh = !row.subscriber_address;
  await setSubscriber(row.id, view.subscriber);
  const account = await merchantAccountByAddress(row.chain_id, row.merchant_address);
  if (fresh && account) {
    await recordEvent({ userId: account.user_id, type: "subscription.started", details: { chainId: row.chain_id, subscriptionId: row.id, name: row.name, subscriber: view.subscriber } });
    await recordEvent({
      userId: account.user_id,
      type: "subscription.charged",
      details: { chainId: row.chain_id, subscriptionId: row.id, name: row.name, period: 1, periods: view.periods, amount: toUsdt(view.amount), subscriber: view.subscriber },
      txHash,
    });
  }
  return stateOf({ ...row, subscriber_address: view.subscriber }, view);
}
