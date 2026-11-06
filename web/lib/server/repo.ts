import "server-only";

import { db } from "./db";
import { notifyFromEvent } from "./notify";

export type Role = "customer" | "merchant";
export type Custody = "custodial" | "self";
export type Signing = "relayer" | "manual" | "signless";

export type UserRow = { id: string; google_sub: string; email: string; name: string | null; role: Role };
export type AccountRow = {
  id: string;
  user_id: string;
  kind: Role;
  custody: Custody;
  signing: Signing;
  is_eoa: boolean;
  address: string;
  owner_address: string;
  chain_id: number;
};
export type OrderRow = {
  id: string;
  chain_id: number;
  merchant_address: string;
  order_id: string;
  reference: string;
  collector: string | null;
  amount: string;
  status: string;
  payer_address: string | null;
  created_at: Date;
};

/// Creates the user on first sign-in, or returns the existing user. The role is kept once it is set.
export async function upsertUser(input: {
  googleSub: string;
  email: string;
  name: string | undefined;
  role: Role;
}): Promise<UserRow> {
  const { rows } = await db().query<UserRow>(
    `INSERT INTO users (google_sub, email, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
     RETURNING id, google_sub, email, name, role`,
    [input.googleSub, input.email, input.name ?? null, input.role],
  );
  return rows[0]!;
}

export async function userById(id: string): Promise<UserRow | undefined> {
  const { rows } = await db().query<UserRow>(
    "SELECT id, google_sub, email, name, role FROM users WHERE id = $1",
    [id],
  );
  return rows[0];
}

export async function accountsOf(userId: string): Promise<AccountRow[]> {
  const { rows } = await db().query<AccountRow>(
    "SELECT id, user_id, kind, custody, signing, is_eoa, address, owner_address, chain_id FROM accounts WHERE user_id = $1",
    [userId],
  );
  return rows;
}

export async function saveAccount(input: {
  userId: string;
  kind: Role;
  custody: Custody;
  signing: Signing;
  isEoa: boolean;
  address: string;
  ownerAddress: string;
  chainId: number;
}): Promise<AccountRow> {
  const { rows } = await db().query<AccountRow>(
    `INSERT INTO accounts (user_id, kind, custody, signing, is_eoa, address, owner_address, chain_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, kind) DO UPDATE SET address = accounts.address
     RETURNING id, user_id, kind, custody, signing, is_eoa, address, owner_address, chain_id`,
    [input.userId, input.kind, input.custody, input.signing, input.isEoa, input.address, input.ownerAddress, input.chainId],
  );
  return rows[0]!;
}

export async function saveOrder(input: {
  chainId: number;
  merchantAddress: string;
  orderId: string;
  reference: string;
  collector: string;
  amount: string;
}): Promise<void> {
  await db().query(
    `INSERT INTO orders (chain_id, merchant_address, order_id, reference, collector, amount)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (chain_id, merchant_address, order_id) DO NOTHING`,
    [input.chainId, input.merchantAddress, input.orderId, input.reference, input.collector, input.amount],
  );
}

export async function ordersOf(merchantAddress: string, chainId: number): Promise<OrderRow[]> {
  const { rows } = await db().query<OrderRow>(
    `SELECT id, chain_id, merchant_address, order_id, reference, collector, amount, status, payer_address, created_at
     FROM orders WHERE merchant_address = $1 AND chain_id = $2 ORDER BY created_at DESC LIMIT 100`,
    [merchantAddress, chainId],
  );
  return rows;
}

/// The merchant account at an address on a chain, if a Sword merchant owns it. Address case is ignored.
export async function merchantAccountByAddress(chainId: number, address: string): Promise<AccountRow | undefined> {
  const { rows } = await db().query<AccountRow>(
    `SELECT id, user_id, kind, custody, signing, is_eoa, address, owner_address, chain_id FROM accounts
     WHERE kind = 'merchant' AND chain_id = $1 AND lower(address) = lower($2) LIMIT 1`,
    [chainId, address],
  );
  return rows[0];
}

export async function updateOrderStatus(input: {
  chainId: number;
  merchantAddress: string;
  orderId: string;
  status: string;
  payer: string | null;
}): Promise<void> {
  await db().query(
    `UPDATE orders SET status = $4, payer_address = $5, updated_at = now()
     WHERE chain_id = $1 AND merchant_address = $2 AND order_id = $3`,
    [input.chainId, input.merchantAddress, input.orderId, input.status, input.payer],
  );
}

export async function recordEvent(input: {
  userId: string | null;
  type: string;
  details: Record<string, unknown>;
  txHash?: string;
}): Promise<void> {
  await db().query(
    "INSERT INTO events (user_id, type, details, tx_hash) VALUES ($1, $2, $3, $4)",
    [input.userId, input.type, JSON.stringify(input.details), input.txHash ?? null],
  );
  await notifyFromEvent(input.userId, input.type, input.details, input.txHash);
}

/// Stores a permission the owner signed, so it can be used again later.
export async function savePermission(input: {
  accountAddress: string;
  chainId: number;
  terms: Record<string, string>;
  signature: string;
  txHash: string;
}): Promise<void> {
  await db().query(
    "INSERT INTO permissions (account_address, chain_id, terms, signature, tx_hash) VALUES ($1, $2, $3, $4, $5)",
    [input.accountAddress, input.chainId, JSON.stringify(input.terms), input.signature, input.txHash],
  );
}

export type ActivityRow = { type: string; details: Record<string, unknown>; tx_hash: string | null; created_at: Date };

/// The user's most recent recorded actions, newest first.
export async function recentEvents(userId: string, limit = 12): Promise<ActivityRow[]> {
  const { rows } = await db().query<ActivityRow>(
    "SELECT type, details, tx_hash, created_at FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit],
  );
  return rows;
}

/// The merchant's reference for an order, if the website created it.
export async function orderReference(chainId: number, merchantAddress: string, orderId: string): Promise<string | null> {
  const { rows } = await db().query<{ reference: string }>(
    "SELECT reference FROM orders WHERE chain_id = $1 AND merchant_address = $2 AND order_id = $3",
    [chainId, merchantAddress, orderId],
  );
  return rows[0]?.reference ?? null;
}

/// A subscription the merchant created. One customer takes it. The chain holds its status and money.
export type SubscriptionOrderRow = {
  id: string;
  chain_id: number;
  merchant_address: string;
  reference: string;
  name: string;
  description: string | null;
  amount: string;
  period_days: number;
  /// The exact length of one period. At least 10 seconds.
  period_seconds: number;
  periods: number;
  vault: string | null;
  subscriber_address: string | null;
  created_at: Date;
};

const SUB_COLUMNS = "id, chain_id, merchant_address, reference, name, description, amount, period_days, period_seconds, periods, vault, subscriber_address, created_at";

export async function saveSubscriptionOrder(input: {
  id: string;
  chainId: number;
  merchantAddress: string;
  reference: string;
  name: string;
  description: string | null;
  amount: string;
  periodSeconds: number;
  periods: number;
  vault: string | null;
}): Promise<void> {
  await db().query(
    `INSERT INTO subscription_orders (id, chain_id, merchant_address, reference, name, description, amount, period_days, period_seconds, periods, vault)
     VALUES (lower($1), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
    [input.id, input.chainId, input.merchantAddress, input.reference, input.name, input.description, input.amount, Math.max(1, Math.ceil(input.periodSeconds / 86_400)), input.periodSeconds, input.periods, input.vault],
  );
}

export async function subscriptionOrdersOf(merchantAddress: string, chainId: number): Promise<SubscriptionOrderRow[]> {
  const { rows } = await db().query<SubscriptionOrderRow>(
    `SELECT ${SUB_COLUMNS} FROM subscription_orders WHERE lower(merchant_address) = lower($1) AND chain_id = $2 ORDER BY created_at DESC`,
    [merchantAddress, chainId],
  );
  return rows;
}

export async function subscriptionOrderById(id: string): Promise<SubscriptionOrderRow | undefined> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return undefined;
  const { rows } = await db().query<SubscriptionOrderRow>(`SELECT ${SUB_COLUMNS} FROM subscription_orders WHERE id = lower($1)`, [id]);
  return rows[0];
}

export async function setSubscriber(id: string, subscriber: string): Promise<void> {
  await db().query("UPDATE subscription_orders SET subscriber_address = $2 WHERE id = lower($1) AND subscriber_address IS NULL", [id, subscriber]);
}

/// One recorded subscription event with money: a period charged, or a refund.
export type SubscriptionMoneyRow = {
  type: string;
  subscription_id: string;
  name: string | null;
  subscriber_address: string | null;
  period: number | null;
  periods: number | null;
  amount: string | null;
  tx_hash: string | null;
  created_at: Date;
};

/// Subscription payments (and, when asked, refunds) recorded for a merchant user, newest first.
export async function subscriptionMoney(userId: string, options: { subscriptionId?: string; withRefunds?: boolean } = {}): Promise<SubscriptionMoneyRow[]> {
  const types = options.withRefunds ? ["subscription.charged", "subscription.refunded"] : ["subscription.charged"];
  const { rows } = await db().query<SubscriptionMoneyRow>(
    `SELECT e.type, lower(e.details->>'subscriptionId') AS subscription_id,
            s.name, s.subscriber_address,
            (e.details->>'period')::int AS period, s.periods,
            e.details->>'amount' AS amount, e.tx_hash, e.created_at
       FROM events e
       JOIN subscription_orders s ON s.id = lower(e.details->>'subscriptionId')
      WHERE e.user_id = $1 AND e.type = ANY($2::text[])
        AND ($3::text IS NULL OR s.id = lower($3))
      ORDER BY e.created_at DESC
      LIMIT 500`,
    [userId, types, options.subscriptionId ?? null],
  );
  return rows;
}

/// Changes how a self-custody account signs: "signless" while the relayer has its permission, "manual" after the
/// owner removes it.
export async function setAccountSigning(id: string, signing: Signing): Promise<void> {
  await db().query("UPDATE accounts SET signing = $2 WHERE id = $1 AND custody = 'self'", [id, signing]);
}

/// Points a saved account at a new address (and owner), when the user's account moved to the current deployment.
export async function updateAccountAddress(id: string, address: string, owner: string): Promise<AccountRow> {
  const { rows } = await db().query<AccountRow>(
    `UPDATE accounts SET address = $2, owner_address = $3 WHERE id = $1
     RETURNING id, user_id, kind, custody, signing, is_eoa, address, owner_address, chain_id`,
    [id, address, owner],
  );
  return rows[0]!;
}

// ---------------------------------------------------------------- the customer's own view

/// A name to show for a merchant: their account name, or the start of their email.
const MERCHANT_LABEL = "COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1))";

export type CustomerSubscriptionRow = SubscriptionOrderRow & { merchant_label: string | null };

/// Subscriptions held by any of these addresses: the customer's Sword account, and for a self-custody customer
/// also their own wallet.
export async function subscriptionsHeldBy(addresses: string[]): Promise<CustomerSubscriptionRow[]> {
  const { rows } = await db().query<CustomerSubscriptionRow>(
    `SELECT s.id, s.chain_id, s.merchant_address, s.reference, s.name, s.description, s.amount, s.period_days, s.period_seconds, s.periods,
            s.vault, s.subscriber_address, s.created_at, ${MERCHANT_LABEL} AS merchant_label
       FROM subscription_orders s
       LEFT JOIN accounts a ON lower(a.address) = lower(s.merchant_address) AND a.kind = 'merchant'
       LEFT JOIN users u ON u.id = a.user_id
      WHERE lower(s.subscriber_address) = ANY($1::text[])
      ORDER BY s.created_at DESC`,
    [addresses.map((a) => a.toLowerCase())],
  );
  return rows;
}

/// One subscription, with its merchant's name.
export async function subscriptionWithMerchant(id: string): Promise<CustomerSubscriptionRow | undefined> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return undefined;
  const { rows } = await db().query<CustomerSubscriptionRow>(
    `SELECT s.id, s.chain_id, s.merchant_address, s.reference, s.name, s.description, s.amount, s.period_days, s.period_seconds, s.periods,
            s.vault, s.subscriber_address, s.created_at, ${MERCHANT_LABEL} AS merchant_label
       FROM subscription_orders s
       LEFT JOIN accounts a ON lower(a.address) = lower(s.merchant_address) AND a.kind = 'merchant'
       LEFT JOIN users u ON u.id = a.user_id
      WHERE s.id = lower($1)`,
    [id],
  );
  return rows[0];
}

/// Every payment and refund recorded on one subscription, newest first. Each carries its transaction.
export type SubscriptionHistoryRow = { type: string; period: number | null; amount: string | null; tx_hash: string | null; created_at: Date };
export async function subscriptionHistory(id: string): Promise<SubscriptionHistoryRow[]> {
  const { rows } = await db().query<SubscriptionHistoryRow>(
    `SELECT type, (details->>'period')::int AS period, details->>'amount' AS amount, tx_hash, created_at
       FROM events
      WHERE type IN ('subscription.charged', 'subscription.refunded') AND lower(details->>'subscriptionId') = lower($1)
      ORDER BY created_at DESC LIMIT 200`,
    [id],
  );
  return rows;
}

/// An order the customer paid, with who it was for. The chain says where it stands now.
export type PurchaseRow = {
  order_id: string;
  chain_id: number;
  merchant_address: string;
  merchant_label: string | null;
  reference: string;
  amount: string;
  collector: string | null;
  tx_hash: string | null;
  paid_at: Date;
};

/// Orders this customer paid. Two sources: what they paid from their account (the activity log), and orders whose
/// payer is their account or wallet (which also catches a scanned QR). Each is joined to the order for its details.
export async function purchasesOf(userId: string, addresses: string[], chainId: number): Promise<PurchaseRow[]> {
  const { rows } = await db().query<PurchaseRow>(
    `WITH paid AS (
       SELECT lower(e.details->>'orderId') AS order_id, e.tx_hash, e.created_at AS at
         FROM events e
        WHERE e.user_id = $1 AND e.type = 'order.paid' AND e.details->>'orderId' IS NOT NULL
       UNION ALL
       SELECT lower(o.order_id), NULL, o.updated_at
         FROM orders o
        WHERE lower(o.payer_address) = ANY($2::text[])
     ), best AS (
       SELECT DISTINCT ON (p.order_id) p.order_id, p.tx_hash, p.at
         FROM paid p ORDER BY p.order_id, (p.tx_hash IS NULL), p.at DESC
     )
     SELECT o.order_id, o.chain_id, o.merchant_address, ${MERCHANT_LABEL} AS merchant_label, o.reference, o.amount,
            o.collector, b.tx_hash, b.at AS paid_at
       FROM best b
       JOIN orders o ON lower(o.order_id) = b.order_id AND o.chain_id = $3
       LEFT JOIN accounts a ON lower(a.address) = lower(o.merchant_address) AND a.kind = 'merchant'
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY b.at DESC LIMIT 200`,
    [userId, addresses.map((a) => a.toLowerCase()), chainId],
  );
  return rows;
}

/// An order found by its collector address, for receipts.
export async function orderByCollector(collector: string): Promise<(PurchaseRow & { payer_address: string | null }) | undefined> {
  const { rows } = await db().query<PurchaseRow & { payer_address: string | null }>(
    `SELECT o.order_id, o.chain_id, o.merchant_address, ${MERCHANT_LABEL} AS merchant_label, o.reference, o.amount, o.collector,
            NULL::text AS tx_hash, o.updated_at AS paid_at, o.payer_address
       FROM orders o
       LEFT JOIN accounts a ON lower(a.address) = lower(o.merchant_address) AND a.kind = 'merchant'
       LEFT JOIN users u ON u.id = a.user_id
      WHERE lower(o.collector) = lower($1) LIMIT 1`,
    [collector],
  );
  return rows[0];
}

/// A name to show for a merchant address, if it belongs to a Sword merchant.
export async function merchantLabelOf(address: string): Promise<string | null> {
  const { rows } = await db().query<{ label: string | null }>(
    `SELECT ${MERCHANT_LABEL} AS label FROM accounts a JOIN users u ON u.id = a.user_id
      WHERE a.kind = 'merchant' AND lower(a.address) = lower($1) LIMIT 1`,
    [address],
  );
  return rows[0]?.label ?? null;
}
