import { db } from "../db.js";

export type OrderRecord = { orderId: string; reference: string; amount: string; collector: string | null; createdAt: Date };

type Row = { order_id: string; reference: string; amount: string; collector: string | null; created_at: Date };
const toRecord = (r: Row): OrderRecord => ({ orderId: r.order_id, reference: r.reference, amount: r.amount, collector: r.collector, createdAt: r.created_at });

/// The website's copy of one of the merchant's orders. Only orders made through Sword are known here.
export async function orderRecord(chainId: number, merchant: string, orderId: string): Promise<OrderRecord | undefined> {
  const { rows } = await db.query<Row>(
    "SELECT order_id, reference, amount, collector, created_at FROM orders WHERE chain_id = $1 AND lower(merchant_address) = lower($2) AND lower(order_id) = lower($3)",
    [chainId, merchant, orderId],
  );
  return rows[0] && toRecord(rows[0]);
}

/// The merchant's orders, newest first, before an optional time (for paging).
export async function orderRecords(chainId: number, merchant: string, limit: number, before?: Date): Promise<OrderRecord[]> {
  const { rows } = await db.query<Row>(
    `SELECT order_id, reference, amount, collector, created_at FROM orders
     WHERE chain_id = $1 AND lower(merchant_address) = lower($2) AND ($4::timestamptz IS NULL OR created_at < $4)
     ORDER BY created_at DESC LIMIT $3`,
    [chainId, merchant, limit, before ?? null],
  );
  return rows.map(toRecord);
}
