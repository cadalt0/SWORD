import "server-only";

import { createPublicClient, http, parseAbi, parseEventLogs, type Address, type Hex } from "viem";
import { CHAINS, merchantSpenderAbi, orderCollectorAbi } from "sword-sdk";

import { HttpError } from "./api";
import { rpcUrlFor } from "./rpc";
import { merchantLabelOf, orderByCollector } from "./repo";
import { relayerSdk } from "./sdk";

/// A receipt for one transaction, built from the chain. Our database only adds friendly names.
export type Receipt = {
  /// payment, subscription_payment, order_refund, subscription_refund, or transfer.
  kind: string;
  title: string;
  /// Decimal USDT.
  amount: string;
  from: string | null;
  to: string | null;
  /// A name for the other side, when we know it.
  toLabel: string | null;
  /// What it was for: an order's reference, or a subscription's name.
  reference: string | null;
  details: { label: string; value: string }[];
  txHash: string;
  chainId: number;
  network: string;
  at: string;
};

const TRANSFER_ABI = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const toUsdt = (base: bigint) => (Number(base) / 1e6).toString();

/// Reads a transaction and turns the Sword events in it into a receipt. Only events from the Sword spender,
/// and from order addresses we know, count, so a receipt can't be faked by another contract.
export async function receiptFor(chainId: number, txHash: Hex): Promise<Receipt> {
  const entry = CHAINS[chainId];
  if (!entry) throw new HttpError(400, "UNSUPPORTED_CHAIN", "That network isn't supported");
  const client = createPublicClient({ transport: http(rpcUrlFor(chainId)) });
  const tx = await client.getTransactionReceipt({ hash: txHash }).catch(() => undefined);
  if (!tx) throw new HttpError(404, "NOT_FOUND", "We couldn't find that transaction");
  if (tx.status !== "success") throw new HttpError(404, "FAILED", "That transaction didn't go through");
  const block = await client.getBlock({ blockNumber: tx.blockNumber });
  const at = new Date(Number(block.timestamp) * 1000).toISOString();
  const network = entry.chain.name;
  const base = { txHash, chainId, network, at };
  const spender = entry.addresses.spender.toLowerCase();
  const usdt = entry.addresses.usdt.toLowerCase();

  const fromSpender = parseEventLogs({ abi: merchantSpenderAbi, logs: tx.logs.filter((l) => l.address.toLowerCase() === spender) });
  const transfers = parseEventLogs({ abi: TRANSFER_ABI, eventName: "Transfer", logs: tx.logs.filter((l) => l.address.toLowerCase() === usdt) });
  const sdk = relayerSdk(chainId);

  // A subscription period paid.
  const period = fromSpender.find((e) => e.eventName === "PeriodPaid");
  if (period && period.eventName === "PeriodPaid") {
    const view = await sdk.subscriptions.get(period.args.id);
    const label = await merchantLabelOf(view.merchant);
    const payer = transfers.find((t) => t.args.value === period.args.amount)?.args.from ?? view.subscriber ?? null;
    return {
      ...base,
      kind: "subscription_payment",
      title: "Subscription payment",
      amount: toUsdt(period.args.amount),
      from: payer,
      to: view.merchant,
      toLabel: label,
      reference: null,
      details: [
        { label: "Payment", value: `${Number(period.args.index) + 1} of ${view.periods}` },
        { label: "Covers", value: `${new Date(Number(period.args.periodStart) * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short" })} to ${new Date(Number(period.args.periodEnd) * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}` },
        { label: "Subscription", value: period.args.id },
      ],
    };
  }

  // A subscription refund.
  const subRefund = fromSpender.find((e) => e.eventName === "SubscriptionRefunded");
  if (subRefund && subRefund.eventName === "SubscriptionRefunded") {
    const view = await sdk.subscriptions.get(subRefund.args.id);
    return {
      ...base,
      kind: "subscription_refund",
      title: "Subscription refund",
      amount: toUsdt(subRefund.args.amount),
      from: view.merchant,
      to: subRefund.args.subscriber,
      toLabel: null,
      reference: null,
      details: [
        { label: "Paid by", value: await merchantLabelOf(view.merchant).then((l) => l ?? "the merchant") },
        { label: "Subscription", value: subRefund.args.id },
      ],
    };
  }

  // An order paid through the spender.
  const orderPaid = fromSpender.find((e) => e.eventName === "OrderPaid");
  if (orderPaid && orderPaid.eventName === "OrderPaid") {
    const order = await orderByCollector(orderPaid.args.collector);
    return {
      ...base,
      kind: "payment",
      title: "Payment",
      amount: toUsdt(orderPaid.args.amount),
      from: orderPaid.args.payer,
      to: order?.merchant_address ?? orderPaid.args.collector,
      toLabel: order?.merchant_label ?? null,
      reference: order?.reference ?? null,
      details: order ? [{ label: "Order", value: order.order_id }] : [],
    };
  }

  // Events from an order's own address: a payment sent as a plain transfer, or a refund paid from the order.
  for (const log of tx.logs) {
    if (log.address.toLowerCase() === spender || log.address.toLowerCase() === usdt) continue;
    const order = await orderByCollector(log.address);
    if (!order) continue;
    const events = parseEventLogs({ abi: orderCollectorAbi, logs: [log] });
    const received = events.find((e) => e.eventName === "PaymentReceived");
    if (received && received.eventName === "PaymentReceived") {
      return {
        ...base,
        kind: "payment",
        title: "Payment",
        amount: toUsdt(received.args.amount),
        from: received.args.payer,
        to: order.merchant_address,
        toLabel: order.merchant_label,
        reference: order.reference,
        details: [{ label: "Order", value: order.order_id }, { label: "Sent as", value: "A wallet transfer" }],
      };
    }
    const refunded = events.find((e) => e.eventName === "RefundExecuted");
    if (refunded && refunded.eventName === "RefundExecuted") {
      return {
        ...base,
        kind: "order_refund",
        title: "Refund",
        amount: toUsdt(refunded.args.amount),
        from: order.merchant_address,
        to: refunded.args.payer,
        toLabel: null,
        reference: order.reference,
        details: [{ label: "Order", value: order.order_id }, { label: "Paid by", value: order.merchant_label ?? "the merchant" }],
      };
    }
  }

  // Any other USDT transfer.
  const t = transfers[0];
  if (t) {
    return { ...base, kind: "transfer", title: "Transfer", amount: toUsdt(t.args.value), from: t.args.from as Address, to: t.args.to as Address, toLabel: await merchantLabelOf(t.args.to), reference: null, details: [] };
  }

  throw new HttpError(404, "NO_PAYMENT", "That transaction doesn't hold a payment");
}
