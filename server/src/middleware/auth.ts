import type { MiddlewareHandler } from "hono";

import { ApiError } from "../errors.js";
import { hashKey, isKeyFormat } from "../auth/keys.js";
import { activeKeyByHash, merchantAccountOf, touchKey } from "../repo/keys.js";
import { merchantFor } from "../services/merchant.js";
import { CHAIN_IDS } from "../chain/relayer.js";
import type { AppEnv } from "../types.js";

/// Checks the API key on every call: the format, that it exists and is not revoked, that it is for this chain, and
/// that the merchant account it was made for still belongs to its owner. Then sets the merchant for the route.
export const requireKey: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) throw new ApiError(401, "MISSING_API_KEY", "Send your API key as: Authorization: Bearer sk_test_...");
  if (!isKeyFormat(key)) throw new ApiError(401, "INVALID_API_KEY", "That is not a Sword API key");

  const record = await activeKeyByHash(hashKey(key));
  if (!record) throw new ApiError(401, "INVALID_API_KEY", "This API key does not exist or was revoked");
  if (!CHAIN_IDS.includes(record.chainId)) throw new ApiError(403, "UNSUPPORTED_CHAIN", `This key is for chain ${record.chainId}, which this server does not serve`);

  const account = await merchantAccountOf(record);
  if (!account) throw new ApiError(403, "KEY_ACCOUNT_MISMATCH", "The merchant account this key was made for is no longer yours. Create a new key.");

  c.set("merchant", await merchantFor(record, account));
  void touchKey(record.id).catch(() => undefined);
  await next();
};
