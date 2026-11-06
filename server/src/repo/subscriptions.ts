import { db } from "../db.js";

export type SubscriptionRecord = {
  id: string;
  merchant: string;
  reference: string;
  name: string;
  description: string | null;
  periodSeconds: number;
  createdAt: Date;
};

type Row = { id: string; merchant_address: string; reference: string; name: string; description: string | null; period_seconds: number; created_at: Date };
const toRecord = (r: Row): SubscriptionRecord => ({ id: r.id, merchant: r.merchant_address, reference: r.reference, name: r.name, description: r.description, periodSeconds: r.period_seconds, createdAt: r.created_at });

/// One of the merchant's subscriptions. Another merchant's subscription is never returned.
export async function subscriptionRecord(chainId: number, merchant: string, id: string): Promise<SubscriptionRecord | undefined> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return undefined;
  const { rows } = await db.query<Row>(
    "SELECT id, merchant_address, reference, name, description, period_seconds, created_at FROM subscription_orders WHERE id = lower($1) AND chain_id = $2 AND lower(merchant_address) = lower($3)",
    [id, chainId, merchant],
  );
  return rows[0] && toRecord(rows[0]);
}

export async function subscriptionRecords(chainId: number, merchant: string, limit: number, before?: Date): Promise<SubscriptionRecord[]> {
  const { rows } = await db.query<Row>(
    `SELECT id, merchant_address, reference, name, description, period_seconds, created_at FROM subscription_orders
     WHERE chain_id = $1 AND lower(merchant_address) = lower($2) AND ($4::timestamptz IS NULL OR created_at < $4)
     ORDER BY created_at DESC LIMIT $3`,
    [chainId, merchant, limit, before ?? null],
  );
  return rows.map(toRecord);
}
