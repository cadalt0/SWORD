# Sword

**Stablecoin payments and a neo bank for people who can't easily use their money.**

Sword lets anyone collect a payment in stablecoins (USDT or USDC), and lets the person receiving it turn that money into local currency at low fees. It runs on smart contracts, so every payment, refund and subscription is recorded on chain.

- **Merchants** get payment links, QR codes, subscriptions, refunds and an API.
- **Customers** pay by stablecoin or bank transfer, see every payment, manage subscriptions and cash out.
- **Developers** get two SDKs (`sword-sdk` and `sword-merchant`) and an API server.

> Status: testnet. Payments run on test networks with test tokens. Bank transfers and cash-out record the transaction but don't move money through a bank yet. See [Status and limits](#status-and-limits).

---

## The problem

Stablecoins are already how many people get paid across borders. A freelancer in one country gets paid by a client in another, and the money arrives in stablecoins. But the money is still hard to use:

- **Local rules often block direct conversion.** In many countries it's hard or impossible to turn stablecoins into local money through a regulated route.
- **Peer-to-peer trading is risky.** Many people who trade stablecoins peer-to-peer have had their bank accounts frozen.
- **Crypto cards keep closing.** Cards that spend stablecoins are being shut down, one provider after another.
- **Cross-border money is expensive.** Banks and payment apps add heavy fees, currency markups and transfer charges, such as PayPal's fees and bank wire costs.
- **Most governments don't regulate stablecoins yet**, even though millions of people already use them every day.

The result: people who are paid in stablecoins still can't buy groceries, pay rent or pay a supplier easily.

## What Sword does

Sword is an onchain neo bank. Anyone can collect a payment in stablecoins, and the person who receives it can convert it to local currency at low fees, about 1%.

The conversion goes through a US bank partner, and the local bank never handles crypto:

1. The stablecoins are redeemed into US dollars in a virtual account at the partner bank.
2. The dollars are sent from there to the person's own bank account, in their own currency, through major banks.

So the local bank only receives regular money. It never touches crypto, which keeps the account in good standing.

> The bank partner integration is planned, not built yet. See [Status and limits](#status-and-limits).

---

## Try it

Pick the path that fits you. Each one works from a local copy (see [Run it locally](#run-it-locally)).

### As a merchant

1. Open `/app` and sign in with Google.
2. Choose a network, then create your merchant account. Your account is set up in a few steps.
3. Register your merchant. This creates your order book on chain.
4. Create an order, share its payment link or show its QR code, and watch it turn to paid.
5. Withdraw the money, refund a payment, or set up a subscription with its own deposit vault.
6. Create an API key on the **Developers** page to take payments from your own backend.

### As an individual (customer)

1. Open `/app` and sign in with Google. Then set up your customer account.
2. Pay a merchant from a payment link, a QR code, or the **Pay** page. You can pay with stablecoins from your account or a wallet, or by bank transfer in your own currency.
3. Find every payment under **Purchases** and **Activity**. Ask for a refund from there if needed.
4. Take and manage subscriptions, including cancelling at any time.
5. Use **Cash out** to send your balance to your local bank account at today's rate.

### As a developer

Install the merchant SDK and take a payment in a few lines:

```bash
npm install sword-merchant
```

```js
import { Sword } from "sword-merchant";

const sword = new Sword({ apiKey: process.env.SWORD_API_KEY });
const order = await sword.orders.create({ amount: "25.00", reference: "invoice-1042" });
// send order.checkoutUrl to the customer, then wait for payment
const paid = await sword.orders.waitForPayment(order.id);
```

For apps that work with the contracts directly, use the low-level SDK:

```bash
npm install sword-sdk
```

The **API playground** at `/playground` lets you try every API call in the browser, with code samples.

---

## How it works

### The pieces

```
  Customer / merchant browser ──► Website (Next.js)  ──► Postgres (accounts, orders, notifications)
                                        │
  Merchant backend (API key) ──► API server (Hono) ──┤
                                        │            │
                                        ▼            ▼
                              Relayer wallet    Smart contracts (on chain)
```

- **Smart contracts** hold the money and the rules: orders, refunds, subscriptions, accounts and permissions.
- **Website** is where people sign in, pay, and manage everything.
- **API server** lets merchant backends act with an API key. It checks every call, then signs with the relayer or prepares a transaction for the merchant's own wallet.
- **Relayer** is a server wallet that pays gas for custodial accounts and for wallets that signed a permission.
- **SDKs** are the libraries developers use to talk to the contracts and the API.

### The contract flow

The contracts are described in detail in [contracts/readme.md](contracts/readme.md), which lists every deployed address.

1. **MerchantRegistry** registers a merchant and gives it an order book.
2. **MerchantOrders** (the order book) records each order, its amount and its status.
3. **CollectorFactory** creates a deposit address for each order. An **OrderCollector** holds the USDT or USDC for one order at a time, then is reused for the next order after it closes.
4. **MerchantSpender** pulls payments in, and runs subscriptions and refunds.
5. **SubscriptionVault** is created for each subscription. It holds the subscription's payments until the merchant withdraws them.
6. **AccountFactory** creates a **CustomerAccount** or **MerchantAccount** from a template (blueprint). An account can be controlled by its owner, or by the relayer within a limit the owner signs.
7. **Permissions:** the owner signs a spending limit and an expiry once. The relayer can act within that limit, and the owner can revoke it at any time.

The core contracts have no admin, upgrade or pause controls over anyone's funds. The contracts are fixed once deployed. An account's owner can freeze their own account.

### Merchant workflow

```
Sign in ─► Merchant account ─► Register (order book) ─► Create order ─► Customer pays ─► Paid ─► Withdraw / Refund
                                                              │
                                                              └─► Subscription (own vault) ─► Charged each period
```

### Customer workflow

```
Sign in ─► Customer account ─► Open a payment link / QR / subscribe link ─► Pay ─► Purchases & Activity
                                                                                  │
                                                                                  └─► Refund request / Cash out
```

---

## Repository layout

| Folder | What it is |
|---|---|
| [`contracts/`](contracts) | Solidity smart contracts: core, spender, accounts, factory and interfaces. Deployed addresses are in [contracts/readme.md](contracts/readme.md). |
| [`sword-sdk/`](sword-sdk) | `sword-sdk`: TypeScript SDK for the contracts. Merchant mode (the merchant's wallet signs) and relayer mode (the relayer acts within a permission). |
| [`sword-merchant-sdk/`](sword-merchant-sdk) | `sword-merchant`: SDK for a merchant's backend. Takes payments with an API key. |
| [`server/`](server) | `sword-api`: API server (Hono on Node.js). Serves every supported network. Each API key belongs to one merchant on one network. |
| [`web/`](web) | Website (Next.js 16, React, Tailwind): landing page, dashboards, payment pages, subscriptions, receipts and the API playground. |

### Smart contracts

Written in Solidity 0.8.28 with OpenZeppelin. The main files:

| File | Role |
|---|---|
| `contracts/core/MerchantRegistry.sol` | Registers merchants and their order books. |
| `contracts/core/MerchantOrders.sol` | Order book: orders, statuses, the merchant's permission (mandate). |
| `contracts/core/CollectorFactory.sol` | Creates per-order deposit addresses. |
| `contracts/core/OrderCollector.sol` | Holds one order's stablecoins; handles payment, refunds and reuse. |
| `contracts/spender/MerchantSpender.sol` | Pulls payments; runs subscriptions and refunds. |
| `contracts/spender/SubscriptionVault.sol` | Holds a subscription's payments. |
| `contracts/smart-account/` | Customer and merchant smart accounts, their base contract and the account factory. |

### Software packages

| Package | Install | For |
|---|---|---|
| `sword-merchant` | `npm install sword-merchant` | Merchant backends: orders, subscriptions, refunds, withdrawals. |
| `sword-sdk` | `npm install sword-sdk` | Apps that work with the contracts directly. |

Both packages are published on npm. The source for the newest versions is in this repository's SDK folders.

---

## Run it locally

You need Node.js 22 or later, a Postgres database (for example a free [Neon](https://neon.tech) database), and a Google OAuth client for sign-in.

### 1. Website

```bash
cd web
# create web/.env.local with the variables listed below
npm install
npm run db:migrate           # creates the tables
npm run dev                  # http://localhost:3000
```

The website needs these environment variables:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in client ID (the same value twice). |
| `SESSION_SECRET` | A long random string that signs login cookies. |
| `RELAYER_PRIVATE_KEY` | The relayer wallet's private key. Keep it secret. |
| `INTERNAL_API_SECRET` | Shared with the API server. Must match on both sides. |
| `SWORD_API_URL` | Address of the API server, used by the playground. |
| `WHITECHAIN_RPC_URL`, `NEXT_PUBLIC_WHITECHAIN_RPC_URL` | RPC endpoint for Whitechain (testnet). |
| `ARC_RPC_URL`, `NEXT_PUBLIC_ARC_RPC_URL` | RPC endpoint for Arc (testnet). |
| `TESTING_MODE` | Set to `false` on any public site. When on, `/api/auth/test-login` lets anyone sign in as any email. |

### 2. API server

```bash
cd server
cp .env.example .env         # then fill in the values
npm install
npm run dev                  # or: npm run build && npm start
```

| Variable | What it is |
|---|---|
| `PORT` | Port to listen on (default 4000). |
| `DATABASE_URL` | The same database as the website. |
| `WHITECHAIN_RPC_URL`, `ARC_RPC_URL` | RPC endpoints. Optional: each falls back to a public endpoint. |
| `RELAYER_PRIVATE_KEY` | The same relayer key as the website. |
| `PUBLIC_WEB_URL` | Where the website runs. Checkout links point here. |
| `INTERNAL_API_SECRET` | The same value as in the website. |
| `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_WRITES_PER_MINUTE` | Per API key limits. Writes cost gas, so their limit is lower. |
| `PENDING_MINUTES` | How long a prepared transaction stays valid for a merchant that signs itself. |

The API server needs the website running at `PUBLIC_WEB_URL`, because orders, subscriptions, activity and notifications are recorded through the website.

#### API routes

All routes are under `/v1`. Each API key holds scopes; a route needs its scope.

| Route | Scope |
|---|---|
| `GET /merchant` | any |
| `POST /orders` | `orders:write` |
| `GET /orders`, `GET /orders/:id` | `orders:read` |
| `POST /orders/:id/confirm` | `orders:write` |
| `POST /orders/:id/refund`, `/refund/approve`, `/refund/deny`, `/refund/pay` | `refunds:write` |
| `POST /orders/:id/withdraw` | `withdrawals:write` |
| `POST /subscriptions`, `POST /subscriptions/:id/charge`, `/cancel` | `subscriptions:write` |
| `GET /subscriptions`, `GET /subscriptions/:id` | `subscriptions:read` |
| `POST /subscriptions/:id/refund`, `/refund/deny` | `refunds:write` |
| `POST /subscriptions/:id/withdraw` | `withdrawals:write` |
| `GET /transactions/:id`, `POST /transactions/:id/submit` | the key that started it |

Errors come back as `{ "error": { "code", "message" } }`. The server sends no CORS headers, because it's meant for servers, not browsers.

---

## Testing

- `server/test/` has end-to-end tests for two networks (`multichain.mjs`) and for subscription renewals (`renewals.mjs`). They need the website and the API server running, and funded test wallets. They send small test payments only.
- Contract tests are not in this repository yet. Test helpers used by them are in `contracts/mocks/`.

---

## Status and limits

- **Testnet only.** Every network Sword runs on today is a test network with test tokens. Nothing here moves real money yet.
- **Bank transfers and cash-out record only.** A bank-transfer payment or a cash-out is recorded and shown in the app, but no money moves through a bank yet. The US bank partner integration is planned.
- **The API doesn't know about bank payments yet.** An order paid by bank transfer shows as pending in `orders.get()`. Don't rely on the API for bank-paid orders until that's fixed.
- **The hosted website is not live yet.** Run it locally for now.
- **The SDK copy in this repository is behind the npm packages.** Use the npm versions for production code.

---

## Security

- Never commit `.env` files. They are git-ignored; keep the keys and secrets in them private.
- The relayer key and the API keys are secrets. Anyone with the relayer key can act for accounts within their permissions.
- Test keys (`sk_test_`) work only on the test networks.

To report a security issue, don't open a public issue. Contact the maintainers privately.

---

## License

The smart contracts are released under the MIT license (the SPDX line in each contract file). A license for the SDKs, server and website is still to be added.
