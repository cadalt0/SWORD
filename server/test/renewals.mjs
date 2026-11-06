// Tests subscription renewals on Whitechain testnet (chain 1874) with 10 second periods, through sword-merchant and
// the website, for every kind of merchant. Every payment is 0.001 USDT or less.
//
// Needs, running: the website (WEB_URL, default http://localhost:3107) with TESTING_MODE on, and the API server
// (API_URL, default http://localhost:4100). Reads my-evm-project/.env: CUSTOMER_PRIVATE_KEY (a wallet with test USDT and
// WBT) and RELAYER_PRIVATE_KEY (funds the test merchant wallets with gas).
// Writes my-evm-project/deployments/test-runs/renewals-1874.md.

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
const API = process.env.API_URL ?? "http://localhost:4100";
const RPC = process.env.WHITECHAIN_RPC_URL;
const hex = (k) => (k.startsWith("0x") ? k : `0x${k}`);
const USDT = CHAINS[CHAIN_ID].addresses.usdt;
const ONE = "0.001";
const U = 1000n;
const PERIOD = 10;
const ALL = ["orders:read", "orders:write", "refunds:write", "withdrawals:write", "subscriptions:read", "subscriptions:write"];

const pub = createPublicClient({ chain: CHAINS[CHAIN_ID].chain, transport: http(RPC) });
const customer = privateKeyToAccount(hex(process.env.CUSTOMER_PRIVATE_KEY));
const relayerWallet = privateKeyToAccount(hex(process.env.RELAYER_PRIVATE_KEY));
const walletOf = (account) => createWalletClient({ account, chain: CHAINS[CHAIN_ID].chain, transport: http(RPC) });
const sdkFor = (account) => new SwordSDK({ mode: "merchant", walletClient: walletOf(account), rpcUrl: RPC });
const customerSdk = sdkFor(customer);
const bal = (a) => pub.readContract({ address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [a] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fundGas = async (to) => {
  const hash = await walletOf(relayerWallet).sendTransaction({ to, value: parseEther("0.1") });
  await pub.waitForTransactionReceipt({ hash });
};

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

const log = [];
/// ONLY=<regex> runs just the matching steps (setup steps always run), for re-running one part.
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : undefined;
async function step(label, fn) {
  if (only && !only.test(label) && !/^setup:/.test(label) && !/^10 second period/.test(label)) return;
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

const expectCode = async (promise, code) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SwordApiError, `expected SwordApiError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return error;
  }
  assert.fail(`expected ${code}, but it succeeded`);
};

/// Waits until the chain says the next period is due, then returns the subscription. Periods are 10 seconds.
async function untilDue(sword, id) {
  for (let i = 0; i < 30; i++) {
    const s = await sword.subscriptions.get(id);
    if (!s.nextChargeAt) throw new Error("the subscription has no next charge");
    const due = Date.parse(s.nextChargeAt);
    const chainNow = Number((await pub.getBlock()).timestamp) * 1000;
    if (due <= chainNow) return s;
    await sleep(Math.min(3000, due - chainNow + 500));
  }
  throw new Error("the subscription never became due");
}

const tag = Math.random().toString(36).slice(2, 8);
const keyOf = async (user, name) => (await user.ok("/api/developers/keys", { chainId: CHAIN_ID, name, scopes: ALL })).key;
const createSub = (sword, name, periods) => sword.subscriptions.create({ name: `${name} ${tag}`, reference: `${name.toLowerCase().replace(/\W+/g, "-")}-${tag}`, amount: ONE, periodSeconds: PERIOD, periods });
/// A plain wallet takes the subscription, then the website is told, as the subscribe page does.
const walletSubscribes = async (id) => {
  const { transaction } = await customerSdk.subscriptions.subscribe(id);
  const r = await fetch(`${WEB}/api/subscriptions/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, subscriber: customer.address, txHash: transaction.hash }) });
  assert.equal(r.status, 200, await r.text());
};

// ------------------------------------------------------------------ custodial merchant, through the API

const m1 = new WebUser();
let m1Addr, sword, s1;

await step("setup: custodial merchant, registered, with an API key", async () => {
  await m1.ok("/api/auth/test-login", { email: `ren-m1-${tag}@sword.test`, role: "merchant" });
  m1Addr = (await m1.ok("/api/accounts", { chainId: CHAIN_ID, custody: "custodial", signing: "relayer" })).account;
  await m1.ok("/api/merchant/register", { chainId: CHAIN_ID });
  sword = new Sword({ apiKey: await keyOf(m1, "Renewals"), baseUrl: API });
  return m1Addr;
});

await step("10 second period: the API takes periodSeconds, refuses 9 seconds, and refuses both periodDays and periodSeconds", async () => {
  s1 = await createSub(sword, "Ten seconds", 3);
  assert.equal(s1.periodSeconds, PERIOD);
  assert.ok(s1.periodDays < 0.001, `periodDays should be a small fraction, got ${s1.periodDays}`);
  const short = await expectCode(sword.subscriptions.create({ name: "x", reference: `short-${tag}`, amount: ONE, periodSeconds: 9, periods: 1 }), "INVALID_INPUT");
  assert.equal(short.status, 400);
  await expectCode(sword.subscriptions.create({ name: "x", reference: `both-${tag}`, amount: ONE, periodDays: 1, periodSeconds: 60, periods: 1 }), "INVALID_INPUT");
  return s1.id;
});

await step("renewal 1: a wallet subscribes (approves the whole 0.003, pays the first 0.001)", async () => {
  const before = await bal(customer.address);
  await walletSubscribes(s1.id);
  assert.equal(before - (await bal(customer.address)), U);
  const s = await sword.subscriptions.get(s1.id);
  assert.equal(s.status, "active");
  assert.equal(s.paidPeriods, 1);
  const allowance = await pub.readContract({ address: USDT, abi: erc20Abi, functionName: "allowance", args: [customer.address, CHAINS[CHAIN_ID].addresses.spender] });
  // The wallet approved the whole 0.003; the first 0.001 was pulled at once, so at least 0.002 is left for renewals.
  assert.ok(allowance >= 2n * U, `the rest of the 0.003 must stay approved, allowance is ${allowance}`);
});

await step("renewals 2 and 3: each period is charged when due, 0.001 each, until the subscription completes", async () => {
  for (const period of [2, 3]) {
    await untilDue(sword, s1.id);
    const before = await bal(customer.address);
    const s = await sword.subscriptions.charge(s1.id);
    assert.equal(s.paidPeriods, period);
    assert.equal(before - (await bal(customer.address)), U, `period ${period} must take exactly 0.001`);
    assert.equal(s.held, `0.00${period}`);
  }
  const done = await sword.subscriptions.get(s1.id);
  assert.equal(done.status, "completed");
  assert.equal(done.collected, "0.003");
  assert.equal(done.nextChargeAt, null);
});

await step("too early: a longer subscription refuses a charge before its period is up (409 NOT_DUE)", async () => {
  const long = await sword.subscriptions.create({ name: `Long ${tag}`, reference: `long-${tag}`, amount: ONE, periodSeconds: 600, periods: 2 });
  await walletSubscribes(long.id);
  const err = await expectCode(sword.subscriptions.charge(long.id), "NOT_DUE");
  assert.equal(err.status, 409);
  assert.ok(err.details.nextChargeAt, "the answer says when it is due");
  await sword.subscriptions.cancel(long.id);
});

await step("completed: nothing more can be charged or cancelled", async () => {
  await expectCode(sword.subscriptions.charge(s1.id), "NOT_CHARGEABLE");
  await expectCode(sword.subscriptions.cancel(s1.id), "ALREADY_ENDED");
});

await step("refund request declined through the API (the gap from the last run)", async () => {
  await customerSdk.subscriptions.requestRefund({ id: s1.id, amount: ONE, reason: "renewals test" });
  assert.deepEqual((await sword.subscriptions.get(s1.id)).refundRequest, { amount: "0.001" });
  const denied = await sword.subscriptions.denyRefund(s1.id, { note: "no" });
  assert.equal(denied.refundRequest, null);
  await expectCode(sword.subscriptions.denyRefund(s1.id), "NO_REFUND_REQUEST");
});

await step("withdraw: the vault's 0.003 moves to the merchant account", async () => {
  const before = await bal(m1Addr);
  const w = await sword.subscriptions.withdraw(s1.id);
  assert.equal(w.held, "0");
  assert.equal((await bal(m1Addr)) - before, 3n * U);
  return "0.003 withdrawn";
});

// ------------------------------------------------------------------ renewals collected from the website

let s2;
await step("website: the merchant dashboard collects a due renewal for a custodial customer", async () => {
  const c1 = new WebUser();
  await c1.ok("/api/auth/test-login", { email: `ren-c1-${tag}@sword.test`, role: "customer" });
  const cAddr = (await c1.ok("/api/accounts", { chainId: CHAIN_ID, custody: "custodial", signing: "relayer" })).account;
  const hash = await walletOf(customer).writeContract({ address: USDT, abi: erc20Abi, functionName: "transfer", args: [cAddr, 3n * U] });
  await pub.waitForTransactionReceipt({ hash });

  s2 = await createSub(sword, "Website collect", 3);
  await c1.ok("/api/subscriptions/customer", { chainId: CHAIN_ID, action: "subscribe", id: s2.id });
  assert.equal((await sword.subscriptions.get(s2.id)).paidPeriods, 1);

  await untilDue(sword, s2.id);
  const before = await bal(cAddr);
  let charged = 0;
  for (let i = 0; i < 3 && charged === 0; i++) charged = (await m1.ok("/api/subscriptions", { chainId: CHAIN_ID, action: "collect" })).charged;
  assert.ok(charged >= 1, `collect charged ${charged}`);
  const now = await sword.subscriptions.get(s2.id);
  assert.ok(now.paidPeriods >= 2);
  assert.equal(before - (await bal(cAddr)), BigInt(now.paidPeriods - 1) * U);

  const customerSees = (await c1.ok("/api/notifications")).notifications.map((n) => n.title);
  assert.ok(customerSees.includes("Subscription renewed"), customerSees.join(" | "));
  const merchantSees = (await m1.ok("/api/notifications")).notifications.map((n) => n.title);
  assert.ok(merchantSees.includes("Subscription payment"), merchantSees.join(" | "));
  const mine = (await c1.ok("/api/my/subscriptions")).subscriptions.find((s) => s.id === s2.id);
  assert.equal(mine.periodDays < 0.001, true);
  return "renewed, both sides notified";
});

await step("website: a 10 second subscription reads as '10 seconds' and not '0 days'", async () => {
  const offer = await (await fetch(`${WEB}/api/subscribe?id=${s2.id}`)).json();
  assert.equal(Math.round(offer.periodDays * 86_400), PERIOD);
});

// ------------------------------------------------------------------ wallet merchant with a permission

const m2Wallet = privateKeyToAccount(generatePrivateKey());
const m2 = new WebUser();
let sword2, s3;

await step("permission merchant: create a 10 second subscription, a wallet takes it, the relayer charges renewal 2", async () => {
  await fundGas(m2Wallet.address);
  const sdk = sdkFor(m2Wallet);
  await sdk.merchant.register();
  const request = await sdk.permission.prepare({ merchant: m2Wallet.address, relayer: relayerWallet.address, validForDays: 7, maxOrders: 10, maxActions: 30, maxAmount: "1" });
  await sdk.permission.submit(await sdk.permission.sign(request));
  await m2.ok("/api/auth/test-login", { email: `ren-m2-${tag}@sword.test`, role: "merchant" });
  await m2.ok("/api/accounts", { chainId: CHAIN_ID, signing: "signless", ownerAddress: m2Wallet.address });
  sword2 = new Sword({ apiKey: await keyOf(m2, "Permission"), baseUrl: API });
  assert.equal((await sword2.merchant()).signing, "permission");
  s3 = await createSub(sword2, "Permission plan", 2);
  await walletSubscribes(s3.id);
  await untilDue(sword2, s3.id);
  const s = await sword2.subscriptions.charge(s3.id);
  assert.equal(s.paidPeriods, 2);
  assert.equal(s.status, "completed");
});

await step("permission merchant: withdraw; a refund from the wallet says exactly what is missing, then works once approved", async () => {
  const w = await sword2.subscriptions.withdraw(s3.id);
  assert.equal(w.held, "0");
  const err = await expectCode(sword2.subscriptions.refund(s3.id, { amount: "0.0005" }), "MERCHANT_ALLOWANCE_TOO_LOW");
  assert.equal(err.status, 409);
  assert.equal(err.details.needed, "0.0005");
  await sdkFor(m2Wallet).merchant.approveRefundSpender("0.0005");
  const before = await bal(customer.address);
  const r = await sword2.subscriptions.refund(s3.id, { amount: "0.0005" });
  assert.equal(r.refunded, "0.0005");
  assert.equal((await bal(customer.address)) - before, 500n);
});

await step("permission merchant: an order refunded after withdrawal needs the allowance too, and says so", async () => {
  const o = await sword2.orders.create({ amount: ONE, reference: `ren-o2-${tag}` });
  const hash = await walletOf(customer).writeContract({ address: USDT, abi: erc20Abi, functionName: "transfer", args: [o.depositAddress, U] });
  await pub.waitForTransactionReceipt({ hash });
  await sword2.orders.waitForPayment(o.id, { intervalMs: 3000, timeoutMs: 120_000 });
  await sword2.orders.withdraw(o.id);
  const err = await expectCode(sword2.orders.refund(o.id, { amount: "0.0005" }), "MERCHANT_ALLOWANCE_TOO_LOW");
  assert.equal(err.status, 409);
  await sdkFor(m2Wallet).merchant.approveRefundSpender("0.0005");
  const r = await sword2.orders.refund(o.id, { amount: "0.0005" });
  assert.equal(r.status, "partially_refunded");
});

// ------------------------------------------------------------------ wallet merchant that signs itself

const m3PrivateKey = generatePrivateKey();
const m3Wallet = privateKeyToAccount(m3PrivateKey);
const m3 = new WebUser();
let sword3, s4;

await step("self-signing merchant: create a 10 second subscription, a wallet takes it, the merchant's own wallet charges renewal 2", async () => {
  await fundGas(m3Wallet.address);
  await sdkFor(m3Wallet).merchant.register();
  await m3.ok("/api/auth/test-login", { email: `ren-m3-${tag}@sword.test`, role: "merchant" });
  await m3.ok("/api/accounts", { chainId: CHAIN_ID, signing: "manual", ownerAddress: m3Wallet.address });
  sword3 = new Sword({ apiKey: await keyOf(m3, "Self"), baseUrl: API, privateKey: m3PrivateKey });
  assert.equal((await sword3.merchant()).signing, "self");
  s4 = await createSub(sword3, "Self plan", 2);
  await walletSubscribes(s4.id);
  await untilDue(sword3, s4.id);
  const s = await sword3.subscriptions.charge(s4.id);
  assert.equal(s.paidPeriods, 2);
  const tx = await pub.getTransaction({ hash: s.transaction });
  assert.equal(tx.from.toLowerCase(), m3Wallet.address.toLowerCase(), "the merchant's own wallet must send the charge");
});

await step("self-signing merchant: withdraw, then refund 0.0005 from its own wallet (two signed transactions: approve, then refund)", async () => {
  const w = await sword3.subscriptions.withdraw(s4.id);
  assert.equal(w.held, "0");
  const before = await bal(customer.address);
  const r = await sword3.subscriptions.refund(s4.id, { amount: "0.0005" });
  assert.equal(r.refunded, "0.0005");
  assert.equal((await bal(customer.address)) - before, 500n);
});

await step("self-signing merchant: declining a refund request is signed by its wallet", async () => {
  await customerSdk.subscriptions.requestRefund({ id: s4.id, amount: ONE, reason: "renewals test" });
  const denied = await sword3.subscriptions.denyRefund(s4.id);
  assert.equal(denied.refundRequest, null);
});

await step("self-signing merchant: an order refunded after withdrawal signs three transactions (approve amount, allowance, pay)", async () => {
  const o = await sword3.orders.create({ amount: ONE, reference: `ren-o3-${tag}` });
  const hash = await walletOf(customer).writeContract({ address: USDT, abi: erc20Abi, functionName: "transfer", args: [o.depositAddress, U] });
  await pub.waitForTransactionReceipt({ hash });
  await sword3.orders.waitForPayment(o.id, { intervalMs: 3000, timeoutMs: 120_000 });
  await sword3.orders.withdraw(o.id);
  const before = await bal(customer.address);
  const r = await sword3.orders.refund(o.id, { amount: "0.0005" });
  assert.equal(r.status, "partially_refunded");
  assert.equal((await bal(customer.address)) - before, 500n);
});

const failed = log.filter((l) => !l.ok);
const lines = [
  "# Subscription renewals test, 10 second periods (chain 1874)",
  "",
  `API: ${API}. Web: ${WEB}. Every payment is 0.001 USDT or less.`,
  "",
  "| Step | Result |",
  "|---|---|",
  ...log.map((l) => `| ${l.label} | ${l.ok ? "passed" : "FAILED"}: ${String(l.detail).replaceAll("|", "/")} |`),
  "",
  failed.length === 0 ? `All ${log.length} steps passed.` : `${log.length - failed.length} of ${log.length} steps passed.`,
  "",
];
const dir = new URL("../../my-evm-project/deployments/test-runs/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(only ? "renewals-1874-rerun.md" : "renewals-1874.md", dir), lines.join("\n"));
console.log(`\n${failed.length === 0 ? `All ${log.length} steps passed.` : `${log.length - failed.length}/${log.length} passed. FAILED: ${failed.map((f) => f.label).join("; ")}`}`);
process.exit(failed.length === 0 ? 0 : 1);
