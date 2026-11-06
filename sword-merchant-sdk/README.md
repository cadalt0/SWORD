# sword-merchant

Take Sword payments from your backend. Create an order with your API key, send its checkout link to your page, and
check that it was paid. Payments are in USDT on Whitechain.

```bash
npm install sword-merchant
```

## Quickstart

```js
import { Sword } from "sword-merchant";

const sword = new Sword({ apiKey: process.env.SWORD_API_KEY });
const order = await sword.orders.create({ amount: "1.00", reference: "order-42" });
// give order.checkoutUrl to your page; the sword-checkout button opens it
```

Before you ship anything, check the order on your backend:

```js
const paid = await sword.orders.waitForPayment(order.id); // or: (await sword.orders.get(order.id)).status === "paid"
```

Get an API key on the **Developers** page of your Sword merchant dashboard. Keep it on your server.

## Options

```js
new Sword({
  apiKey,      // default: SWORD_API_KEY
  privateKey,  // only for merchants that sign their own transactions; default: SWORD_PRIVATE_KEY
  baseUrl,     // where the Sword API runs; default: SWORD_API_URL, then http://localhost:4000
  rpcUrl,      // for self-signed transactions; default: the chain's public endpoint
  timeoutMs,   // per request, default 180000 (actions wait for the chain)
});
```

With the environment variables set, `new Sword()` is enough.

## Merchant types

Every call is the same for every merchant. What differs is who signs on chain:

| Your merchant account | Who signs | What you pass |
|---|---|---|
| Custodial | Sword | `apiKey` |
| Your wallet, with a Sword permission | Sword, within your permission | `apiKey` |
| Your wallet, no permission | Your server, through this SDK | `apiKey` and `privateKey` |

For the last type, the API prepares each transaction, this SDK signs it locally and sends it, and the API checks it on
chain before it answers. Your private key never leaves your server. Your wallet needs a little WBT for gas.
`sword.merchant()` tells you which type you are (`signing`: `relayer`, `permission` or `self`).

## Orders

| Method | What it does |
|---|---|
| `orders.create({ amount, reference, refundDays? })` | Creates an order. `reference` is your own id; each one makes exactly one order. |
| `orders.get(id)` | The order, read from the chain. |
| `orders.list({ limit?, before? })` | Your orders, newest first. Page with `before: lastItem.createdAt`. |
| `orders.confirm(id)` | Marks it paid if a wallet sent the full amount to `depositAddress`. Safe to repeat. |
| `orders.waitForPayment(id, { timeoutMs?, intervalMs? })` | Resolves when paid, throws when it can no longer be paid. |
| `orders.refund(id, { amount, note? })` | Refunds without a customer request. |
| `orders.approveRefund(id, { amount })` | Approves the customer's request, then `payRefund`. |
| `orders.denyRefund(id, { note? })` | Declines the customer's request. |
| `orders.payRefund(id)` | Pays the approved refund. |
| `orders.withdraw(id)` | Moves a paid order's money to your merchant account. |

An order is open for 20 minutes. `status` is one of `pending`, `expired`, `paid`, `partially_refunded`, `refunded`,
`failed`, `closed`.

## Subscriptions

Each subscription is taken by one customer and has its own deposit address.

| Method | What it does |
|---|---|
| `subscriptions.create({ name, reference, amount, periodDays \| periodSeconds, periods, description? })` | Creates one. Give `subscribeUrl` to your page. A period is 1 to 365 days, or 10 seconds to 365 days with `periodSeconds` (short ones are for testing renewals). |
| `subscriptions.get(id)`, `subscriptions.list()` | Read them. |
| `subscriptions.charge(id)` | Collects the next period when it is due (`NOT_DUE` before). |
| `subscriptions.refund(id, { amount, note? })` | Refunds any amount up to what was paid less refunds. |
| `subscriptions.denyRefund(id, { note? })` | Declines the customer's request. |
| `subscriptions.withdraw(id)` | Moves what it holds to your account. |
| `subscriptions.cancel(id)` | Stops future charges. |

## Errors

Every failure throws `SwordApiError` with `status`, a stable `code`, a `message` and `details`.

```js
import { SwordApiError } from "sword-merchant";

try {
  await sword.orders.refund(id, { amount: "5" });
} catch (error) {
  if (error instanceof SwordApiError && error.code === "MISSING_SCOPE") {
    // create a key with the "refunds:write" scope on the Developers page
  }
}
```

| Code | Status | Meaning |
|---|---|---|
| `MISSING_API_KEY`, `INVALID_API_KEY` | 401 | No key, or it is wrong or revoked. |
| `MISSING_SCOPE` | 403 | The key may not do this. `details.scope` names the scope it needs. |
| `KEY_ACCOUNT_MISMATCH` | 403 | The key's merchant account is no longer yours. |
| `INVALID_INPUT` | 400 | `details.fields` lists what is wrong. |
| `NOT_FOUND` | 404 | Not one of your orders or subscriptions. |
| `ORDER_EXISTS` and other conflicts | 409 | Already done, or not possible now (`NOT_DUE`, `ALREADY_ENDED`). |
| `RATE_LIMITED` | 429 | Too many calls. `details.retryAfter` is in seconds. |
| `SIGNATURE_REQUIRED` | 202 | Your merchant signs its own transactions: pass `privateKey`. |
| `WRONG_PRIVATE_KEY` | 0 | The key isn't the merchant wallet's. |
| `contractError` in `details` | 400 | The contract refused the call; the name of its error. |

## Scopes

A key holds the scopes you chose when you created it: `orders:read`, `orders:write`, `subscriptions:read`,
`subscriptions:write`, and, only if you turn them on, `refunds:write` and `withdrawals:write`.
