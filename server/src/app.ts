import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { ApiError, toErrorResponse } from "./errors.js";
import { requireKey } from "./middleware/auth.js";
import { CHAIN_IDS } from "./chain/relayer.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { merchantRoutes } from "./routes/v1/merchant.js";
import { orderRoutes } from "./routes/v1/orders.js";
import { subscriptionRoutes } from "./routes/v1/subscriptions.js";
import { transactionRoutes } from "./routes/v1/transactions.js";
import type { AppEnv } from "./types.js";

/// The API. Server-to-server only: it sends no CORS headers, so a browser page can't call it with a key.
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("*", logger());
  app.use("*", bodyLimit({ maxSize: 64 * 1024, onError: () => { throw new ApiError(413, "BODY_TOO_LARGE", "Request body is too large"); } }));

  app.get("/health", (c) => c.json({ ok: true, chains: CHAIN_IDS }));

  const v1 = new Hono<AppEnv>();
  v1.use("*", requireKey, rateLimit);
  v1.route("/merchant", merchantRoutes);
  v1.route("/orders", orderRoutes);
  v1.route("/subscriptions", subscriptionRoutes);
  v1.route("/transactions", transactionRoutes);
  app.route("/v1", v1);

  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: `No route ${c.req.method} ${c.req.path}` } }, 404));
  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error);
    return c.json(body, status);
  });
  return app;
}
