import "server-only";

import { db } from "./db";

/// Payments in local money and cash-outs to a bank account.

export type FiatPaymentRow = {
  kind: "order" | "subscription";
  chain_id: number;
  merchant_address: string;
  target_id: string;
  amount: string;
  currency: string;
  fiat_amount: string;
  rate: string;
  country: string | null;
  payer_reference: string;
  created_at: Date;
};

export type FiatPayoutRow = {
  id: string;
  chain_id: number;
  amount: string;
  currency: string;
  fiat_amount: string;
  rate: string;
  country: string;
  holder_name: string;
  bank_name: string | null;
  account_last4: string;
  reference: string;
  status: string;
  created_at: Date;
};

const COLUMNS = "kind, chain_id, merchant_address, target_id, amount, currency, fiat_amount, rate, country, payer_reference, created_at";

/// Saves a payment. Returns false when this order or subscription was already paid this way.
export async function saveFiatPayment(input: {
  kind: "order" | "subscription";
  chainId: number;
  merchantAddress: string;
  targetId: string;
  amount: string;
  currency: string;
  fiatAmount: number;
  rate: number;
  country?: string;
  payerReference: string;
  userId?: string | null;
}): Promise<boolean> {
  const { rowCount } = await db().query(
    `INSERT INTO fiat_payments (kind, chain_id, merchant_address, target_id, amount, currency, fiat_amount, rate, country, payer_reference, user_id)
     VALUES ($1, $2, lower($3), lower($4), $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (kind, chain_id, merchant_address, target_id) DO NOTHING`,
    [input.kind, input.chainId, input.merchantAddress, input.targetId, input.amount, input.currency, input.fiatAmount.toFixed(2), input.rate, input.country ?? null, input.payerReference, input.userId ?? null],
  );
  return (rowCount ?? 0) > 0;
}

export async function fiatPaymentFor(kind: "order" | "subscription", chainId: number, merchantAddress: string, targetId: string): Promise<FiatPaymentRow | undefined> {
  const { rows } = await db().query<FiatPaymentRow>(
    `SELECT ${COLUMNS} FROM fiat_payments WHERE kind = $1 AND chain_id = $2 AND merchant_address = lower($3) AND target_id = lower($4)`,
    [kind, chainId, merchantAddress, targetId],
  );
  return rows[0];
}

/// A merchant's local-money payments of one kind, by order or subscription id (lowercase).
export async function fiatPaymentsOf(kind: "order" | "subscription", chainId: number, merchantAddress: string): Promise<Map<string, FiatPaymentRow>> {
  const { rows } = await db().query<FiatPaymentRow>(`SELECT ${COLUMNS} FROM fiat_payments WHERE kind = $1 AND chain_id = $2 AND merchant_address = lower($3)`, [kind, chainId, merchantAddress]);
  return new Map(rows.map((r) => [r.target_id, r]));
}

/// The payment for a subscription, by its id alone (a subscription id is unique).
export async function fiatSubscriptionPayment(id: string): Promise<FiatPaymentRow | undefined> {
  const { rows } = await db().query<FiatPaymentRow>(`SELECT ${COLUMNS} FROM fiat_payments WHERE kind = 'subscription' AND target_id = lower($1)`, [id]);
  return rows[0];
}

/// How a payment in local money is shown with the order or subscription it paid.
export function paidWithOf(row: FiatPaymentRow | undefined) {
  if (!row) return undefined;
  return { currency: row.currency, fiatAmount: row.fiat_amount, rate: row.rate, country: row.country, reference: row.payer_reference, at: row.created_at.toISOString() };
}

export async function saveFiatPayout(input: {
  userId: string;
  chainId: number;
  accountAddress: string;
  amount: string;
  currency: string;
  fiatAmount: number;
  rate: number;
  country: string;
  holderName: string;
  bankName?: string;
  accountLast4: string;
  reference: string;
}): Promise<FiatPayoutRow> {
  const { rows } = await db().query<FiatPayoutRow>(
    `INSERT INTO fiat_payouts (user_id, chain_id, account_address, amount, currency, fiat_amount, rate, country, holder_name, bank_name, account_last4, reference)
     VALUES ($1, $2, lower($3), $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, chain_id, amount, currency, fiat_amount, rate, country, holder_name, bank_name, account_last4, reference, status, created_at`,
    [input.userId, input.chainId, input.accountAddress, input.amount, input.currency, input.fiatAmount.toFixed(2), input.rate, input.country, input.holderName, input.bankName ?? null, input.accountLast4, input.reference],
  );
  return rows[0];
}

export async function fiatPayoutsOf(userId: string, chainId: number, limit = 50): Promise<FiatPayoutRow[]> {
  const { rows } = await db().query<FiatPayoutRow>(
    `SELECT id, chain_id, amount, currency, fiat_amount, rate, country, holder_name, bank_name, account_last4, reference, status, created_at
     FROM fiat_payouts WHERE user_id = $1 AND chain_id = $2 ORDER BY created_at DESC LIMIT $3`,
    [userId, chainId, limit],
  );
  return rows;
}

/// Everything already cashed out from an account, in the stablecoin.
export async function cashedOut(accountAddress: string, chainId: number): Promise<number> {
  const { rows } = await db().query<{ total: string | null }>("SELECT sum(amount) AS total FROM fiat_payouts WHERE account_address = lower($1) AND chain_id = $2", [accountAddress, chainId]);
  return Number(rows[0]?.total ?? 0);
}

/// A short reference people can quote, like SW-7K3QX9.
export function fiatReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of crypto.getRandomValues(new Uint8Array(6))) s += chars[b % chars.length];
  return `SW-${s}`;
}
