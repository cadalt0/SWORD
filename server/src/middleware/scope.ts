import type { MiddlewareHandler } from "hono";

import { ApiError } from "../errors.js";
import type { Scope } from "../auth/scopes.js";
import type { AppEnv } from "../types.js";

/// Refuses the call unless the key holds the scope. Scopes are chosen when the key is created on the Developers page.
export const requireScope =
  (scope: Scope): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!c.get("merchant").scopes.includes(scope)) {
      throw new ApiError(403, "MISSING_SCOPE", `This key may not do that. It needs the "${scope}" scope; create a key with it on the Developers page.`, { scope });
    }
    await next();
  };
