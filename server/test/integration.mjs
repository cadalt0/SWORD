// End-to-end test of the Sword developer API on Whitechain testnet (chain 1874), through sword-merchant, for all three
// kinds of merchant. Every payment is 0.001 USDT or less. Nothing here waits for the 20 minute order expiry or a
// subscription renewal.
//
// Needs, running: the website (WEB_URL, default http://localhost:3107) with TESTING_MODE on, and the API server
// (API_URL, default http://localhost:4000) with RATE_LIMIT_PER_MINUTE=60. Reads keys from my-evm-project/.env:
// CUSTOMER_PRIVATE_KEY (a wallet with test USDT and WBT) and RELAYER_PRIVATE_KEY (funds the test merchant wallets).
// Writes my-evm-project/deployments/test-runs/developer-api-1874.md.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createPublicClient, createWalletClient, erc20Abi, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAINS, SwordSDK } from "sword-sdk";

import { Sword, SwordApiError } from "../../merchant-sdk/dist/index.js";

process.loadEnvFile(fileURLToPath(new URL("../../my-evm-project/.env", import.meta.url)));

const CHAIN_ID = 1874;
const WEB = process.env.WEB_URL ?? "http://localhost:3107";
const API = process.env.API_URL ?? "http://localhost:4000";
const RPC = process.env.WHITECHAIN_RPC_URL;
const RATE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);
const hex = (k) => (k.startsWith("0x") ? k : `0x${k}`);
const USDT = CHAINS[CHAIN_ID].addresses.usdt;
const ONE = "0.001";
const U = 1000n;

const pub = createPublicClient({ chain: CHAINS[CHAIN_ID].chain, transport: http(RPC) });
const customer = privateKeyToAccount(hex(process.env.CUSTOMER_PRIVATE_KEY));
const relayerWallet = privateKeyToAccount(hex(process.env.RELAYER_PRIVATE_KEY));
const walletOf = (account) => createWalletClient({ account, chain: CHAINS[CHAIN_ID].chain, transport: http(RPC) });
const sdkFor = (account) => new SwordSDK({ mode: "merchant", walletClient: walletOf(account), rpcUrl: RPC });
const customerSdk = sdkFor(customer);
const bal = (a) => pub.readContract({ address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [a] });
const send = async (account, to, amount) => {
  const hash = await walletOf(account).writeContract({ address: USDT, abi: erc20Abi, functionName: "transfer", args: [to, amount] });
  assert.equal((await pub.waitForTransactionReceipt({ hash })).status, "success");
  return hash;
};
const fundGas = async (to) => {
  const hash = await walletOf(relayerWallet).sendTransaction({ to, value: parseEther("0.1") });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
};

/// A website session (test login), for the parts a person does on the website.
class WebUser {
  cookie = "";
  async call(path, body) {
    const res = await fetch(`${WEB}${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }
  async ok(path, body) {
    const r = await this.call(path, body);
    assert.equal(r.status, 200, `${path} answered ${r.status}: ${JSON.stringify(r.body)}`);
    return r.body;
  }
}

/// A raw API call, to check what the API itself answers.
async function raw(method, path, { key, body } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const expectError = async (promise, code) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SwordApiError, `expected SwordApiError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return error;
  }
  assert.fail(`expected ${code}, but it succeeded`);
};

const log = [];
/// ONLY=<regex> runs just the matching steps, for re-running one section.
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : undefined;
async function step(label, fn) {
  if (only && !only.test(label)) return;
  console.log(`\n== ${label}`);
  try {
    const detail = await fn();
    log.push({ label, ok: true, detail: detail ?? "ok" });
    console.log(`   ok${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0].slice(0, 300);
    log.push({ label, ok: false, detail: message });
    console.log(`   FAILED: ${message}`);
  }
}

const tag = Math.random().toString(36).slice(2, 8);
const keyOf = async (user, name, scopes) => (await user.ok("/api/developers/keys", { chainId: CHAIN_ID, name, scopes })).key;
const ALL = ["orders:read", "orders:write", "refunds:write", "withdrawals:write", "subscriptions:read", "subscriptions:write"];

// ------------------------------------------------------------------ custodial merchant

const m1 = new WebUser();
let m1Addr, limitedKey, fullKey, revokedKey, rateKey, sword;

await step("setup: custodial merchant signs in on the website, gets an account and registers", async () => {
  await m1.ok("/api/auth/test-login", { email: `api-m1-${tag}@sword.test`, role: "merchant" });
  m1Addr = (await m1.ok("/api/accounts", { chainId: CHAIN_ID, custody: "custodial", signing: "relayer" })).account;
  await m1.ok("/api/merchant/register", { chainId: CHAIN_ID });
  return m1Addr;
});

await step("developers page: create keys (default scopes, all scopes), list them, revoke one", async () => {
  const defaults = await m1.ok(`/api/developers/keys?chainId=${CHAIN_ID}`);
  assert.equal(defaults.signing, "relayer");
  limitedKey = await keyOf(m1, "Limited", defaults.defaultScopes);
  fullKey = await keyOf(m1, "Full", ALL);
  revokedKey = await keyOf(m1, "To revoke", ALL);
  rateKey = await keyOf(m1, "Rate", ["orders:read"]);
  assert.match(fullKey, /^sk_test_[A-Za-z0-9]{40}$/);
  const listed = (await m1.ok(`/api/developers/keys?chainId=${CHAIN_ID}`)).keys;
  assert.equal(listed.length, 4);
  assert.ok(listed.every((k) => !("key" in k) && k.prefix.startsWith("sk_test_")), "a listing must never contain the key");
  await m1.ok("/api/developers/keys/revoke", { id: listed.find((k) => k.name === "To revoke").id });
  sword = new Sword({ apiKey: fullKey, baseUrl: API });
  return `4 keys, default scopes ${defaults.defaultScopes.join(", ")}`;
});

await step("developers page: checkout domains are saved and normalized", async () => {
  const r = await m1.ok("/api/developers/settings", { chainId: CHAIN_ID, allowedOrigins: ["shop.example.com", "https://shop.example.com/path"] });
  assert.deepEqual(r.allowedOrigins, ["https://shop.example.com"]);
  const bad = await m1.call("/api/developers/settings", { chainId: CHAIN_ID, allowedOrigins: ["ftp://x"] });
  assert.equal(bad.status, 400);
});

await step("keys: missing, malformed, unknown and revoked keys are refused", async () => {
  assert.equal((await raw("GET", "/v1/merchant")).body.error.code, "MISSING_API_KEY");
  assert.equal((await raw("GET", "/v1/merchant", { key: "nope" })).body.error.code, "INVALID_API_KEY");
  const unknown = await raw("GET", "/v1/merchant", { key: `sk_test_${"a".repeat(40)}` });
  assert.equal(unknown.status, 401);
  const revoked = await raw("GET", "/v1/merchant", { key: revokedKey });
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.error.code, "INVALID_API_KEY");
});

await step("keys: a key without the refunds scope can't refund (403 MISSING_SCOPE)", async () => {
  const limited = new Sword({ apiKey: limitedKey, baseUrl: API });
  const err = await expectError(limited.orders.refund(`0x${"1".repeat(64)}`, { amount: ONE }), "MISSING_SCOPE");
  assert.equal(err.status, 403);
  assert.equal(err.details.scope, "refunds:write");
});

await step("keys: the rate limit answers 429 with Retry-After", async () => {
  const answers = [];
  for (let i = 0; i < RATE + 1; i += 20) {
    answers.push(...(await Promise.all(Array.from({ length: Math.min(20, RATE + 1 - i) }, () => raw("GET", "/v1/merchant", { key: rateKey })))));
  }
  const limited = answers.filter((a) => a.status === 429);
  assert.equal(limited.length, 1, `expected exactly 1 of ${answers.length} calls limited, got ${limited.length}`);
  assert.equal(limited[0].body.error.code, "RATE_LIMITED");
  assert.ok(limited[0].body.error.retryAfter > 0);
});

await step("validation: a bad amount is refused before anything is sent", async () => {
  const err = await expectError(sword.orders.create({ amount: "-1", reference: "x" }), "INVALID_INPUT");
  assert.equal(err.status, 400);
  assert.ok(err.details.fields.some((f) => f.field === "amount"));
});

let o1;
await step("custodial: merchant info says the relayer signs", async () => {
  const me = await sword.merchant();
  assert.equal(me.signing, "relayer");
  assert.equal(me.registered, true);
  assert.equal(me.address.toLowerCase(), m1Addr.toLowerCase());
  return `scopes ${me.key.scopes.length}`;
});

await step("custodial: create a 0.001 order; it has a checkout link and is pending", async () => {
  o1 = await sword.orders.create({ amount: ONE, reference: `api-a-${tag}` });
  assert.equal(o1.status, "pending");
  assert.equal(o1.amount, "0.001");
  assert.ok(o1.checkoutUrl.startsWith(`${WEB}/pay?chain=${CHAIN_ID}&merchant=`), o1.checkoutUrl);
  assert.ok(o1.transaction);
  return o1.id;
});

await step("custodial: the same reference can't make a second order (409)", async () => {
  const err = await sword.orders.create({ amount: ONE, reference: `api-a-${tag}` }).catch((e) => e);
  assert.ok(err instanceof SwordApiError, String(err));
  assert.equal(err.status, 409, `${err.code}: ${err.message}`);
  return err.code;
});

await step("custodial: before payment, confirm returns it still pending", async () => {
  assert.equal((await sword.orders.confirm(o1.id)).status, "pending");
});

await step("custodial: a wallet sends 0.001 to the deposit address; waitForPayment marks it paid", async () => {
  await send(customer, o1.depositAddress, U);
  const paid = await sword.orders.waitForPayment(o1.id, { intervalMs: 3000, timeoutMs: 120_000 });
  assert.equal(paid.status, "paid");
  assert.equal(paid.payer.toLowerCase(), customer.address.toLowerCase());
  return `paid by ${paid.payer}`;
});

await step("custodial: refund 0.0005 without a request", async () => {
  const before = await bal(customer.address);
  const r = await sword.orders.refund(o1.id, { amount: "0.0005", note: "api test" });
  assert.equal(r.status, "partially_refunded");
  assert.equal(r.refund.refunded, "0.0005");
  assert.equal((await bal(customer.address)) - before, 500n);
});

// A Sword customer, so a refund can be requested on chain from the website.
const c1 = new WebUser();
let c1Addr;
await step("setup: a custodial customer on the website, funded with 0.003 USDT", async () => {
  await c1.ok("/api/auth/test-login", { email: `api-c1-${tag}@sword.test`, role: "customer" });
  c1Addr = (await c1.ok("/api/accounts", { chainId: CHAIN_ID, custody: "custodial", signing: "relayer" })).account;
  await send(customer, c1Addr, 3000n);
});

let o2, o3;
await step("custodial: customer pays and asks for a refund; the API approves and pays it", async () => {
  o2 = await sword.orders.create({ amount: ONE, reference: `api-b-${tag}` });
  await c1.ok("/api/orders/pay", { chainId: CHAIN_ID, merchantAddress: m1Addr, orderId: o2.id });
  await c1.ok("/api/refunds", { chainId: CHAIN_ID, action: "request", merchantAddress: m1Addr, orderId: o2.id, amount: ONE, reason: "API test" });
  assert.equal((await sword.orders.get(o2.id)).refund.status, "requested");
  const approved = await sword.orders.approveRefund(o2.id, { amount: ONE });
  assert.equal(approved.refund.status, "approved");
  const before = await bal(c1Addr);
  const paid = await sword.orders.payRefund(o2.id);
  assert.equal(paid.status, "refunded");
  assert.equal((await bal(c1Addr)) - before, U);
});

await step("custodial: customer asks again on another order; the API declines", async () => {
  o3 = await sword.orders.create({ amount: ONE, reference: `api-c-${tag}` });
  await c1.ok("/api/orders/pay", { chainId: CHAIN_ID, merchantAddress: m1Addr, orderId: o3.id });
  await c1.ok("/api/refunds", { chainId: CHAIN_ID, action: "request", merchantAddress: m1Addr, orderId: o3.id, amount: ONE, reason: "API test" });
  const denied = await sword.orders.denyRefund(o3.id, { note: "not eligible" });
  assert.equal(denied.refund.status, "denied");
  assert.equal(denied.status, "paid");
});

await step("custodial: withdraw a paid order to the merchant account", async () => {
  const before = await bal(m1Addr);
  const w = await sword.orders.withdraw(o3.id);
  assert.equal(w.withdrawn, true);
  assert.equal((await bal(m1Addr)) - before, U);
});

await step("custodial: list and get orders", async () => {
  const list = await sword.orders.list({ limit: 2 });
  assert.equal(list.data.length, 2);
  assert.equal(list.hasMore, true);
  const next = await sword.orders.list({ limit: 2, before: list.data[1].createdAt });
  assert.ok(next.data.length >= 1);
  assert.ok(!next.data.some((o) => list.data.some((x) => x.id === o.id)), "pages must not overlap");
  assert.equal((await sword.orders.get(o1.id)).reference, `api-a-${tag}`);
  await expectError(sword.orders.get(`0x${"ab".repeat(32)}`), "NOT_FOUND");
});

let s1;
await step("custodial: create a subscription (0.001 a day, 2 payments); a wallet takes it", async () => {
  s1 = await sword.subscriptions.create({ name: `API plan ${tag}`, reference: `api-sub-${tag}`, amount: ONE, periodDays: 1, periods: 2 });
  assert.equal(s1.status, "open");
  assert.ok(s1.subscribeUrl.startsWith(`${WEB}/subscribe?id=`));
  const { transaction } = await customerSdk.subscriptions.subscribe(s1.id);
  // The subscribe page records the customer after the wallet subscribes.
  const r = await fetch(`${WEB}/api/subscriptions/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s1.id, subscriber: customer.address, txHash: transaction.hash }) });
  assert.equal(r.status, 200);
  const now = await sword.subscriptions.get(s1.id);
  assert.equal(now.status, "active");
  assert.equal(now.paidPeriods, 1);
  return s1.id;
});

await step("custodial: charging before the next period is due answers 409 NOT_DUE", async () => {
  const err = await expectError(sword.subscriptions.charge(s1.id), "NOT_DUE");
  assert.equal(err.status, 409);
});

await step("custodial: subscription refund 0.0005, withdraw the rest, cancel", async () => {
  const before = await bal(customer.address);
  const r = await sword.subscriptions.refund(s1.id, { amount: "0.0005" });
  assert.equal(r.refunded, "0.0005");
  assert.equal((await bal(customer.address)) - before, 500n);
  const w = await sword.subscriptions.withdraw(s1.id);
  assert.equal(w.held, "0");
  const c = await sword.subscriptions.cancel(s1.id);
  assert.equal(c.status, "cancelled");
  await expectError(sword.subscriptions.cancel(s1.id), "ALREADY_ENDED");
  assert.ok((await sword.subscriptions.list()).data.some((s) => s.id === s1.id));
});

await step("records: API orders show on the website dashboard, with activity and notifications", async () => {
  const orders = (await m1.ok(`/api/orders?chainId=${CHAIN_ID}`)).orders.map((o) => o.orderId.toLowerCase());
  for (const o of [o1, o2, o3]) assert.ok(orders.includes(o.id.toLowerCase()), `dashboard is missing ${o.id}`);
  const types = new Set((await m1.ok("/api/activity?limit=100")).activity.map((a) => a.type));
  for (const t of ["order.created", "order.paid", "refund.paid", "refund.approved", "refund.denied", "order.withdrawn", "subscription.created", "subscription.refunded", "subscription.cancelled"]) assert.ok(types.has(t), `activity missing ${t}`);
  const mine = (await m1.ok("/api/notifications")).notifications.map((n) => n.title);
  assert.ok(mine.includes("Payment received") && mine.includes("You declined a refund"), mine.join(" | "));
  const theirs = (await c1.ok("/api/notifications")).notifications.map((n) => n.title);
  assert.ok(theirs.includes("Refund declined") && theirs.includes("Refund received"), theirs.join(" | "));
});

// ------------------------------------------------------------------ wallet merchant with a permission

const m2Wallet = privateKeyToAccount(generatePrivateKey());
const m2 = new WebUser();
let sword2, o4;

await step("setup: a wallet merchant registers and gives the relayer a permission", async () => {
  await fundGas(m2Wallet.address);
  const sdk = sdkFor(m2Wallet);
  await sdk.merchant.register();
  const request = await sdk.permission.prepare({ merchant: m2Wallet.address, relayer: relayerWallet.address, validForDays: 7, maxOrders: 10, maxActions: 20, maxAmount: "1" });
  await sdk.permission.submit(await sdk.permission.sign(request));
  await m2.ok("/api/auth/test-login", { email: `api-m2-${tag}@sword.test`, role: "merchant" });
  await m2.ok("/api/accounts", { chainId: CHAIN_ID, signing: "signless", ownerAddress: m2Wallet.address });
  sword2 = new Sword({ apiKey: await keyOf(m2, "Server", ALL), baseUrl: API });
  const me = await sword2.merchant();
  assert.equal(me.signing, "permission");
  assert.equal(me.permission.state, "active");
  return m2Wallet.address;
});

await step("permission merchant: create, get paid by a wallet transfer, confirm, refund (the relayer signs)", async () => {
  o4 = await sword2.orders.create({ amount: ONE, reference: `api-d-${tag}` });
  assert.equal(o4.status, "pending");
  await send(customer, o4.depositAddress, U);
  const paid = await sword2.orders.waitForPayment(o4.id, { intervalMs: 3000, timeoutMs: 120_000 });
  assert.equal(paid.status, "paid");
  const r = await sword2.orders.refund(o4.id, { amount: "0.0005" });
  assert.equal(r.refund.refunded, "0.0005");
});

await step("keys: one merchant's key can't see another merchant's order or subscription", async () => {
  await expectError(sword2.orders.get(o1.id), "NOT_FOUND");
  await expectError(sword2.subscriptions.get(s1.id), "NOT_FOUND");
  await expectError(sword.orders.get(o4.id), "NOT_FOUND");
});

// ------------------------------------------------------------------ wallet merchant that signs itself

const m3PrivateKey = generatePrivateKey();
const m3Wallet = privateKeyToAccount(m3PrivateKey);
const m3 = new WebUser();
let m3Key, sword3, o5, s3;

await step("setup: a wallet merchant registers with no permission", async () => {
  await fundGas(m3Wallet.address);
  await sdkFor(m3Wallet).merchant.register();
  await m3.ok("/api/auth/test-login", { email: `api-m3-${tag}@sword.test`, role: "merchant" });
  await m3.ok("/api/accounts", { chainId: CHAIN_ID, signing: "manual", ownerAddress: m3Wallet.address });
  m3Key = await keyOf(m3, "Server", ALL);
  assert.equal((await m3.ok(`/api/developers/keys?chainId=${CHAIN_ID}`)).signing, "self");
  return m3Wallet.address;
});

await step("self-signing: without privateKey the SDK says a signature is needed", async () => {
  const noKey = new Sword({ apiKey: m3Key, baseUrl: API });
  assert.equal((await noKey.merchant()).signing, "self");
  const err = await expectError(noKey.orders.create({ amount: ONE, reference: `api-nokey-${tag}` }), "SIGNATURE_REQUIRED");
  assert.equal(err.details.transaction.from.toLowerCase(), m3Wallet.address.toLowerCase());
});

await step("self-signing: a wrong privateKey is refused before anything is sent", async () => {
  const wrong = new Sword({ apiKey: m3Key, baseUrl: API, privateKey: generatePrivateKey() });
  await expectError(wrong.orders.create({ amount: ONE, reference: `api-wrong-${tag}` }), "WRONG_PRIVATE_KEY");
});

await step("self-signing: a reported hash that isn't the prepared transaction is refused", async () => {
  const started = await raw("POST", "/v1/orders", { key: m3Key, body: { amount: ONE, reference: `api-tamper-${tag}` } });
  assert.equal(started.status, 202);
  assert.equal(started.body.status, "signature_required");
  const someoneElses = await send(customer, customer.address, 1n);
  const r = await raw("POST", `/v1/transactions/${started.body.transaction.id}/submit`, { key: m3Key, body: { txHash: someoneElses } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "WRONG_SENDER");
  const otherKey = await raw("GET", `/v1/transactions/${started.body.transaction.id}`, { key: fullKey });
  assert.equal(otherKey.status, 404, "another key must not see this pending transaction");
});

await step("self-signing: create an order; the SDK signs locally and gets the final order", async () => {
  sword3 = new Sword({ apiKey: m3Key, baseUrl: API, privateKey: m3PrivateKey });
  o5 = await sword3.orders.create({ amount: ONE, reference: `api-e-${tag}` });
  assert.equal(o5.status, "pending");
  assert.ok(o5.transaction);
  const tx = await pub.getTransaction({ hash: o5.transaction });
  assert.equal(tx.from.toLowerCase(), m3Wallet.address.toLowerCase(), "the merchant's own wallet must have sent it");
  return o5.id;
});

await step("self-signing: a wallet transfer pays it; confirm is signed by the merchant", async () => {
  await send(customer, o5.depositAddress, U);
  const paid = await sword3.orders.waitForPayment(o5.id, { intervalMs: 3000, timeoutMs: 120_000 });
  assert.equal(paid.status, "paid");
});

await step("self-signing: refund 0.0005 (two signed transactions: approve, then pay)", async () => {
  const before = await bal(customer.address);
  const r = await sword3.orders.refund(o5.id, { amount: "0.0005" });
  assert.equal(r.status, "partially_refunded");
  assert.equal((await bal(customer.address)) - before, 500n);
});

await step("self-signing: withdraw (the relayer does it for anyone)", async () => {
  const before = await bal(m3Wallet.address);
  const w = await sword3.orders.withdraw(o5.id);
  assert.equal(w.withdrawn, true);
  assert.equal((await bal(m3Wallet.address)) - before, 500n);
});

await step("self-signing: create and cancel a subscription", async () => {
  s3 = await sword3.subscriptions.create({ name: `Self plan ${tag}`, reference: `api-sub3-${tag}`, amount: ONE, periodDays: 7, periods: 4 });
  assert.equal(s3.status, "open");
  const c = await sword3.subscriptions.cancel(s3.id);
  assert.equal(c.status, "cancelled");
});

await step("checkout page: the order's pay page reports whether a site may be told the result", async () => {
  const at = (origin) => fetch(`${WEB}/api/pay/order?chain=${CHAIN_ID}&merchant=${m1Addr}&order=${o1.id}&origin=${encodeURIComponent(origin)}`).then((r) => r.json());
  assert.equal((await at("http://localhost:5173")).originAllowed, true, "localhost is allowed in testing mode");
  assert.equal((await at("https://shop.example.com")).originAllowed, true, "an approved domain is allowed");
  assert.equal((await at("https://evil.example.net")).originAllowed, false, "other domains are not");
});

const failed = log.filter((l) => !l.ok);
const lines = [
  "# Developer API test (sword-api + sword-merchant), Whitechain testnet (chain 1874)",
  "",
  `API: ${API}. Web: ${WEB}. Every payment is 0.001 USDT or less.`,
  "",
  "| Step | Result |",
  "|---|---|",
  ...log.map((l) => `| ${l.label} | ${l.ok ? "passed" : "FAILED"}: ${String(l.detail).replaceAll("|", "/")} |`),
  "",
  failed.length === 0 ? `All ${log.length} steps passed.` : `${log.length - failed.length} of ${log.length} steps passed.`,
  "",
  "Not tested here: the 20 minute order expiry and subscription renewals (they need waiting).",
  "",
];
const dir = new URL("../../my-evm-project/deployments/test-runs/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(only ? "developer-api-1874-rerun.md" : "developer-api-1874.md", dir), lines.join("\n"));
console.log(`\n${failed.length === 0 ? `All ${log.length} steps passed.` : `${log.length - failed.length}/${log.length} passed. FAILED: ${failed.map((f) => f.label).join("; ")}`}`);
process.exit(failed.length === 0 ? 0 : 1);
