/// Everything the API playground knows about the Sword API: one entry per sword-merchant method, with its route, its
/// inputs, the scope its key needs, example answers, and how to call it from the SDK. Keep in sync with server/src/routes.

export type FieldType = "string" | "integer";

export type Field = {
  name: string;
  in: "path" | "query" | "body";
  type: FieldType;
  required?: boolean;
  description: string;
  placeholder?: string;
  /// Filled in by default.
  example?: string;
  /// Filled in from the last order, subscription, or pending transaction the playground saw.
  from?: "order" | "subscription" | "pending";
  /// Shown as choices instead of free text.
  options?: string[];
  /// Make the default value unique on every visit, so "create" can be tried again without a clash.
  unique?: boolean;
};

export type Example = { description: string; body: unknown };

export type Endpoint = {
  id: string;
  group: "Merchant" | "Orders" | "Subscriptions" | "Transactions" | "System";
  title: string;
  /// The sword-merchant call, as a function of the form values.
  sdk: (v: Values) => string;
  /// What the SDK call returns, for the sample's variable name.
  returns: string;
  method: "GET" | "POST";
  path: string;
  scope?: string;
  /// False for routes that need no key.
  auth?: boolean;
  summary: string;
  notes?: string[];
  fields: Field[];
  responses: Partial<Record<number, Example>>;
  /// Runs in the playground as a loop of `confirm` calls, like the SDK helper.
  poll?: boolean;
};

export type Values = Record<string, string>;

// ---------------------------------------------------------------------------------------------- example answers

const ADDRESS = "0xB7ce91761Fd03CE57D0aF5A95f42351241A69617";
const ORDER_ID = "0x988b97f4c74ce8bf251de75e5791223464696d985112c4877d2c4c41b3794036";
const SUB_ID = "0x1729cf1ef180fada7ff82971ebcb4e9640d7da2d0e9932d5a829d52b3b0860f3";
const TX = "0x8de62ff749755f584a3f47688f830379ecac8aaba88c5905580629ddb5b3da79";

const order = (over: Record<string, unknown> = {}) => ({
  object: "order",
  id: ORDER_ID,
  reference: "order-42",
  merchant: ADDRESS,
  amount: "1",
  currency: "USDT",
  status: "pending",
  depositAddress: "0xd6c00DDa5B07c20153200D5462146981e1351951",
  expiresAt: "2026-11-06T10:40:00.000Z",
  payer: null,
  paidAt: null,
  paymentTransaction: null,
  withdrawn: false,
  refund: { status: "none", requested: "0", approved: "0", refunded: "0" },
  checkoutUrl: `https://sword.example/pay?chain=1874&merchant=${ADDRESS}&order=${ORDER_ID}`,
  createdAt: "2026-11-06T10:20:00.000Z",
  ...over,
});

const paidOrder = (over: Record<string, unknown> = {}) =>
  order({ status: "paid", payer: "0x94572a46988367871E1b4d128adC12Dd5baC7ad4", paidAt: "2026-11-06T10:22:13.000Z", paymentTransaction: TX, ...over });

const subscription = (over: Record<string, unknown> = {}) => ({
  object: "subscription",
  id: SUB_ID,
  reference: "pro-plan-42",
  name: "Pro plan",
  description: "Monthly Pro plan",
  merchant: ADDRESS,
  status: "active",
  amount: "9.99",
  currency: "USDT",
  periodSeconds: 2592000,
  periodDays: 30,
  periods: 12,
  paidPeriods: 1,
  subscriber: "0x94572a46988367871E1b4d128adC12Dd5baC7ad4",
  depositAddress: "0xb687125F6CDe42D226349099C1bD99235CddD443",
  collected: "9.99",
  refunded: "0",
  withdrawn: "0",
  held: "9.99",
  refundRequest: null,
  nextChargeAt: "2026-12-06T10:20:00.000Z",
  accessUntil: "2026-12-06T10:20:00.000Z",
  startedAt: "2026-11-06T10:20:00.000Z",
  cancelledAt: null,
  subscribeUrl: `https://sword.example/subscribe?id=${SUB_ID}`,
  createdAt: "2026-11-06T10:19:00.000Z",
  ...over,
});

const pending = {
  object: "pending_transaction",
  status: "signature_required",
  transaction: {
    id: "3f6f7a1e-2c55-4b8e-9d41-5a1c6c0f9b21",
    action: "order.create",
    step: "create",
    chainId: 1874,
    from: "0x954E98973A6Fcd477D6673DF3B917Aa827638DaF",
    to: "0x5c8fA0b1E4d7Ff6A2e8c4b21f0d3A9E1b6C7d8e9",
    data: "0x4f2be91f…",
    value: "0",
    expiresAt: "2026-11-06T10:35:00.000Z",
  },
};

const err = (code: string, message: string, extra: Record<string, unknown> = {}) => ({ error: { code, message, ...extra } });

const COMMON: Partial<Record<number, Example>> = {
  401: { description: "No key, or the key is wrong or revoked.", body: err("INVALID_API_KEY", "This API key does not exist or was revoked") },
  429: { description: "Too many calls for this key this minute.", body: err("RATE_LIMITED", "Too many write calls. Try again in 42 seconds.", { retryAfter: 42 }) },
};
const scoped = (scope: string): Partial<Record<number, Example>> => ({
  403: { description: `The key does not have the ${scope} scope.`, body: err("MISSING_SCOPE", `This key may not do that. It needs the "${scope}" scope; create a key with it on the Developers page.`, { scope }) },
});
const notFound: Partial<Record<number, Example>> = { 404: { description: "Not one of this merchant's.", body: err("NOT_FOUND", "No order with that id for this merchant") } };
const signature: Partial<Record<number, Example>> = {
  202: { description: "Your merchant signs its own transactions. Sign this one, then submit its hash (sword-merchant does both by itself).", body: pending },
};

// ---------------------------------------------------------------------------------------------- SDK snippets

/// A JavaScript object literal of the given values, leaving out empty ones. Integers are written as numbers.
function literal(v: Values, fields: { name: string; type?: FieldType }[]): string {
  const parts = fields
    .filter((f) => v[f.name] !== undefined && v[f.name] !== "")
    .map((f) => `${f.name}: ${f.type === "integer" ? Number(v[f.name]) : JSON.stringify(v[f.name])}`);
  return parts.length ? `{ ${parts.join(", ")} }` : "";
}
const q = (s: string | undefined, fallback: string) => JSON.stringify(s || fallback);

// ---------------------------------------------------------------------------------------------- fields

const orderId: Field = { name: "id", in: "path", type: "string", required: true, description: "The order's id, from orders.create or orders.list.", placeholder: "0x…", from: "order" };
const subId: Field = { name: "id", in: "path", type: "string", required: true, description: "The subscription's id, from subscriptions.create or subscriptions.list.", placeholder: "0x…", from: "subscription" };
const limit: Field = { name: "limit", in: "query", type: "integer", description: "How many to return, 1 to 100. Default 20.", example: "10" };
const before: Field = { name: "before", in: "query", type: "string", description: "Only items created before this time (ISO), for the next page: the last item's createdAt.", placeholder: "2026-11-06T10:20:00.000Z" };
const amount = (description: string, example = "0.001"): Field => ({ name: "amount", in: "body", type: "string", required: true, description, example });
const note: Field = { name: "note", in: "body", type: "string", description: "Your reason, stored on chain as a hash. Optional.", placeholder: "Damaged in delivery" };

// ---------------------------------------------------------------------------------------------- the catalog

export const ENDPOINTS: Endpoint[] = [
  {
    id: "merchant",
    group: "Merchant",
    title: "Get merchant",
    sdk: () => "sword.merchant()",
    returns: "merchant",
    method: "GET",
    path: "/v1/merchant",
    summary: "Who this key acts for, how its actions are signed, and the scopes it holds. A good first call to check a key.",
    notes: ["signing is relayer (Sword signs), permission (Sword signs within your permission) or self (your server signs with privateKey)."],
    fields: [],
    responses: {
      200: {
        description: "The merchant.",
        body: { object: "merchant", address: ADDRESS, chainId: 1874, custody: "custodial", signing: "relayer", signer: null, registered: true, permission: null, key: { prefix: "sk_test_6tFGsS", scopes: ["orders:read", "orders:write", "subscriptions:read", "subscriptions:write"] } },
      },
      ...COMMON,
    },
  },

  // ------------------------------------------------------------------ orders
  {
    id: "orders.create",
    group: "Orders",
    title: "Create an order",
    sdk: (v) => `sword.orders.create(${literal(v, [{ name: "amount" }, { name: "reference" }, { name: "refundDays", type: "integer" }])})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders",
    scope: "orders:write",
    summary: "Creates a one-time order and its deposit address. Give checkoutUrl to the customer, or to the sword-checkout button.",
    notes: ["An order is open for 20 minutes.", "Each reference makes exactly one order; using it again answers 409 ORDER_EXISTS."],
    fields: [
      amount("Decimal amount, up to 6 decimals, such as \"1.50\". In your chain's stablecoin: USDT on Whitechain, USDC on Arc."),
      { name: "reference", in: "body", type: "string", required: true, description: "Your own id for the order, such as an invoice or cart id. Up to 128 characters.", example: "playground", unique: true },
      { name: "refundDays", in: "body", type: "integer", description: "Days after payment the customer may ask for a refund, 1 to 365. Default 7.", placeholder: "7" },
    ],
    responses: {
      200: { description: "The new order, pending payment.", body: order({ transaction: TX }) },
      ...signature,
      400: { description: "An input is wrong; fields says which.", body: err("INVALID_INPUT", "amount: more than zero", { fields: [{ field: "amount", problem: "more than zero" }] }) },
      ...COMMON,
      ...scoped("orders:write"),
      409: { description: "That reference was used already.", body: err("ORDER_EXISTS", `An order with this reference already exists (${ORDER_ID})`) },
    },
  },
  {
    id: "orders.get",
    group: "Orders",
    title: "Get an order",
    sdk: (v) => `sword.orders.get(${q(v.id, ORDER_ID)})`,
    returns: "order",
    method: "GET",
    path: "/v1/orders/{id}",
    scope: "orders:read",
    summary: "The order, read from the chain: status, payer, refunds, and whether its money was withdrawn.",
    fields: [orderId],
    responses: { 200: { description: "The order.", body: paidOrder() }, ...COMMON, ...scoped("orders:read"), ...notFound },
  },
  {
    id: "orders.list",
    group: "Orders",
    title: "List orders",
    sdk: (v) => `sword.orders.list(${literal(v, [{ name: "limit", type: "integer" }, { name: "before" }])})`,
    returns: "page",
    method: "GET",
    path: "/v1/orders",
    scope: "orders:read",
    summary: "Your orders made through Sword, newest first, each with its status read from the chain.",
    fields: [limit, before],
    responses: { 200: { description: "One page. hasMore says whether to ask for the next with before.", body: { object: "list", data: [paidOrder(), order({ id: "0x7d…", reference: "order-41" })], hasMore: true } }, ...COMMON, ...scoped("orders:read") },
  },
  {
    id: "orders.confirm",
    group: "Orders",
    title: "Confirm a wallet transfer",
    sdk: (v) => `sword.orders.confirm(${q(v.id, ORDER_ID)})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/confirm",
    scope: "orders:write",
    summary: "Marks the order paid if a wallet sent the full amount to its depositAddress (for example by scanning the QR). Safe to call as often as you like.",
    notes: ["An order that isn't paid yet, or already is, comes back as it is."],
    fields: [orderId],
    responses: { 200: { description: "The order as it is now.", body: paidOrder() }, ...signature, ...COMMON, ...scoped("orders:write"), ...notFound, 409: { description: "The money arrived after the order closed.", body: err("PAID_TOO_LATE", "The payment arrived after the order's payment window closed. Refund it from the dashboard.") } },
  },
  {
    id: "orders.waitForPayment",
    group: "Orders",
    title: "Wait for payment",
    sdk: (v) => `sword.orders.waitForPayment(${q(v.id, ORDER_ID)})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/confirm",
    scope: "orders:write",
    poll: true,
    summary: "An SDK helper: confirms every few seconds until the order is paid, and throws if it closes first. Here it runs in the page; press Stop to end it.",
    fields: [orderId],
    responses: { 200: { description: "The paid order.", body: paidOrder() }, ...COMMON, ...notFound },
  },
  {
    id: "orders.refund",
    group: "Orders",
    title: "Refund an order",
    sdk: (v) => `sword.orders.refund(${q(v.id, ORDER_ID)}, ${literal(v, [{ name: "amount" }, { name: "note" }]) || "{ amount: \"0.0005\" }"})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/refund",
    scope: "refunds:write",
    summary: "Refunds a paid order without a request from the customer, up to what is still refundable. Before withdrawal it comes from the order; after, from you.",
    notes: ["A wallet merchant refunding after withdrawal must first allow the Sword spender to take the amount (409 MERCHANT_ALLOWANCE_TOO_LOW says how much)."],
    fields: [orderId, amount("How much to send back.", "0.0005"), note],
    responses: {
      200: { description: "The order after the refund.", body: paidOrder({ status: "partially_refunded", refund: { status: "none", requested: "0", approved: "0", refunded: "0.0005" }, transaction: TX }) },
      ...signature,
      ...COMMON,
      ...scoped("refunds:write"),
      ...notFound,
      409: { description: "Your wallet has not allowed enough for a refund paid from it.", body: err("MERCHANT_ALLOWANCE_TOO_LOW", "This refund is paid from your wallet, which has allowed 0 USDT but needs 0.0005. Approve the Sword spender for at least 0.0005 USDT from your wallet, then try again.", { needed: "0.0005", allowed: "0" }) },
    },
  },
  {
    id: "orders.approveRefund",
    group: "Orders",
    title: "Approve a refund request",
    sdk: (v) => `sword.orders.approveRefund(${q(v.id, ORDER_ID)}, ${literal(v, [{ name: "amount" }]) || "{ amount: \"0.001\" }"})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/refund/approve",
    scope: "refunds:write",
    summary: "Approves an amount on the customer's open refund request. Then pay it with payRefund.",
    fields: [orderId, amount("How much to approve, up to what is still refundable.")],
    responses: { 200: { description: "The order with the approved amount.", body: paidOrder({ refund: { status: "approved", requested: "0.001", approved: "0.001", refunded: "0" }, transaction: TX }) }, ...signature, ...COMMON, ...scoped("refunds:write"), ...notFound },
  },
  {
    id: "orders.denyRefund",
    group: "Orders",
    title: "Decline a refund request",
    sdk: (v) => `sword.orders.denyRefund(${q(v.id, ORDER_ID)}${literal(v, [{ name: "note" }]) ? `, ${literal(v, [{ name: "note" }])}` : ""})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/refund/deny",
    scope: "refunds:write",
    summary: "Declines the customer's open refund request. They are told, and may ask again.",
    fields: [orderId, note],
    responses: { 200: { description: "The order with the request declined.", body: paidOrder({ refund: { status: "denied", requested: "0.001", approved: "0", refunded: "0" }, transaction: TX }) }, ...signature, ...COMMON, ...scoped("refunds:write"), ...notFound },
  },
  {
    id: "orders.payRefund",
    group: "Orders",
    title: "Pay an approved refund",
    sdk: (v) => `sword.orders.payRefund(${q(v.id, ORDER_ID)})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/refund/pay",
    scope: "refunds:write",
    summary: "Sends the approved refund to the customer.",
    fields: [orderId],
    responses: { 200: { description: "The order after paying the refund.", body: paidOrder({ status: "refunded", refund: { status: "none", requested: "0", approved: "0", refunded: "1" }, transaction: TX }) }, ...signature, ...COMMON, ...scoped("refunds:write"), ...notFound },
  },
  {
    id: "orders.withdraw",
    group: "Orders",
    title: "Withdraw an order",
    sdk: (v) => `sword.orders.withdraw(${q(v.id, ORDER_ID)})`,
    returns: "order",
    method: "POST",
    path: "/v1/orders/{id}/withdraw",
    scope: "withdrawals:write",
    summary: "Moves a paid order's money to your merchant account. Sword pays the gas for every kind of merchant.",
    fields: [orderId],
    responses: { 200: { description: "The order, now withdrawn.", body: paidOrder({ withdrawn: true, transaction: TX }) }, ...COMMON, ...scoped("withdrawals:write"), ...notFound },
  },

  // ------------------------------------------------------------------ subscriptions
  {
    id: "subscriptions.create",
    group: "Subscriptions",
    title: "Create a subscription",
    sdk: (v) =>
      `sword.subscriptions.create(${literal(v, [{ name: "name" }, { name: "reference" }, { name: "amount" }, { name: "periodDays", type: "integer" }, { name: "periodSeconds", type: "integer" }, { name: "periods", type: "integer" }, { name: "description" }])})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions",
    scope: "subscriptions:write",
    summary: "Creates a subscription for one customer, with its own deposit address. Give subscribeUrl to the customer.",
    notes: ["Give periodDays (1 to 365) or periodSeconds (10 to 31,536,000), not both. Ten seconds is for testing renewals.", "The customer approves the whole total once and pays the first period at once; each later period is charged when due."],
    fields: [
      { name: "name", in: "body", type: "string", required: true, description: "Shown to the customer, up to 80 characters.", example: "Playground plan" },
      { name: "reference", in: "body", type: "string", required: true, description: "Your own id for it. Each reference makes one subscription.", example: "plan", unique: true },
      amount("Decimal amount per period, in your chain's stablecoin."),
      { name: "periodDays", in: "body", type: "integer", description: "Days per period, 1 to 365. Leave empty when you give periodSeconds.", placeholder: "30" },
      { name: "periodSeconds", in: "body", type: "integer", description: "Seconds per period, 10 to 31,536,000. Leave empty when you give periodDays.", example: "10" },
      { name: "periods", in: "body", type: "integer", required: true, description: "How many periods in total, 1 to 120.", example: "3" },
      { name: "description", in: "body", type: "string", description: "Optional, up to 500 characters.", placeholder: "Pro features, billed every period" },
    ],
    responses: {
      200: { description: "The new subscription, open until its customer takes it.", body: subscription({ status: "open", subscriber: null, paidPeriods: 0, collected: "0", held: "0", nextChargeAt: null, accessUntil: null, startedAt: null, transaction: TX }) },
      ...signature,
      400: { description: "An input is wrong; fields says which.", body: err("INVALID_INPUT", "periodSeconds: give periodDays or periodSeconds, not both", { fields: [{ field: "periodSeconds", problem: "give periodDays or periodSeconds, not both" }] }) },
      ...COMMON,
      ...scoped("subscriptions:write"),
    },
  },
  {
    id: "subscriptions.get",
    group: "Subscriptions",
    title: "Get a subscription",
    sdk: (v) => `sword.subscriptions.get(${q(v.id, SUB_ID)})`,
    returns: "subscription",
    method: "GET",
    path: "/v1/subscriptions/{id}",
    scope: "subscriptions:read",
    summary: "The subscription, read from the chain: who took it, how many periods are paid, what it holds, and when the next charge is due.",
    fields: [subId],
    responses: { 200: { description: "The subscription.", body: subscription() }, ...COMMON, ...scoped("subscriptions:read"), 404: { description: "Not one of this merchant's.", body: err("NOT_FOUND", "No subscription with that id for this merchant") } },
  },
  {
    id: "subscriptions.list",
    group: "Subscriptions",
    title: "List subscriptions",
    sdk: (v) => `sword.subscriptions.list(${literal(v, [{ name: "limit", type: "integer" }, { name: "before" }])})`,
    returns: "page",
    method: "GET",
    path: "/v1/subscriptions",
    scope: "subscriptions:read",
    summary: "Your subscriptions, newest first.",
    fields: [limit, before],
    responses: { 200: { description: "One page.", body: { object: "list", data: [subscription()], hasMore: false } }, ...COMMON, ...scoped("subscriptions:read") },
  },
  {
    id: "subscriptions.charge",
    group: "Subscriptions",
    title: "Charge the next period",
    sdk: (v) => `sword.subscriptions.charge(${q(v.id, SUB_ID)})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions/{id}/charge",
    scope: "subscriptions:write",
    summary: "Collects the next period from the customer once it is due, by the chain's clock.",
    fields: [subId],
    responses: {
      200: { description: "The subscription after the charge.", body: subscription({ paidPeriods: 2, collected: "19.98", held: "19.98", transaction: TX }) },
      ...signature,
      ...COMMON,
      ...scoped("subscriptions:write"),
      409: { description: "Not due yet, or nothing more to charge.", body: err("NOT_DUE", "The next payment is due at 2026-12-06T10:20:00.000Z", { nextChargeAt: "2026-12-06T10:20:00.000Z" }) },
    },
  },
  {
    id: "subscriptions.refund",
    group: "Subscriptions",
    title: "Refund a subscription",
    sdk: (v) => `sword.subscriptions.refund(${q(v.id, SUB_ID)}, ${literal(v, [{ name: "amount" }, { name: "note" }]) || "{ amount: \"0.0005\" }"})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions/{id}/refund",
    scope: "refunds:write",
    summary: "Refunds any amount up to what the customer paid less refunds. Paid from what the subscription holds first, the rest from you.",
    fields: [subId, amount("How much to send back.", "0.0005"), note],
    responses: { 200: { description: "The subscription after the refund.", body: subscription({ refunded: "0.0005", held: "9.9895", transaction: TX }) }, ...signature, ...COMMON, ...scoped("refunds:write") },
  },
  {
    id: "subscriptions.denyRefund",
    group: "Subscriptions",
    title: "Decline a subscription refund request",
    sdk: (v) => `sword.subscriptions.denyRefund(${q(v.id, SUB_ID)})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions/{id}/refund/deny",
    scope: "refunds:write",
    summary: "Declines the customer's open refund request.",
    fields: [subId, note],
    responses: { 200: { description: "The subscription with no open request.", body: subscription({ transaction: TX }) }, ...signature, ...COMMON, 409: { description: "There is no open request.", body: err("NO_REFUND_REQUEST", "There is no open refund request on this subscription") } },
  },
  {
    id: "subscriptions.withdraw",
    group: "Subscriptions",
    title: "Withdraw a subscription",
    sdk: (v) => `sword.subscriptions.withdraw(${q(v.id, SUB_ID)})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions/{id}/withdraw",
    scope: "withdrawals:write",
    summary: "Moves what the subscription holds to your merchant account.",
    fields: [subId],
    responses: { 200: { description: "The subscription, now holding nothing.", body: subscription({ held: "0", withdrawn: "9.99", transaction: TX }) }, ...signature, ...COMMON, 409: { description: "It holds nothing.", body: err("NOTHING_TO_WITHDRAW", "This subscription holds nothing right now") } },
  },
  {
    id: "subscriptions.cancel",
    group: "Subscriptions",
    title: "Cancel a subscription",
    sdk: (v) => `sword.subscriptions.cancel(${q(v.id, SUB_ID)})`,
    returns: "subscription",
    method: "POST",
    path: "/v1/subscriptions/{id}/cancel",
    scope: "subscriptions:write",
    summary: "Stops future charges. The customer keeps access until the end of the paid period.",
    fields: [subId],
    responses: { 200: { description: "The cancelled subscription.", body: subscription({ status: "cancelled", cancelledAt: "2026-11-10T08:00:00.000Z", nextChargeAt: null, transaction: TX }) }, ...signature, ...COMMON, 409: { description: "It already ended.", body: err("ALREADY_ENDED", "This subscription is already cancelled") } },
  },

  // ------------------------------------------------------------------ self-signing
  {
    id: "transactions.get",
    group: "Transactions",
    title: "Get a pending transaction",
    sdk: () => "// sword-merchant handles pending transactions by itself.",
    returns: "pending",
    method: "GET",
    path: "/v1/transactions/{id}",
    summary: "For merchants that sign their own actions: a transaction the API prepared and is waiting for. sword-merchant signs and submits these by itself.",
    fields: [{ name: "id", in: "path", type: "string", required: true, description: "The pending transaction's id, from a 202 answer.", from: "pending" }],
    responses: { 202: { description: "Still waiting to be signed.", body: pending }, ...COMMON, 410: { description: "It expired. Start the action again.", body: { object: "pending_transaction", status: "expired" } } },
  },
  {
    id: "transactions.submit",
    group: "Transactions",
    title: "Submit a signed transaction",
    sdk: () => "// sword-merchant signs with privateKey and submits by itself.",
    returns: "result",
    method: "POST",
    path: "/v1/transactions/{id}/submit",
    summary: "Report the hash of the transaction you signed. The API checks it on chain (same sender, contract and data, and that it succeeded), then answers with the next step or the result.",
    fields: [
      { name: "id", in: "path", type: "string", required: true, description: "The pending transaction's id.", from: "pending" },
      { name: "txHash", in: "body", type: "string", required: true, description: "The hash of the transaction your wallet sent.", placeholder: "0x…" },
    ],
    responses: {
      200: { description: "Done: the action's result, such as the order.", body: order({ transaction: TX }) },
      202: { description: "Signed and checked; the next step is waiting (for example the second transaction of a refund).", body: pending },
      400: { description: "That hash is not the prepared transaction.", body: err("WRONG_SENDER", "That transaction was not sent by the merchant's wallet") },
      ...COMMON,
    },
  },

  // ------------------------------------------------------------------ system
  {
    id: "health",
    group: "System",
    title: "Health",
    sdk: () => "// fetch(`${SWORD_API_URL}/health`)",
    returns: "health",
    method: "GET",
    path: "/health",
    auth: false,
    summary: "Whether the API is up, and its chain. Needs no key.",
    fields: [],
    responses: { 200: { description: "Up.", body: { ok: true, chainId: 1874 } } },
  },
];

export const GROUPS: Endpoint["group"][] = ["Merchant", "Orders", "Subscriptions", "Transactions", "System"];

/// The full path for a call, with path values filled in and query values appended.
export function pathFor(e: Endpoint, v: Values): string {
  let path = e.path;
  for (const f of e.fields.filter((x) => x.in === "path")) path = path.replace(`{${f.name}}`, encodeURIComponent(v[f.name] ?? ""));
  const query = e.fields.filter((f) => f.in === "query" && v[f.name]).map((f) => `${f.name}=${encodeURIComponent(v[f.name]!)}`);
  return query.length ? `${path}?${query.join("&")}` : path;
}

/// The JSON body for a call: body fields that have a value, integers as numbers.
export function bodyFor(e: Endpoint, v: Values): Record<string, unknown> | undefined {
  if (e.method !== "POST") return undefined;
  const out: Record<string, unknown> = {};
  for (const f of e.fields.filter((x) => x.in === "body")) {
    const value = v[f.name];
    if (value === undefined || value === "") continue;
    out[f.name] = f.type === "integer" ? Number(value) : value;
  }
  return out;
}

/// Inputs the call can't be made without.
export function missingFields(e: Endpoint, v: Values): string[] {
  return e.fields.filter((f) => f.required && !v[f.name]).map((f) => f.name);
}

export function nodeSample(e: Endpoint, v: Values): string {
  const call = e.sdk(v);
  if (call.startsWith("//")) return call;
  return [`import { Sword } from "sword-merchant";`, "", `const sword = new Sword({ apiKey: process.env.SWORD_API_KEY });`, `const ${e.returns} = await ${call};`, `console.log(${e.returns});`].join("\n");
}

export function curlSample(e: Endpoint, v: Values, base: string): string {
  const lines = [`curl --request ${e.method} \\`, `  --url '${base}${pathFor(e, v)}'${e.auth === false && e.method === "GET" ? "" : " \\"}`];
  if (e.auth !== false) lines.push(`  --header 'Authorization: Bearer $SWORD_API_KEY'${e.method === "POST" ? " \\" : ""}`);
  if (e.method === "POST") {
    lines.push(`  --header 'content-type: application/json' \\`);
    lines.push(`  --data '${JSON.stringify(bodyFor(e, v) ?? {})}'`);
  }
  return lines.join("\n");
}
