import type { Hex } from "viem";
import { formatUsdt, orderIdFromReference, parseUsdt, SwordError, type OrderView, type SwordSDK } from "sword-sdk";

import { ApiError } from "../errors.js";
import { assertWalletAllowance, walletAllowance } from "./allowance.js";
import { orderRecord, orderRecords } from "../repo/orders.js";
import { defineAction, perform, single, type Step } from "./actions.js";
import type { Merchant } from "./merchant.js";
import { record } from "./records.js";
import { findTransfer } from "./transfers.js";
import { orderJson } from "./views.js";

/// Orders: create one with a checkout link, read them, confirm a wallet transfer, refund, and withdraw.
/// Each write names the SDK call twice in effect: one for a merchant smart account, one for a wallet merchant.

export type OrderJson = ReturnType<typeof orderJson>;

/// The order on chain. Only the key's own merchant's orders can be read, because the lookup goes through its book.
export async function readOrder(m: Merchant, orderId: string): Promise<OrderView> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) throw new ApiError(400, "INVALID_ORDER_ID", "An order id is 0x followed by 64 hex characters");
  try {
    return await m.kit.relayer.orders.get(m.address, orderId as Hex);
  } catch (error) {
    if (error instanceof SwordError) throw new ApiError(404, "NOT_FOUND", "No order with that id for this merchant");
    throw error;
  }
}

export async function getOrder(m: Merchant, orderId: string): Promise<OrderJson> {
  const view = await readOrder(m, orderId);
  return orderJson(m.chainId, m.address, view, await orderRecord(m.chainId, m.address, orderId));
}

/// The merchant's orders made through Sword, newest first, with each status read from the chain.
export async function listOrders(m: Merchant, limit: number, before?: Date): Promise<{ data: OrderJson[]; hasMore: boolean }> {
  const records = await orderRecords(m.chainId, m.address, limit + 1, before);
  const page = records.slice(0, limit);
  const data = await Promise.all(page.map(async (r) => orderJson(m.chainId, m.address, await m.kit.relayer.orders.get(m.address, r.orderId as Hex), r)));
  return { data, hasMore: records.length > limit };
}

/// What an action on an existing order returns: the order as it is now, and the transaction that changed it.
async function afterAction(m: Merchant, orderId: string, txHash: Hex) {
  return { ...(await getOrder(m, orderId)), transaction: txHash };
}

// ---------------------------------------------------------------- create

type CreateInput = { reference: string; amount: string; refundDays?: number };

const createCall = (m: Merchant, input: CreateInput) => (sdk: SwordSDK) =>
  m.isEoa
    ? sdk.orders.create({ merchant: m.address, reference: input.reference, amount: input.amount, refundDays: input.refundDays, relayer: m.kit.relayer.address })
    : sdk.accounts.merchant.createOrder({ account: m.address, reference: input.reference, amount: input.amount, refundDays: input.refundDays });

export const createOrder = defineAction<CreateInput, OrderJson & { transaction: Hex }>({
  kind: "order.create",
  hosted: async (m, sdk, input) => (await createCall(m, input)(sdk)).transaction.hash,
  steps: async (m, input) => single("create", createCall(m, input)),
  finalize: async (m, input, txHash) => {
    const orderId = orderIdFromReference(input.reference);
    const view = await m.kit.relayer.orders.get(m.address, orderId);
    await record({
      userId: m.userId,
      type: "order.created",
      details: { chainId: m.chainId, orderId },
      txHash,
      order: { chainId: m.chainId, merchantAddress: m.address, orderId, reference: input.reference.trim(), collector: view.collector, amount: formatUsdt(view.amount) },
    });
    return { ...orderJson(m.chainId, m.address, view, { orderId, reference: input.reference.trim(), amount: formatUsdt(view.amount), collector: view.collector, createdAt: new Date() }), transaction: txHash };
  },
});

// ---------------------------------------------------------------- confirm a wallet transfer

type ConfirmInput = { orderId: string; payer: string; transferTime: string; transferTx: string };

const confirmCall = (m: Merchant, input: ConfirmInput) => (sdk: SwordSDK) => {
  const args = { orderId: input.orderId as Hex, payer: input.payer, transferTime: BigInt(input.transferTime), txHash: input.transferTx as Hex };
  return m.isEoa ? sdk.orders.confirmTransfer({ merchant: m.address, ...args }) : sdk.accounts.merchant.confirmTransfer({ account: m.address, ...args });
};

const confirmAction = defineAction<ConfirmInput, OrderJson & { transaction: Hex }>({
  kind: "order.confirm",
  hosted: async (m, sdk, input) => (await confirmCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("confirm", confirmCall(m, input)),
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "order.paid", details: { chainId: m.chainId, orderId: input.orderId, payer: input.payer, via: "transfer" }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});

/// Checks for a plain wallet transfer to the order's deposit address and, when the full amount is there, marks the
/// order paid. Safe to call repeatedly: an order that is not paid yet, or already paid, is returned as it is.
export async function confirmOrder(m: Merchant, orderId: string) {
  const view = await readOrder(m, orderId);
  if (view.status !== "open") return { status: "completed" as const, result: await getOrder(m, orderId) };
  const found = await findTransfer(m.kit, view);
  if (found === "late") throw new ApiError(409, "PAID_TOO_LATE", "The payment arrived after the order's payment window closed. Refund it from the dashboard.");
  if (found === "pending") return { status: "completed" as const, result: await getOrder(m, orderId) };
  return perform(confirmAction, m, { orderId, payer: found.payer, transferTime: found.transferTime.toString(), transferTx: found.txHash });
}

// ---------------------------------------------------------------- refunds

type RefundInput = { orderId: string; amount: string; note?: string };

/// Refunds without a customer request: approve the amount, then pay it from the order (or, after withdrawal, from
/// the merchant through the spender). The relayer does both at once; a self-signing wallet signs two transactions.
export const refundOrder = defineAction<RefundInput, OrderJson & { transaction: Hex }>({
  kind: "order.refund",
  hosted: async (m, sdk, input) => {
    if ((await readOrder(m, input.orderId)).withdrawn) await assertWalletAllowance(m, parseUsdt(input.amount));
    const args = { orderId: input.orderId as Hex, amount: input.amount, note: input.note };
    const result = m.isEoa ? await sdk.refunds.refund({ merchant: m.address, ...args }) : await sdk.accounts.merchant.refund({ account: m.address, ...args });
    return result.payment.hash;
  },
  steps: async (m, input) => payRefundSteps(m, input.orderId, parseUsdt(input.amount), {
    name: "approve",
    build: (sdk) =>
      m.isEoa
        ? sdk.refunds.refund({ merchant: m.address, orderId: input.orderId as Hex, amount: input.amount, note: input.note })
        : sdk.accounts.merchant.refund({ account: m.address, orderId: input.orderId as Hex, amount: input.amount, note: input.note }),
  }),
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "refund.paid", details: { chainId: m.chainId, orderId: input.orderId, amount: input.amount, initiated: true }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});

/// Paying an approved refund: from the order's balance before withdrawal, from the merchant after it.
async function payStep(m: Merchant, orderId: string): Promise<Step> {
  const withdrawn = (await m.kit.relayer.orders.get(m.address, orderId as Hex)).withdrawn;
  const id = orderId as Hex;
  return {
    name: "pay",
    build: (sdk) =>
      m.isEoa
        ? withdrawn
          ? sdk.refunds.payFromMerchantWallet(m.address, id)
          : sdk.refunds.executeFromBalance(m.address, id)
        : withdrawn
          ? sdk.accounts.merchant.payRefundFromWallet({ account: m.address, orderId: id })
          : sdk.accounts.merchant.executeRefundFromBalance({ account: m.address, orderId: id }),
  };
}

/// A wallet merchant paying a refund after withdrawal needs the spender's allowance first: its own signed step.
async function allowanceSteps(m: Merchant, orderId: string, needed: bigint): Promise<Step[]> {
  if (!m.isEoa || needed === 0n || !(await m.kit.relayer.orders.get(m.address, orderId as Hex)).withdrawn) return [];
  if ((await walletAllowance(m)) >= needed) return [];
  return [{ name: "allowance", build: (sdk) => sdk.merchant.approveRefundSpender(formatUsdt(needed)) }];
}

/// The steps to pay a refund: optionally the first one (approving the amount), then the allowance if needed, then paying.
async function payRefundSteps(m: Merchant, orderId: string, needed: bigint, first?: Step): Promise<Step[]> {
  return [...(first ? [first] : []), ...(await allowanceSteps(m, orderId, needed)), await payStep(m, orderId)];
}

type ApproveInput = { orderId: string; amount: string };

const approveCall = (m: Merchant, input: ApproveInput) => (sdk: SwordSDK) =>
  m.isEoa
    ? sdk.refunds.approve({ merchant: m.address, orderId: input.orderId as Hex, amount: input.amount })
    : sdk.accounts.merchant.approveRefund({ account: m.address, orderId: input.orderId as Hex, amount: input.amount });

export const approveRefund = defineAction<ApproveInput, OrderJson & { transaction: Hex }>({
  kind: "order.refund.approve",
  hosted: async (m, sdk, input) => (await approveCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("approve", approveCall(m, input)),
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "refund.approved", details: { chainId: m.chainId, orderId: input.orderId, amount: input.amount }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});

type DenyInput = { orderId: string; note: string };

const denyCall = (m: Merchant, input: DenyInput) => (sdk: SwordSDK) =>
  m.isEoa
    ? sdk.refunds.deny({ merchant: m.address, orderId: input.orderId as Hex, note: input.note })
    : sdk.accounts.merchant.denyRefund({ account: m.address, orderId: input.orderId as Hex, note: input.note });

export const denyRefund = defineAction<DenyInput, OrderJson & { transaction: Hex }>({
  kind: "order.refund.deny",
  hosted: async (m, sdk, input) => (await denyCall(m, input)(sdk)).hash,
  steps: async (m, input) => single("deny", denyCall(m, input)),
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "refund.denied", details: { chainId: m.chainId, orderId: input.orderId }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});

type PayInput = { orderId: string };

export const payRefund = defineAction<PayInput, OrderJson & { transaction: Hex }>({
  kind: "order.refund.pay",
  hosted: async (m, sdk, input) => {
    const order = await readOrder(m, input.orderId);
    if (order.withdrawn) await assertWalletAllowance(m, order.refundApprovedAmount);
    const step = await payStep(m, input.orderId);
    return ((await step.build(sdk)) as { hash: Hex }).hash;
  },
  steps: async (m, input) => payRefundSteps(m, input.orderId, (await readOrder(m, input.orderId)).refundApprovedAmount),
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "refund.paid", details: { chainId: m.chainId, orderId: input.orderId }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});

// ---------------------------------------------------------------- withdraw

/// Moves a paid order's money to the merchant. Anyone may do this on chain, so the relayer does it for every merchant.
export const withdrawOrder = defineAction<PayInput, OrderJson & { transaction: Hex }>({
  kind: "order.withdraw",
  relayerOnly: true,
  hosted: async (m, sdk, input) => (await sdk.orders.withdraw(m.address, input.orderId as Hex)).hash,
  steps: async () => [],
  finalize: async (m, input, txHash) => {
    await record({ userId: m.userId, type: "order.withdrawn", details: { chainId: m.chainId, orderId: input.orderId }, txHash });
    return afterAction(m, input.orderId, txHash);
  },
});
