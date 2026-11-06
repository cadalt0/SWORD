# Sword SDK

TypeScript SDK for the Sword contracts on Whitechain (chain 1874). It covers merchant registration, the merchant's permission, orders, refunds, subscriptions, and smart accounts. A subscription works like an order: the merchant creates it, it has its own deposit address, and exactly one customer takes it (`subscriptions.create`, `subscriptions.subscribe`, `subscriptions.refund`, `subscriptions.withdraw`). Customers act through their smart account, either directly as owner or through the relayer under a grant.

The API and the widget are built on top of this SDK.

## Install and build

```sh
npm install
npm run typecheck
npm run build        # writes dist/
```

Node 22.10 or later is required.

## Two modes

Each SDK instance is created in one mode. Create one instance per mode.

**Merchant mode.** The merchant's own wallet sends every action. The UI passes in the wallet client. The SDK builds each action; the wallet confirms it.

**Relayer mode.** The relayer key is read from the environment on the backend. The relayer sends actions only within the permission the merchant has granted. The merchant doesn't sign each action.

| | Merchant mode | Relayer mode |
|---|---|---|
| Register merchant, sign, revoke permission | Yes | No |
| Approve spender for refunds from the merchant wallet | Yes | No |
| Record a manual refund | Yes | No |
| Create orders, confirm transfers, fail orders, set refund window | Yes | Yes, within permission |
| Approve or deny refunds, refund from balance or extra funds | Yes | Yes, within permission |
| Pay refunds from the merchant wallet | Yes | Yes, with permission and the merchant's approval |
| Create subscriptions, charge due periods, withdraw, cancel, refund any amount | Yes | Yes (create and refund within permission) |
| Expire, refund failed order, withdraw, close | Yes | Yes, no permission needed |
| Submit a signed permission | Yes | Yes |

## Chains

The SDK starts on Whitechain testnet (chain 1874), unless the UI chooses another chain at creation.

- The UI can change the chain at any time with the chain setting. Every action after that goes to the new chain, using its contract addresses and RPC endpoint.
- Each chain's addresses and RPC variable are kept in `src/config/chains.ts`. Chains without an entry are rejected with `UNSUPPORTED_CHAIN`.
- To add a chain, deploy the contracts there and add one entry. Nothing else changes.
- Permissions are signed per chain. A permission signed for one chain is not valid on another.
- In merchant mode the merchant's wallet must also be on the chosen chain. Every action checks this first and fails with `WRONG_NETWORK` otherwise. The UI asks the wallet to switch network.
- In relayer mode the relayer wallet is rebuilt for the new chain. The relayer needs gas on every chain it works on.

## Creating an instance

- Merchant mode takes a wallet client, and optionally a chain and an RPC URL.
- Relayer mode reads `RELAYER_PRIVATE_KEY` from the environment. The RPC comes from the chain's variable (`WHITECHAIN_RPC_URL` for Whitechain) unless one is given. The key is never passed in code and is never logged.

## Permission

The permission is the merchant's one-time signature on the relayer's limits. It sets:

- the relayer address,
- how many days it lasts (at most 31),
- the maximum orders and actions,
- the maximum value (at most 1,000 USDT).

The flow:

1. Prepare the permission. The UI shows the values to the merchant. Either mode can prepare it.
2. Sign it. Merchant mode only, with the merchant's wallet.
3. Submit it. Either mode.

Check the permission at any time. It reports the state, the days left, and whether renewal is due (5 days or fewer left, or no active permission). In relayer mode, any action the permission covers checks it first and fails with `PERMISSION_REQUIRED` if it is missing, expired, or names another relayer.

## Smart accounts

Customers and merchants can each hold a smart account. One factory creates both kinds. Each kind has its own blueprint, so each account is a lightweight copy.

Two ways to run an account:

- **Custodial.** The owner is the relayer's key. The relayer has full control. The customer or merchant signs nothing per action.
- **Self-custody.** The owner is the customer's or merchant's own key. The owner signs one grant for the relayer, with an amount limit and an expiry. The relayer then acts within it.

Shared actions (both kinds, under `accounts`):

- Create an account for an identity (relayer mode only). Each identity gets at most one account of each kind. The address can be predicted before creation.
- Read the account's status: owner, relayer, frozen, balance, grant, and usage.
- Prepare, sign, and submit the owner's grant, and revoke it (owner only).
- Send USDT (owner, or the relayer within the grant).
- Freeze and unfreeze (owner only). While frozen, no action is taken, though funds can still arrive.
- Run an arbitrary call (owner only).

Customer actions (under `accounts.customer`):

- Pay an order.
- Take a subscription and pay its first period. The full subscription total counts against the grant.
- Cancel a subscription.
- Ask for a refund on an order or a subscription. These move no money.

Merchant actions (under `accounts.merchant`):

- Register as a merchant (owner only, once).
- Create an order, reuse a closed collector, confirm a plain transfer, fail an order, set the refund window.
- Approve or deny a refund; pay an approved refund from the order balance or from the account's wallet; record a manual refund; send extra funds.
- Create a subscription, charge a due period, withdraw what it holds, cancel it, and refund any amount at any time.

Merchant actions that move money out of the account count against the grant. Creating orders and confirming payments count nothing, so the grant does not limit the number of orders yet.

The factory is not deployed yet. Until it is, creating or predicting an account fails with `FACTORY_NOT_DEPLOYED`.

The identity is hashed before it goes on chain. Use a stable id, such as the Google account id, not an email address.

## Layout

| Folder | Contents |
|---|---|
| `src/client.ts` | `SwordSDK`, the single entry point. Picks the wallet for the mode. |
| `src/modules/` | merchant, permission, orders, refunds, subscriptions, and accounts (customer and merchant actions). |
| `src/signing/` | EIP-712 data for the permission. |
| `src/core/` | Shared plumbing: transactions, lookups, mode checks, errors, units, ids, status names. |
| `src/config/` | Chain, production addresses, limits, environment names. |
| `src/abi/` | Contract ABIs. Generated, except `erc20.ts`. |
| `scripts/sync-abis.mjs` | Copies ABIs from the Hardhat artifacts. |

## Keeping ABIs in step with the contracts

After changing any contract, run `npx hardhat compile` in the project root, then `npm run sync-abis` in this folder. Do not edit the generated files by hand, except `erc20.ts`.

## Errors

Every failure throws `SwordError` with a stable `code`. Contract errors use their name in capitals, for example `NOT_AUTHORIZED`. Checks the SDK makes before sending, such as `PERMISSION_REQUIRED`, `ACTION_NOT_ALLOWED`, or `SLOT_NOT_DUE`, cost no gas.

## Amounts and ids

- Amounts are decimal USDT strings such as `"25.50"`.
- Orders are identified by the merchant's own reference, hashed to the on-chain order id. Using the same reference twice is rejected.
