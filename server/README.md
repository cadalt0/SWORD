# sword-api

The Sword API server. Merchants call it from their own backend with an API key, usually through
[`sword-merchant`](../sword-merchant-sdk). It checks every call, then signs with the relayer or prepares a transaction for the
merchant's own wallet.

## Run it

```bash
cp .env.example .env   # same database, RPC and relayer key as the website
npm install
npm run dev            # or: npm run build && npm start
```

One server serves every chain Sword is deployed on (Whitechain testnet with USDT, Arc testnet with USDC). Each API key
belongs to one merchant on one chain, so every call runs on that key's chain, with that chain's RPC, contracts and coin.
Adding a chain is one entry in `sword-sdk`; nothing here changes.

It needs the website running at `PUBLIC_WEB_URL`, with the same `INTERNAL_API_SECRET`, because orders, subscriptions,
activity and notifications are recorded through the website. Both apps share one database; run `npm run db:migrate` in
`web/` once for the API tables (`api_keys`, `merchant_settings`, `api_pending`).

## Every call

1. **Key:** `Authorization: Bearer sk_test_...`. It must exist and not be revoked (`401`).
2. **Merchant:** the merchant account the key was made for must still belong to its owner (`403 KEY_ACCOUNT_MISMATCH`).
   A key only ever reaches its own merchant's orders and subscriptions.
3. **Scope:** the route's scope must be on the key (`403 MISSING_SCOPE`).
4. **Rate limit:** per key per minute, with a lower limit for writes because the relayer pays the gas (`429`).
5. **Input:** checked before anything touches the chain (`400 INVALID_INPUT`).

## Who signs

| Merchant | `signing` | What happens |
|---|---|---|
| Custodial account | `relayer` | The relayer signs. |
| Wallet with an active permission | `permission` | The relayer signs within the permission. |
| Wallet without one | `self` | The API answers `202` with the transaction to sign. The merchant's SDK signs it, sends it, and reports the hash to `POST /v1/transactions/:id/submit`. The API checks it on chain (same sender, contract, data, and success) before it moves on or answers with the result. Two-step actions (refund: approve, then pay) repeat this. |

The SDK's own checks and simulation run before a transaction is prepared, so a call that would fail is refused before
anyone signs.

## Routes

All under `/v1`. Amounts are decimal USDT strings.

| Route | Scope |
|---|---|
| `GET /merchant` | any |
| `POST /orders` `{ amount, reference, refundDays? }` | `orders:write` |
| `GET /orders?limit&before`, `GET /orders/:id` | `orders:read` |
| `POST /orders/:id/confirm` | `orders:write` |
| `POST /orders/:id/refund` `{ amount, note? }` | `refunds:write` |
| `POST /orders/:id/refund/approve` `{ amount }`, `/refund/deny` `{ note? }`, `/refund/pay` | `refunds:write` |
| `POST /orders/:id/withdraw` | `withdrawals:write` |
| `POST /subscriptions` `{ name, reference, amount, periodDays, periods, description? }` | `subscriptions:write` |
| `GET /subscriptions`, `GET /subscriptions/:id` | `subscriptions:read` |
| `POST /subscriptions/:id/charge`, `/cancel` | `subscriptions:write` |
| `POST /subscriptions/:id/refund` `{ amount, note? }`, `/refund/deny` | `refunds:write` |
| `POST /subscriptions/:id/withdraw` | `withdrawals:write` |
| `GET /transactions/:id`, `POST /transactions/:id/submit` `{ txHash }` | the key that started it |

Errors are `{ "error": { "code", "message", ... } }`. The API sends no CORS headers: it is for servers, not browsers.

## Layout

```
src/
  index.ts, app.ts        start-up and the Hono app
  config.ts, load-env.ts  settings
  auth/                   key format and hashing, scopes
  middleware/             key check, scope check, rate limit
  routes/v1/              merchant, orders, subscriptions, transactions
  services/               the action engine, orders, subscriptions, views, records, transfers
  chain/                  relayer, transaction preparation, on-chain verification
  repo/                   database queries
test/integration.mjs      end-to-end test on testnet
```

## Test

```bash
RATE_LIMIT_PER_MINUTE=60 npm test   # with the website on :3107 and this server on :4000
```

## Limits

- Rate limits are kept in memory, which is right for one instance. Use a shared store before running several.
- Keys are test keys (`sk_test_`) for Whitechain testnet.
