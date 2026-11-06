import type { MiddlewareHandler } from "hono";

import { config } from "../config.js";
import { ApiError } from "../errors.js";
import type { AppEnv } from "../types.js";

/// Per-key limits over a one-minute window: one for all calls, a lower one for calls that send transactions (POST),
/// because the relayer pays their gas. Kept in memory: enough for one server; a shared store is needed for several.
const windows = new Map<string, { start: number; all: number; writes: number }>();
const WINDOW_MS = 60_000;

export const rateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const keyId = c.get("merchant").keyId;
  const now = Date.now();
  let w = windows.get(keyId);
  if (!w || now - w.start >= WINDOW_MS) {
    w = { start: now, all: 0, writes: 0 };
    windows.set(keyId, w);
  }
  const write = c.req.method === "POST";
  const limit = write ? config.rateLimit.writesPerMinute : config.rateLimit.perMinute;
  const used = write ? w.writes : w.all;
  const retryAfter = Math.ceil((w.start + WINDOW_MS - now) / 1000);

  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, limit - used - 1)));
  if (used >= limit) {
    c.header("Retry-After", String(retryAfter));
    throw new ApiError(429, "RATE_LIMITED", `Too many ${write ? "write " : ""}calls. Try again in ${retryAfter} seconds.`, { retryAfter });
  }
  w.all += 1;
  if (write) w.writes += 1;
  await next();
};

// Old windows are dropped now and then, so the map does not grow forever.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [id, w] of windows) if (w.start < cutoff) windows.delete(id);
}, WINDOW_MS).unref();
