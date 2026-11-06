import type { Hex } from "viem";
import { formatUsdt, parseUsdt, subscriptionIdOf, SwordError, type SubscriptionView, type SwordSDK } from "sword-sdk";

import { ApiError } from "../errors.js";
import { subscriptionRecord, subscriptionRecords, type SubscriptionRecord } from "../repo/subscriptions.js";
import { defineAction, single, type Step } from "./actions.js";
import { assertWalletAllowance, walletAllowance } from "./allowance.js";
import type { Merchant } from "./merchant.js";
import { record } from "./records.js";
import { subscriptionJson } from "./views.js";

/// Subscriptions: one subscription per customer, with its own deposit address (vault). Create one and share its
/// subscribe link; charge each period when due; refund, withdraw, or cancel.

export type SubscriptionJson = ReturnType<typeof subscriptionJson>;

/// The subscription, only if it belongs to the key's merchant.
export async function readSubscription(m: Merchant, id: string): Promise<{ view: SubscriptionView; record?: SubscriptionRecord }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) throw new ApiError(400, "INVALID_SUBSCRIPTION_ID", "A subscription id is 0x followed by 64 hex characters");
  let view: SubscriptionView;
  try {
    view = await m.kit.relayer.subscriptions.get(id as Hex);
  } catch (error) {
    if (error instanceof SwordError) throw new ApiError(404, "NOT_FOUND", "No subscription with that id for this merchant");
    throw error;
  }
  if (view.merchant.toLowerCase() !== m.address.toLowerCase()) throw new ApiError(404, "NOT_FOUND", "No subscription with that id for this merchant");
  return { view, record: await subscriptionRecord(m.chainId, m.address, id) };
}

export async function getSubscription(m: Merchant, id: string): Promise<SubscriptionJson> {
  const { view, record } = await readSubscription(m, id);
  return subscriptionJson(m.chainId, view, record);
}

export async function listSubscriptions(m: Merchant, limit: number, before?: Date): Promise<{ data: SubscriptionJson[]; hasMore: boolean }> {
  const records = await subscriptionRecords(m.chainId, m.address, limit + 1, before);
  const page = records.slice(0, limit);
  const data = await Promise.all(page.map(async (r) => subscriptionJson(m.chainId, await m.kit.relayer.subscriptions.get(r.id as Hex), r)));
  return { data, hasMore: records.length > limit };
}

async function afterAction(m: Merchant, id: string, txHash: Hex) {
  return { ...(await getSubscription(m, id)), transaction: txHash };
}

// ---------------------------------------------------------------- create

type CreateInput = { name: string; reference: string; amount: string; periodSeconds: number; periods: number; description?: string };

const createCall = (m: Merchant, input: CreateInput) => (sdk: SwordSDK) => {
  const terms = { reference: input.reference, amount: input.amount, periodSeconds: input.periodSeconds, periods: input.periods };
  return m.isEoa ? sdk.subscriptions.create({ merchant: m.address, relayer: m.kit.relayer.address, ...terms }) : sdk.accounts.merchant.createSubscription({ account: m.address, ...terms });
};

export const createSubscription = defineAction<CreateInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.create",
  hosted: async (m, sdk, input) => (await createCall(m, input)(sdk)).transaction.hash,
  steps: async (m, input) => single("create", createCall(m, input)),
  finalize: async (m, input, txHash) => {
    const id = subscriptionIdOf(m.address, input.reference).toLowerCase() as Hex;
    const view = await m.kit.relayer.subscriptions.get(id);
    await record({
      userId: m.userId,
      type: "subscription.created",
      details: { chainId: m.chainId, subscriptionId: id, name: input.name, amount: formatUsdt(view.amount) },
      txHash,
      subscription: {
        id,
        chainId: m.chainId,
        merchantAddress: m.address,
        reference: input.reference.trim(),
        name: input.name,
        description: input.description ?? null,
        amount: formatUsdt(view.amount),
        periodSeconds: input.periodSeconds,
        periods: input.periods,
        vault: view.vault,
      },
    });
    const created: SubscriptionRecord = { id, merchant: m.address, reference: input.reference.trim(), name: input.name, description: input.description ?? null, periodSeconds: input.periodSeconds, createdAt: new Date() };
    return { ...subscriptionJson(m.chainId, view, created), transaction: txHash };
  },
});

// ---------------------------------------------------------------- charge, cancel, withdraw

type IdInput = { id: string };

/// Collects the next period when it is due. Only the subscription's own merchant or relayer can.
export const chargeSubscription = defineAction<IdInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.charge",
  hosted: async (_m, sdk, input) => (await sdk.subscriptions.charge(input.id as Hex)).hash,
  steps: async (_m, input) => single("charge", (sdk) => sdk.subscriptions.charge(input.id as Hex)),
  finalize: async (m, input, txHash) => {
    const { view, record: row } = await readSubscription(m, input.id);
    await record({
      userId: m.userId,
      type: "subscription.charged",
      details: { chainId: m.chainId, subscriptionId: input.id, name: row?.name, period: view.paidPeriods, periods: view.periods, amount: formatUsdt(view.amount), subscriber: view.subscriber },
      txHash,
    });
    return { ...subscriptionJson(m.chainId, view, row), transaction: txHash };
  },
});

/// Throws unless a period is due now, by the chain's clock, so a charge that would fail costs nothing.
export async function assertDue(m: Merchant, view: SubscriptionView): Promise<void> {
  if (view.status !== "active" || view.nextChargeAt === undefined) throw new ApiError(409, "NOT_CHARGEABLE", "This subscription has nothing more to charge");
  const now = (await m.kit.publicClient.getBlock({ blockTag: "latest" })).timestamp;
  if (view.nextChargeAt > now) throw new ApiError(409, "NOT_DUE", `The next payment is due at ${new Date(Number(view.nextChargeAt) * 1000).toISOString()}`, { nextChargeAt: new Date(Number(view.nextChargeAt) * 1000).toISOString() });
}

const cancelCall = (m: Merchant, input: IdInput) => (sdk: SwordSDK) =>
  m.isEoa || sdk.mode === "relayer" ? sdk.subscriptions.cancel(input.id as Hex) : sdk.accounts.merchant.cancelSubscription({ account: m.address, id: input.id as Hex });

export const cancelSubscription = defineAction<IdInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.cancel",
  hosted: async (m, sdk, input) => (await cancelCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("cancel", cancelCall(m, input)),
  finalize: async (m, input, txHash) => {
    const { record: row } = await readSubscription(m, input.id);
    await record({ userId: m.userId, type: "subscription.cancelled", details: { chainId: m.chainId, subscriptionId: input.id, name: row?.name }, txHash });
    return afterAction(m, input.id, txHash);
  },
});

type WithdrawInput = { id: string; held: string };

const withdrawCall = (m: Merchant, input: IdInput) => (sdk: SwordSDK) =>
  m.isEoa || sdk.mode === "relayer" ? sdk.subscriptions.withdraw(input.id as Hex) : sdk.accounts.merchant.withdrawSubscription({ account: m.address, id: input.id as Hex });

/// Moves what the subscription's vault holds to the merchant.
export const withdrawSubscription = defineAction<WithdrawInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.withdraw",
  hosted: async (m, sdk, input) => (await withdrawCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("withdraw", withdrawCall(m, input)),
  finalize: async (m, input, txHash) => {
    const { record: row } = await readSubscription(m, input.id);
    await record({ userId: m.userId, type: "subscription.withdrawn", details: { chainId: m.chainId, subscriptionId: input.id, name: row?.name, amount: input.held }, txHash });
    return afterAction(m, input.id, txHash);
  },
});

// ---------------------------------------------------------------- refunds

type RefundInput = { id: string; amount: string; note?: string };

const refundCall = (m: Merchant, input: RefundInput) => (sdk: SwordSDK) =>
  m.isEoa
    ? sdk.subscriptions.refund({ id: input.id as Hex, amount: input.amount, note: input.note })
    : sdk.accounts.merchant.refundSubscription({ account: m.address, id: input.id as Hex, amount: input.amount, note: input.note });

/// Refunds any amount up to what the customer paid less refunds. Paid from the vault first, the rest from the merchant.
/// A self-signing wallet first approves the spender for that rest, when its allowance is short.
export const refundSubscription = defineAction<RefundInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.refund",
  hosted: async (m, sdk, input) => {
    if (m.isEoa) {
      const view = await m.kit.relayer.subscriptions.get(input.id as Hex);
      const amount = parseUsdt(input.amount);
      await assertWalletAllowance(m, amount > view.held ? amount - view.held : 0n);
    }
    return (await refundCall(m, input)(sdk)).hash;
  },
  steps: async (m, input) => {
    const refund: Step = { name: "refund", build: refundCall(m, input) };
    if (!m.isEoa) return [refund];
    const view = await m.kit.relayer.subscriptions.get(input.id as Hex);
    const amount = parseUsdt(input.amount);
    const rest = amount > view.held ? amount - view.held : 0n;
    if (rest === 0n) return [refund];
    const allowance = await walletAllowance(m);
    // The SDK's refund sends the approval first when it is short, so the same call prepares the approval step.
    return allowance < rest ? [{ name: "approve", build: refundCall(m, input) }, refund] : [refund];
  },
  finalize: async (m, input, txHash) => {
    const { record: row } = await readSubscription(m, input.id);
    await record({ userId: m.userId, type: "subscription.refunded", details: { chainId: m.chainId, subscriptionId: input.id, name: row?.name, amount: input.amount }, txHash });
    return afterAction(m, input.id, txHash);
  },
});

type DenyInput = { id: string; note?: string };

const denyCall = (m: Merchant, input: DenyInput) => (sdk: SwordSDK) =>
  m.isEoa ? sdk.subscriptions.deny({ id: input.id as Hex, note: input.note }) : sdk.accounts.merchant.denySubscriptionRefund({ account: m.address, id: input.id as Hex, note: input.note });

export const denySubscriptionRefund = defineAction<DenyInput, SubscriptionJson & { transaction: Hex }>({
  kind: "subscription.refund.deny",
  hosted: async (m, sdk, input) => (await denyCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("deny", denyCall(m, input)),
  finalize: async (m, input, txHash) => {
    const { record: row } = await readSubscription(m, input.id);
    await record({ userId: m.userId, type: "subscription.refund_denied", details: { chainId: m.chainId, subscriptionId: input.id, name: row?.name }, txHash });
    return afterAction(m, input.id, txHash);
  },
});
