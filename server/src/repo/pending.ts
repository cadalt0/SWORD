import { db } from "../db.js";

/// A transaction prepared for a merchant that signs its own actions. One row per action; `params.done` lists the
/// steps already signed, so a two-step action (for example approve, then pay a refund) moves through the same row.
export type PendingRecord = {
  id: string;
  keyId: string;
  kind: string;
  params: { input: Record<string, unknown>; done: string[]; step: string };
  from: string;
  to: string;
  data: string;
  value: string;
  expiresAt: Date;
  txHash: string | null;
  result: unknown;
  completedAt: Date | null;
};

type Row = {
  id: string;
  key_id: string;
  kind: string;
  params: PendingRecord["params"];
  from_address: string;
  to_address: string;
  data: string;
  value: string;
  expires_at: Date;
  tx_hash: string | null;
  result: unknown;
  completed_at: Date | null;
};

const toRecord = (r: Row): PendingRecord => ({
  id: r.id,
  keyId: r.key_id,
  kind: r.kind,
  params: r.params,
  from: r.from_address,
  to: r.to_address,
  data: r.data,
  value: r.value,
  expiresAt: r.expires_at,
  txHash: r.tx_hash,
  result: r.result,
  completedAt: r.completed_at,
});

export async function createPending(input: { keyId: string; kind: string; params: PendingRecord["params"]; from: string; to: string; data: string; value: string; minutes: number }): Promise<PendingRecord> {
  const { rows } = await db.query<Row>(
    `INSERT INTO api_pending (key_id, kind, params, from_address, to_address, data, value, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8)) RETURNING *`,
    [input.keyId, input.kind, JSON.stringify(input.params), input.from, input.to, input.data, input.value, input.minutes],
  );
  return toRecord(rows[0]!);
}

/// A pending action, only for the key that started it.
export async function pendingById(id: string, keyId: string): Promise<PendingRecord | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const { rows } = await db.query<Row>("SELECT * FROM api_pending WHERE id = $1 AND key_id = $2", [id, keyId]);
  return rows[0] && toRecord(rows[0]);
}

/// Moves a pending action to its next step, with the next transaction to sign.
export async function advancePending(id: string, input: { params: PendingRecord["params"]; to: string; data: string; value: string; minutes: number }): Promise<PendingRecord> {
  const { rows } = await db.query<Row>(
    `UPDATE api_pending SET params = $2, to_address = $3, data = $4, value = $5, tx_hash = NULL, expires_at = now() + make_interval(mins => $6)
     WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(input.params), input.to, input.data, input.value, input.minutes],
  );
  return toRecord(rows[0]!);
}

/// Claims a submitted hash for a step, so two submits of the same step can't both run.
export async function claimHash(id: string, txHash: string, data: string): Promise<boolean> {
  const { rowCount } = await db.query("UPDATE api_pending SET tx_hash = $2 WHERE id = $1 AND tx_hash IS NULL AND completed_at IS NULL AND data = $3", [id, txHash, data]);
  return (rowCount ?? 0) > 0;
}

/// Lets a failed check be tried again with another hash.
export async function releaseHash(id: string): Promise<void> {
  await db.query("UPDATE api_pending SET tx_hash = NULL WHERE id = $1 AND completed_at IS NULL", [id]);
}

export async function completePending(id: string, result: unknown): Promise<void> {
  await db.query("UPDATE api_pending SET result = $2, completed_at = now() WHERE id = $1", [id, JSON.stringify(result)]);
}
