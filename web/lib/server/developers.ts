import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "./db";
import { HttpError } from "./api";
import { testingEnabled } from "./testing";

/// API keys and integration settings for the Developers page. The API server (server/) reads the same tables.

/// Every scope a key can hold. Keep in sync with server/src/auth/scopes.ts.
export const SCOPES = ["orders:read", "orders:write", "refunds:write", "withdrawals:write", "subscriptions:read", "subscriptions:write"] as const;
export type Scope = (typeof SCOPES)[number];
/// What a new key gets unless the merchant chooses otherwise. Moving money out (refunds, withdrawals) is opt-in.
export const DEFAULT_SCOPES: Scope[] = ["orders:read", "orders:write", "subscriptions:read", "subscriptions:write"];

/// Test keys start with this. Live keys will get their own prefix, so the API shape never changes.
const KEY_PREFIX = "sk_test_";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_KEYS = 20;
const MAX_ORIGINS = 20;

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  account_address: string;
  chain_id: number;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function newKey(): string {
  const bytes = randomBytes(40);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return KEY_PREFIX + out;
}

export async function keysOf(userId: string): Promise<ApiKeyRow[]> {
  const { rows } = await db().query<ApiKeyRow>(
    "SELECT id, name, prefix, scopes, account_address, chain_id, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows;
}

/// Creates a key for the merchant's account. Returns the full key once; only its hash is stored.
export async function createKey(input: { userId: string; accountAddress: string; chainId: number; name: string; scopes: string[] }): Promise<{ key: string; row: ApiKeyRow }> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new HttpError(400, "INVALID_INPUT", "Give the key a name");
  const scopes = [...new Set(input.scopes)].filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
  if (scopes.length === 0) throw new HttpError(400, "INVALID_INPUT", "Choose at least one scope");
  const active = (await keysOf(input.userId)).filter((k) => !k.revoked_at).length;
  if (active >= MAX_KEYS) throw new HttpError(400, "TOO_MANY_KEYS", `You can have up to ${MAX_KEYS} active keys. Revoke one first.`);

  const key = newKey();
  const { rows } = await db().query<ApiKeyRow>(
    `INSERT INTO api_keys (user_id, account_address, chain_id, name, prefix, key_hash, scopes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, prefix, scopes, account_address, chain_id, created_at, last_used_at, revoked_at`,
    [input.userId, input.accountAddress, input.chainId, name, key.slice(0, KEY_PREFIX.length + 6), hashKey(key), scopes],
  );
  return { key, row: rows[0]! };
}

export async function revokeKey(userId: string, id: string): Promise<void> {
  const { rowCount } = await db().query("UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL", [id, userId]);
  if (!rowCount) throw new HttpError(404, "NOT_FOUND", "No active key with that id");
}

/// Turns what a merchant typed into an origin, such as "https://shop.example.com". Throws when it is not a web address.
export function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`);
  } catch {
    throw new HttpError(400, "INVALID_ORIGIN", `"${value}" is not a web address`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "INVALID_ORIGIN", `"${value}" must start with http or https`);
  return url.origin;
}

export async function allowedOrigins(accountAddress: string, chainId: number): Promise<string[]> {
  const { rows } = await db().query<{ allowed_origins: string[] }>(
    "SELECT allowed_origins FROM merchant_settings WHERE lower(account_address) = lower($1) AND chain_id = $2",
    [accountAddress, chainId],
  );
  return rows[0]?.allowed_origins ?? [];
}

export async function saveAllowedOrigins(accountAddress: string, chainId: number, origins: string[]): Promise<string[]> {
  const clean = [...new Set(origins.map(normalizeOrigin))];
  if (clean.length > MAX_ORIGINS) throw new HttpError(400, "TOO_MANY_ORIGINS", `Up to ${MAX_ORIGINS} domains`);
  await db().query(
    `INSERT INTO merchant_settings (account_address, chain_id, allowed_origins, updated_at) VALUES (lower($1), $2, $3, now())
     ON CONFLICT (account_address, chain_id) DO UPDATE SET allowed_origins = EXCLUDED.allowed_origins, updated_at = now()`,
    [accountAddress, chainId, clean],
  );
  return clean;
}

const isLocal = (origin: string) => {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
};

/// Whether a checkout opened from `origin` may report back to it. In testing mode, localhost is always allowed so a
/// demo works before any domain is set.
export async function checkoutOriginAllowed(accountAddress: string, chainId: number, origin: string): Promise<boolean> {
  let normalized: string;
  try {
    normalized = normalizeOrigin(origin);
  } catch {
    return false;
  }
  if (testingEnabled() && isLocal(normalized)) return true;
  return (await allowedOrigins(accountAddress, chainId)).includes(normalized);
}
