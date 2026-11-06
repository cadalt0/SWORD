"use client";

import { useCallback, useRef } from "react";

import { checkoutOrigin, type CheckoutParams, type CheckoutResult } from "../shared/checkout";

export type { CheckoutParams, CheckoutResult } from "../shared/checkout";
export { checkoutOrigin } from "../shared/checkout";

/// Checkout mode. When the sword-checkout widget opens /pay or /subscribe, it adds `origin` (the site that opened it)
/// and, for a full-page redirect, `return` (where to send the customer afterwards). The page tells that site the result,
/// but only when the merchant approved the origin (the server answers `originAllowed`).
///
/// Messages are `{ source: "sword-checkout", version: 1, type, ... }`, posted to the opener with the origin as target,
/// so no other site can read them. Keep in sync with checkout/src/protocol.ts.

/// How long the success screen shows before the popup closes or the page goes back to the store.
const HAND_BACK_MS = 2500;

/// Returns a function that hands the result back to the store once: to the opener (popup), or by redirect.
export function useCheckoutHandBack(params: CheckoutParams | undefined, allowed: boolean | undefined) {
  const sent = useRef(false);
  return useCallback(
    (result: CheckoutResult) => {
      if (!params || !allowed || sent.current) return;
      const origin = checkoutOrigin(params);
      if (!origin) return;
      sent.current = true;
      const message = { source: "sword-checkout", version: 1, ...result };

      if (window.opener && params.origin) {
        window.opener.postMessage(message, params.origin);
        window.setTimeout(() => window.close(), HAND_BACK_MS);
        return;
      }
      if (params.returnUrl) {
        let target: URL;
        try {
          target = new URL(params.returnUrl);
        } catch {
          return;
        }
        if (target.origin !== origin) return;
        target.searchParams.set("sword_status", result.type);
        if (result.type === "paid") target.searchParams.set("sword_order", result.orderId);
        else target.searchParams.set("sword_subscription", result.subscriptionId);
        if (result.txHash) target.searchParams.set("sword_tx", result.txHash);
        window.setTimeout(() => window.location.assign(target.toString()), HAND_BACK_MS);
      }
    },
    [params, allowed],
  );
}
