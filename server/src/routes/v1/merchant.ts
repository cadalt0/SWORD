import { Hono } from "hono";

import type { AppEnv } from "../../types.js";

/// GET /v1/merchant: who this key acts for, how its actions are signed, and what it may do.
export const merchantRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const m = c.get("merchant");
  const { relayer } = m.kit;
  const [book, permission] = await Promise.all([
    relayer.merchant.getBook(m.address).catch(() => undefined),
    m.custody === "custodial" ? undefined : m.isEoa ? relayer.permission.status(m.address).catch(() => undefined) : undefined,
  ]);
  return c.json({
    object: "merchant",
    address: m.address,
    chainId: m.chainId,
    currency: m.kit.entry.token.symbol,
    custody: m.custody,
    signing: m.signing,
    /// The wallet that must sign when signing is "self". sword-merchant checks its private key matches.
    signer: m.signing === "self" ? m.signer : null,
    registered: !!book,
    permission: permission ? { state: permission.state, daysLeft: permission.daysLeft } : null,
    key: { prefix: m.keyPrefix, scopes: m.scopes },
  });
});
