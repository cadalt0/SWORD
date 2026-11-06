// Tests Sword on both chains through the website and the API server: Arc testnet (USDC) in full, and Whitechain testnet
// (USDT) as a check that nothing changed. Every payment is 0.001 or less.
//
// Needs, running: the website (WEB_URL, default http://localhost:3107) with TESTING_MODE on, and the API server
// (API_URL, default http://localhost:4100). Reads CUSTOMER_PRIVATE_KEY from my-evm-project/.env (a wallet with funds on
// both chains). Writes my-evm-project/deployments/test-runs/multichain.md.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createPublicClient, createWalletClient, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET_ID, CHAINS, SwordSDK, WHITECHAIN_TESTNET_ID } from "sword-sdk";

import { Sword } from "../../merchant-sdk/dist/index.js";

process.loadEnvFile(fileURLToPath(new URL("../../my-evm-project/.env", import.meta.url)));
const WEB = process.env.WEB_URL ?? "http://localhost:3107";
const API = process.env.API_URL ?? "http://localhost:4100";
const hex = (k) => (k.startsWith("0x") ? k : `0x${k}`);
const customer = privateKeyToAccount(hex(process.env.CUSTOMER_PRIVATE_KEY));
const ALL = ["orders:read", "orders:write", "refunds:write", "withdrawals:write", "subscriptions:read", "subscriptions:write"];

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
async function step(label, fn) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 8);

await step("API health lists both chains", async () => {
  const h = await (await fetch(`${API}/health`)).json();
  assert.deepEqual(h.chains.sort((a, b) => a - b), [WHITECHAIN_TESTNET_ID, ARC_TESTNET_ID]);
});

/// Runs the merchant flow on one chain. `full` adds refunds, a subscription renewal and withdrawals.
async function onChain(chainId, full) {
  const entry = CHAINS[chainId];
  const symbol = entry.token.symbol;
  const name = `${entry.chain.name} (${symbol})`;
  const rpc = entry.defaultRpcUrl;
  const pub = createPublicClient({ chain: entry.chain, transport: http(rpc) });
  const wallet = createWalletClient({ account: customer, chain: entry.chain, transport: http(rpc) });
  const walletSdk = new SwordSDK({ mode: "merchant", chainId, walletClient: wallet });
  const bal = (a) => pub.readContract({ address: entry.addresses.usdt, abi: erc20Abi, functionName: "balanceOf", args: [a] });
  const send = async (to, amount) => pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: entry.addresses.usdt, abi: erc20Abi, functionName: "transfer", args: [to, amount] }) });
  const m = new WebUser();
  let merchant, sword, order;

  await step(`${name}: merchant picks this chain at setup, gets a custodial account, registers`, async () => {
    await m.ok("/api/auth/test-login", { email: `mc-${chainId}-${tag}@sword.test`, role: "merchant" });
    merchant = (await m.ok("/api/accounts", { chainId, custody: "custodial", signing: "relayer" })).account;
    await m.ok("/api/merchant/register", { chainId });
    const onboarding = await m.ok(`/api/onboarding?chainId=${chainId === ARC_TESTNET_ID ? WHITECHAIN_TESTNET_ID : ARC_TESTNET_ID}`);
    assert.equal(onboarding.chainId, chainId, "an existing account answers for its own chain, whatever is asked");
    assert.equal(onboarding.ready, true);
    return merchant;
  });

  await step(`${name}: an API key for it; the API says which chain and coin`, async () => {
    const key = (await m.ok("/api/developers/keys", { chainId, name: "Test", scopes: ALL })).key;
    sword = new Sword({ apiKey: key, baseUrl: API });
    const me = await sword.merchant();
    assert.equal(me.chainId, chainId);
    assert.equal(me.currency, symbol);
    assert.equal(me.signing, "relayer");
  });

  await step(`${name}: create a 0.001 order; its checkout link is for this chain`, async () => {
    order = await sword.orders.create({ amount: "0.001", reference: `mc-${tag}` });
    assert.equal(order.currency, symbol);
    assert.ok(order.checkoutUrl.includes(`chain=${chainId}&`), order.checkoutUrl);
    const page = await (await fetch(`${WEB}/api/pay/order?chain=${chainId}&merchant=${merchant}&order=${order.id}`)).json();
    assert.equal(page.status, "pending");
    return order.id;
  });

  await step(`${name}: a wallet sends 0.001 to the deposit address; the API confirms it`, async () => {
    await send(order.depositAddress, 1000n);
    const paid = await sword.orders.waitForPayment(order.id, { intervalMs: 3000, timeoutMs: 120_000 });
    assert.equal(paid.status, "paid");
    assert.equal(paid.payer.toLowerCase(), customer.address.toLowerCase());
  });

  await step(`${name}: the receipt and the merchant's notification use ${symbol}`, async () => {
    const receipt = await (await fetch(`${WEB}/api/receipt?tx=${(await sword.orders.get(order.id)).paymentTransaction}&chain=${chainId}`)).json();
    assert.ok(!receipt.error, JSON.stringify(receipt));
    const n = (await m.ok("/api/notifications")).notifications.find((x) => x.title === "Payment received");
    assert.ok(n, "payment notification missing");
    assert.ok(n.body.includes(symbol), n.body);
    return n.body;
  });

  if (!full) return;

  await step(`${name}: refund 0.0005 to the customer`, async () => {
    const before = await bal(customer.address);
    const r = await sword.orders.refund(order.id, { amount: "0.0005" });
    assert.equal(r.status, "partially_refunded");
    assert.equal((await bal(customer.address)) - before, 500n);
  });

  await step(`${name}: a website scan-to-pay order is confirmed by the website`, async () => {
    const o = await sword.orders.create({ amount: "0.001", reference: `mc-scan-${tag}` });
    await send(o.depositAddress, 1000n);
    let r;
    for (let i = 0; i < 10; i++) {
      r = await (await fetch(`${WEB}/api/pay/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId, merchant, orderId: o.id }) })).json();
      if (r.paid) break;
      await sleep(3000);
    }
    assert.equal(r.paid, true, JSON.stringify(r));
    const w = await sword.orders.withdraw(o.id);
    assert.equal(w.withdrawn, true);
  });

  await step(`${name}: a 10 second subscription; a wallet takes it; the next period is charged when due`, async () => {
    const s = await sword.subscriptions.create({ name: `Plan ${tag}`, reference: `mc-sub-${tag}`, amount: "0.001", periodSeconds: 10, periods: 2 });
    assert.equal(s.currency, symbol);
    const { transaction } = await walletSdk.subscriptions.subscribe(s.id);
    const started = await fetch(`${WEB}/api/subscriptions/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s.id, subscriber: customer.address, txHash: transaction.hash }) });
    assert.equal(started.status, 200, await started.text());
    for (let i = 0; i < 20; i++) {
      const now = await sword.subscriptions.get(s.id);
      if (now.nextChargeAt && Date.parse(now.nextChargeAt) <= Number((await pub.getBlock()).timestamp) * 1000) break;
      await sleep(2500);
    }
    const charged = await sword.subscriptions.charge(s.id);
    assert.equal(charged.paidPeriods, 2);
    assert.equal(charged.status, "completed");
    const w = await sword.subscriptions.withdraw(s.id);
    assert.equal(w.held, "0");
  });

  await step(`${name}: the merchant's website lists show the API's orders and subscription`, async () => {
    const orders = (await m.ok(`/api/orders?chainId=${chainId}`)).orders.map((o) => o.orderId.toLowerCase());
    assert.ok(orders.includes(order.id.toLowerCase()));
    const subs = (await m.ok(`/api/subscriptions?chainId=${chainId}`)).subscriptions;
    assert.ok(subs.length >= 1);
  });
}

await onChain(ARC_TESTNET_ID, true);
await onChain(WHITECHAIN_TESTNET_ID, false);

const failed = log.filter((l) => !l.ok);
const lines = [
  "# Two chains: Arc testnet (USDC) and Whitechain testnet (USDT)",
  "",
  `API: ${API}. Web: ${WEB}. Every payment is 0.001 or less.`,
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
await writeFile(new URL("multichain.md", dir), lines.join("\n"));
console.log(`\n${failed.length === 0 ? `All ${log.length} steps passed.` : `${log.length - failed.length}/${log.length} passed. FAILED: ${failed.map((f) => f.label).join("; ")}`}`);
process.exit(failed.length === 0 ? 0 : 1);
