import "server-only";

import { db } from "./db";
import { tokenOf } from "@/lib/shared/token";

/// In-app notifications. They are made from the events the website records, so every route that records an event
/// notifies the right people without knowing about notifications.

export type Tone = "info" | "success" | "warning" | "destructive";
export type NotificationRow = { id: string; tone: Tone; title: string; body: string; link: string | null; tx_hash: string | null; read_at: Date | null; created_at: Date };

type Note = { tone: Tone; title: string; body: string; link: string; txHash?: string | null };

const money = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "";
};
const text = (v: unknown): string => (typeof v === "string" ? v : "");
/// A label with its amount, in the stablecoin of the event's chain.
const withAmount = (label: string, amount: unknown, token: string) => (money(amount) ? `${label} · ${money(amount)} ${token}` : label);

async function tell(userId: string | null | undefined, note: Note): Promise<void> {
  if (!userId) return;
  await db().query("INSERT INTO notifications (user_id, tone, title, body, link, tx_hash) VALUES ($1, $2, $3, $4, $5, $6)", [userId, note.tone, note.title, note.body, note.link, note.txHash ?? null]);
}

/// The user who owns the account at an address. A self-custody customer is also found by their wallet.
async function userAt(address: string | null | undefined, kind: "customer" | "merchant"): Promise<string | undefined> {
  if (!address) return undefined;
  const { rows } = await db().query<{ user_id: string }>(
    `SELECT user_id FROM accounts WHERE kind = $2 AND (lower(address) = lower($1) OR (custody = 'self' AND lower(owner_address) = lower($1))) LIMIT 1`,
    [address, kind],
  );
  return rows[0]?.user_id;
}

async function isCustomer(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await db().query<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  return rows[0]?.role === "customer";
}

type OrderInfo = { reference: string; amount: string; merchantUser?: string; customerUser?: string };

/// The order an event is about, with who sold it and who bought it.
async function orderInfo(chainId: unknown, orderId: string, actor: string | null, payer?: string): Promise<OrderInfo | undefined> {
  const { rows } = await db().query<{ reference: string; amount: string; merchant_address: string; payer_address: string | null }>(
    "SELECT reference, amount, merchant_address, payer_address FROM orders WHERE chain_id = $1 AND lower(order_id) = lower($2) LIMIT 1",
    [Number(chainId), orderId],
  );
  const row = rows[0];
  if (!row) return undefined;
  const merchantUser = await userAt(row.merchant_address, "merchant");
  let customerUser = (await userAt(payer ?? row.payer_address, "customer")) ?? ((await isCustomer(actor)) ? (actor ?? undefined) : undefined);
  if (!customerUser) {
    // The customer who paid or asked for a refund on this order, from what was recorded.
    const { rows: seen } = await db().query<{ user_id: string }>(
      `SELECT user_id FROM events WHERE type IN ('order.paid', 'refund.requested') AND user_id IS NOT NULL AND lower(details->>'orderId') = lower($1)
       AND user_id IS DISTINCT FROM $2 ORDER BY id DESC LIMIT 1`,
      [orderId, merchantUser ?? null],
    );
    customerUser = seen[0]?.user_id;
  }
  return { reference: row.reference, amount: row.amount, merchantUser, customerUser };
}

/// Makes the notifications an event calls for. Never throws: a failed notification must not fail the action itself.
export async function notifyFromEvent(actor: string | null, type: string, d: Record<string, unknown>, txHash?: string | null): Promise<void> {
  const token = tokenOf(Number(d.chainId) || undefined);
  try {
    if (type === "fiat.withdrawn") {
      const to = `${text(d.bank) || "your bank account"}${text(d.last4) ? ` ••${text(d.last4)}` : ""}`;
      return await tell(actor, { tone: "success", title: "Cash out sent", body: `${text(d.label)} to ${to}. Reference ${text(d.reference)}.`, link: "cashout" });
    }
    const subId = text(d.subscriptionId);
    if (subId) return await notifySubscription(actor, type, d, subId, txHash);
    const orderId = text(d.orderId);
    if (!orderId) return;
    const order = await orderInfo(d.chainId, orderId, actor, text(d.payer) || undefined);
    if (!order) return;
    const ref = order.reference;
    const t = txHash ?? null;

    if (type === "refund.requested") {
      await tell(order.merchantUser, { tone: "warning", title: "Refund requested", body: `${withAmount(ref, d.amount, token)}. A customer is waiting for your decision.`, link: "refunds", txHash: t });
    } else if (type === "refund.approved") {
      await tell(order.customerUser, { tone: "info", title: "Refund approved", body: `The merchant approved your refund for ${ref}. The money is on its way.`, link: "purchases", txHash: t });
    } else if (type === "refund.denied") {
      await tell(order.customerUser, { tone: "destructive", title: "Refund declined", body: `The merchant declined your refund request for ${ref}. You can ask again from Purchases.`, link: "purchases", txHash: t });
      await tell(order.merchantUser, { tone: "destructive", title: "You declined a refund", body: `${ref}. The customer has been told.`, link: "refunds", txHash: t });
    } else if (type === "refund.paid") {
      await tell(order.customerUser, { tone: "success", title: "Refund received", body: `${ref} was refunded to your account.`, link: "purchases", txHash: t });
      await tell(order.merchantUser, { tone: "success", title: "Refund sent", body: `${ref} was refunded to the customer.`, link: "refunds", txHash: t });
    } else if (type === "order.paid") {
      const byBank = d.via === "bank" ? " · Bank transfer" : "";
      await tell(order.merchantUser, { tone: "success", title: "Payment received", body: `${withAmount(ref, order.amount, token)}${byBank}`, link: "orders", txHash: t });
      await tell(order.customerUser, { tone: "success", title: "Payment sent", body: `${withAmount(ref, order.amount, token)}`, link: "purchases", txHash: t });
    }
  } catch {
    // Notifications are best effort.
  }
}

async function notifySubscription(actor: string | null, type: string, d: Record<string, unknown>, id: string, txHash?: string | null): Promise<void> {
  const token = tokenOf(Number(d.chainId) || undefined);
  const { rows } = await db().query<{ name: string; merchant_address: string; subscriber_address: string | null }>(
    "SELECT name, merchant_address, subscriber_address FROM subscription_orders WHERE id = lower($1)",
    [id],
  );
  const sub = rows[0];
  if (!sub) return;
  const name = sub.name || text(d.name) || "Subscription";
  const merchantUser = await userAt(sub.merchant_address, "merchant");
  const customerUser = (await userAt(sub.subscriber_address ?? text(d.subscriber), "customer")) ?? ((await isCustomer(actor)) ? (actor ?? undefined) : undefined);
  const t = txHash ?? null;

  if (type === "refund.requested") {
    await tell(merchantUser, { tone: "warning", title: "Subscription refund requested", body: `${withAmount(name, d.amount, token)}. A subscriber is waiting for your decision.`, link: "refunds", txHash: t });
  } else if (type === "subscription.refunded") {
    await tell(customerUser, { tone: "success", title: "Refund received", body: `${withAmount(name, d.amount, token)} was refunded to you.`, link: "subscriptions", txHash: t });
    await tell(merchantUser, { tone: "success", title: "Refund sent", body: `${withAmount(name, d.amount, token)} was refunded to the subscriber.`, link: "refunds", txHash: t });
  } else if (type === "subscription.refund_denied") {
    await tell(customerUser, { tone: "destructive", title: "Refund declined", body: `The merchant declined your refund request for ${name}. You can ask again from Subscriptions.`, link: "subscriptions", txHash: t });
    await tell(merchantUser, { tone: "destructive", title: "You declined a refund", body: `${name}. The subscriber has been told.`, link: "refunds", txHash: t });
  } else if (type === "subscription.started") {
    await tell(merchantUser, { tone: "success", title: "New subscriber", body: name, link: "subscriptions", txHash: t });
  } else if (type === "subscription.subscribed") {
    await tell(customerUser, { tone: "success", title: "You're subscribed", body: withAmount(name, d.amount, token), link: "subscriptions", txHash: t });
  } else if (type === "subscription.charged" && Number(d.period) > 1) {
    const of = `Payment ${Number(d.period)}${Number(d.periods) ? ` of ${Number(d.periods)}` : ""}`;
    await tell(customerUser, { tone: "info", title: "Subscription renewed", body: `${withAmount(name, d.amount, token)} · ${of}`, link: "subscriptions", txHash: t });
    await tell(merchantUser, { tone: "success", title: "Subscription payment", body: `${withAmount(name, d.amount, token)} · ${of}`, link: "subscriptions", txHash: t });
  } else if (type === "subscription.cancelled") {
    if (actor && actor === merchantUser) await tell(customerUser, { tone: "warning", title: "Subscription cancelled", body: `${name} was cancelled by the merchant.`, link: "subscriptions", txHash: t });
    else await tell(merchantUser, { tone: "info", title: "Subscriber cancelled", body: name, link: "subscriptions", txHash: t });
  }
}

/// A user's latest notifications, newest first, and how many are unread.
export async function notificationsOf(userId: string, limit = 30): Promise<{ items: NotificationRow[]; unread: number }> {
  const [list, count] = await Promise.all([
    db().query<NotificationRow>("SELECT id, tone, title, body, link, tx_hash, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT $2", [userId, limit]),
    db().query<{ n: string }>("SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [userId]),
  ]);
  return { items: list.rows, unread: Number(count.rows[0]?.n ?? 0) };
}

/// Marks some of a user's notifications read, or all of them.
export async function markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void> {
  if (ids === "all") {
    await db().query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [userId]);
    return;
  }
  const clean = ids.filter((i) => /^\d+$/.test(i));
  if (clean.length === 0) return;
  await db().query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2::bigint[])", [userId, clean]);
}
