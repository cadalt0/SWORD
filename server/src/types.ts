import type { Merchant } from "./services/merchant.js";

/// What every authenticated request carries through Hono's context.
export type AppEnv = { Variables: { merchant: Merchant } };
