/// What a key may do. Keep in sync with web/lib/server/developers.ts.
export const SCOPES = ["orders:read", "orders:write", "refunds:write", "withdrawals:write", "subscriptions:read", "subscriptions:write"] as const;
export type Scope = (typeof SCOPES)[number];
