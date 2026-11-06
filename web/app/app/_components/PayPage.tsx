"use client";

import { useEffect, useState } from "react";
import { checkoutOrigin, useCheckoutHandBack, type CheckoutParams } from "@/lib/client/checkout";
import Image from "next/image";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "motion/react";
import { CHAINS, formatUsdt, type SwordSDK } from "sword-sdk";
import { Landmark, LockKeyhole, Smartphone, Store, Wallet } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { connectWallet, hasMetaMask, ownerSdk } from "@/lib/client/wallet";
import { payLink, walletPayUri } from "@/lib/shared/paylink";
import { cn } from "@/lib/utils";
import { Aurora, DetailRow, Logo, Method, Shimmer, Spinner, SuccessMark } from "./kit";
import { PaymentSuccess, type PaymentStage } from "./PaymentSuccess";
import { SwordPay } from "./SwordPay";
import { FiatPay, ModeGroup, paidWithText, type PaidWith, type PayMode } from "./Fiat";
import { CopyButton, errorText, notify, short, StatusBadge, usdt } from "./shared";
import { ChainToken, Token, useToken } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

type PayOrder = {
  chainId: number;
  merchant: string;
  orderId: string;
  reference: string | null;
  amount: string;
  status: string;
  open: boolean;
  expiresAt: string;
  /// The order's own address. A wallet pays the order by sending the exact amount here.
  collector: string;
  /// In checkout mode: whether the site that opened this page may be told the result.
  originAllowed?: boolean;
  /// Set when it was paid in local money.
  paidWith?: PaidWith;
};

/// A wallet or account payment has its transaction; a bank payment has what was paid in local money.
type Done = { hash: string; fiat?: { currency: string; fiatAmount: string } };

const ORDER_WINDOW_SECONDS = 20 * 60;

/// The public payment page. Three ways to pay: a Sword account, a sign-in to a Sword account, or a wallet.
export function PayPage({ chainId, merchant, orderId, checkout }: { chainId: number; merchant: string; orderId: string; checkout?: CheckoutParams }) {
  const [order, setOrder] = useState<PayOrder | undefined>();
  const [qr, setQr] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | undefined>();
  const [wallet, setWallet] = useState<Address | undefined>();
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "paying" | "done">("idle");
  const [done, setDone] = useState<Done | undefined>();
  // Funds arrived by wallet transfer, but this merchant confirms payments itself.
  const [received, setReceived] = useState(false);
  const [celebrate, setCelebrate] = useState<PaymentStage>("hidden");
  // Which way to pay is open; the other is minimized to one row.
  const [mode, setMode] = useState<PayMode>("crypto");
  const origin = checkoutOrigin(checkout);
  const handBack = useCheckoutHandBack(checkout, order?.originAllowed);

  async function loadOrder() {
    try {
      const res = await fetch(`/api/pay/order?chain=${chainId}&merchant=${merchant}&order=${orderId}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`);
      const data = (await res.json()) as PayOrder & { error?: { message: string } };
      if (!res.ok) throw new Error(data.error?.message ?? "Could not load the order");
      setOrder(data);
    } catch (err) {
      setLoadError(errorText(err, "Could not load the order"));
    }
  }

  useEffect(() => {
    void loadOrder();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
    // load once for this link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In checkout mode, tell the store once the order is paid, whichever way it was paid (or if it already was).
  const settled = celebrate === "success" || (order !== undefined && ["paid", "partially_refunded", "refunded"].includes(order.status));
  useEffect(() => {
    if (settled) handBack({ type: "paid", orderId, merchant, txHash: done?.hash || undefined });
  }, [settled, handBack, orderId, merchant, done?.hash]);

  // The QR is a wallet payment request: network, USDT, the order's address, and the exact amount.
  useEffect(() => {
    if (!order?.collector) return;
    QRCode.toDataURL(walletPayUri(chainId, CHAINS[chainId].addresses.usdt, order.collector, order.amount), {
      margin: 1,
      width: 320,
      color: { dark: "#0b0b12", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, [chainId, order?.collector, order?.amount]);

  // While the order is open, watch for a wallet transfer. The relayer marks the order paid when it arrives.
  const watching = !!order?.open && step !== "done";
  useEffect(() => {
    if (!watching) return;
    let live = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/pay/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chainId, merchant, orderId }),
        });
        const data = (await res.json()) as { status: string; paid: boolean; hash?: string };
        if (!live) return;
        if (data.paid) {
          setDone({ hash: data.hash ?? "" });
          setStep("done");
          setCelebrate("success");
          void loadOrder();
        } else if (data.status === "received") {
          setReceived(true);
        }
      } catch {
        // try again on the next tick
      }
    };
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
    // the order identity is fixed for this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching]);

  /// Connects the payer's wallet, for wallet payments and self-custody accounts.
  async function connect() {
    setConnecting(true);
    try {
      setWallet(await connectWallet(chainId));
    } catch (err) {
      notify("error", errorText(err, "Could not connect the wallet"));
    } finally {
      setConnecting(false);
    }
  }

  /// Pays from a wallet: approve the amount if needed, then pay the order.
  async function payFromWallet() {
    if (!order) return;
    try {
      const account: Address = wallet ?? (await connectWallet(chainId));
      setWallet(account);
      const sdk: SwordSDK = ownerSdk(chainId, account);
      const amount = BigInt(order.amount);
      setStep("approving");
      if ((await sdk.payments.allowance(account)) < amount) {
        await sdk.payments.approve(formatUsdt(amount));
      }
      setStep("paying");
      const tx = await sdk.payments.payOrder({ merchant: merchant as Address, orderId: orderId as `0x${string}` });
      setDone({ hash: tx.hash });
      setStep("done");
      setCelebrate("success");
      await loadOrder();
    } catch (err) {
      setStep("idle");
      notify("error", errorText(err, "Payment failed"));
    }
  }

  const left = order ? Math.max(0, Number(order.expiresAt) - now / 1000) : 0;
  const mins = Math.floor(left / 60);
  const secs = Math.floor(left % 60).toString().padStart(2, "0");
  const payable = !!order?.open && left > 0 && step !== "done";
  const amountText = order ? usdt(order.amount) : "";
  const chainName = CHAINS[chainId]?.chain.name ?? "Whitechain";
  const busy = step === "approving" || step === "paying";

  return (
    <ChainToken chainId={chainId}>
    <div className="relative flex min-h-screen flex-col">
      <PaymentSuccess
        stage={celebrate}
        amount={order ? Number(order.amount) / 1e6 : 0}
        subtitle={order?.reference ? `Paid for ${order.reference}` : undefined}
        doneLabel={checkout && order?.originAllowed ? "Back to store" : "Done"}
        onDone={() => (checkout && order?.originAllowed && window.opener ? window.close() : setCelebrate("hidden"))}
        details={[
          { label: "Paid to", value: <span className="font-mono text-xs">{short(merchant, 6, 4)}</span> },
          { label: "Order", value: <span className="font-mono text-xs">{short(orderId, 6, 4)}</span> },
          { label: "Network", value: chainName },
          ...(done?.hash ? [{ label: "Transaction", value: <span className="font-mono text-xs">{short(done.hash, 6, 4)}</span> }] : []),
          ...(done?.fiat ? [{ label: "Paid", value: paidWithText({ ...done.fiat, rate: "", country: null, reference: "", at: "" }) }] : []),
        ]}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <Logo withText />
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft sm:inline-flex">
            <LockKeyhole className="size-3.5" /> Secure checkout
          </span>
          <CopyButton
            value={typeof window === "undefined" ? "" : payLink(window.location.origin, chainId, merchant, orderId)}
            label="Payment link"
            className="h-8 rounded-full border bg-card px-3 text-foreground shadow-soft"
          />
          <ModeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid w-full max-w-4xl overflow-hidden rounded-[28px] border bg-card shadow-lift md:grid-cols-[1fr_1.1fr]"
        >
          {/* Summary */}
          <section className="relative overflow-hidden bg-[oklch(0.17_0.03_275)] p-6 text-white md:p-8">
            <Aurora />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                  <span className="grid size-8 place-items-center rounded-xl bg-white/10">
                    <Store className="size-4" />
                  </span>
                  <span className="font-mono">{short(merchant, 6, 4)}</span>
                </span>
                {order && <StatusBadge status={order.status} className="bg-white/10 text-white ring-white/15" />}
              </div>

              <div className="mt-10">
                <p className="text-sm text-white/60">{order?.reference ? `Payment for ${order.reference}` : "Payment request"}</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
                  {order ? amountText : <span className="inline-block h-12 w-40 animate-pulse rounded-xl bg-white/10 align-middle" />}{" "}
                  <span className="text-lg font-medium text-white/60"><Token /></span>
                </p>
                <p className="mt-2 text-xs text-white/50">on {chainName}</p>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <CountdownRing fraction={order ? left / ORDER_WINDOW_SECONDS : 1} label={payable ? `${mins}:${secs}` : order && !order.open ? "Closed" : "–"} />
                <div className="text-sm">
                  <p className="font-medium">{payable ? "Time left to pay" : order && !order.open ? "No longer accepting payment" : "Loading"}</p>
                  <p className="text-xs text-white/55">Orders stay open for 20 minutes.</p>
                </div>
              </div>

              {order?.open && (
                <div className="mt-auto flex flex-col gap-4 pt-10 sm:flex-row sm:items-center">
                  <div className="self-start rounded-2xl bg-white p-2 shadow-xl">
                    {qr ? <Image src={qr} alt="Wallet payment QR code" width={128} height={128} unoptimized className="rounded-lg" /> : <div className="size-32 animate-pulse rounded-lg bg-white/20" />}
                  </div>
                  <div className="min-w-0 space-y-2 text-sm">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Smartphone className="size-4" /> Scan with any wallet
                    </p>
                    <p className="text-xs text-white/55">Network, amount, and address fill in by themselves. We confirm the payment for you.</p>
                    <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
                      <span className="truncate font-mono text-[11px] text-white/80">{short(order.collector, 8, 6)}</span>
                      <CopyButton value={order.collector} label="" className="h-6 px-1.5 text-white/70 hover:bg-white/10 hover:text-white" />
                    </div>
                    {received && <p className="text-xs text-amber-300">Payment received. Waiting for the merchant to confirm.</p>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {step === "done" && done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex h-full flex-col items-center justify-center py-8 text-center">
                  <SuccessMark size={76} />
                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">Payment sent</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {done.fiat ? paidWithText({ ...done.fiat, rate: "", country: null, reference: "", at: "" }) : <>{amountText} <Token /></>} paid to {short(merchant, 6, 4)}
                  </p>
                  {done.hash && (
                    <div className="mt-6 flex w-full items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                      <span className="truncate font-mono text-xs text-muted-foreground">{short(done.hash, 12, 10)}</span>
                      <CopyButton value={done.hash} label="" />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Choose how to pay</h2>
                    <p className="mt-1 text-sm text-muted-foreground">You pay the exact amount. Nothing else is charged.</p>
                  </div>

                  {loadError && <p className="rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">{loadError}</p>}
                  {order && !order.open && <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">This order is no longer accepting payments.</p>}

                  {!order && !loadError && (
                    <div className="space-y-3">
                      <Shimmer className="h-24" rounded="rounded-2xl" />
                      <Shimmer className="h-24" rounded="rounded-2xl" />
                    </div>
                  )}

                  {payable && (
                    <div className="flex flex-col gap-3">
                      <ModeGroup
                        mode="crypto"
                        active={mode}
                        onPick={setMode}
                        icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><Wallet className="size-4" /></span>}
                        title="Pay with crypto"
                        subtitle="Sword account or a crypto wallet"
                      >
                      <Method icon={<Logo size={36} />} title="Sword account" subtitle="Pay from your balance in one tap" recommended>
                        <SwordPay
                          chainId={chainId}
                          label={`Pay ${amountText} ${tokenOf(chainId)}`}
                          amount={Number(order?.amount ?? 0) / 1e6}
                          action={{
                            relayer: () => api("/api/orders/pay", { chainId, merchantAddress: merchant, orderId }),
                            owner: async (sdk, account) => ({
                              hash: (await sdk.accounts.customer.payOrder({ account: account.address as Address, merchant: merchant as Address, orderId: orderId as `0x${string}` })).hash,
                              data: {},
                            }),
                            record: (r) => ({ type: "order.paid", details: { chainId, orderId, merchant }, txHash: r.hash }),
                          }}
                          onStart={() => {
                            setStep("paying");
                            setCelebrate("confirming");
                          }}
                          onDone={(r) => {
                            setDone({ hash: r.hash });
                            setStep("done");
                            setCelebrate("success");
                            void loadOrder();
                          }}
                          onError={(err) => {
                            setCelebrate("hidden");
                            setStep("idle");
                            notify("error", errorText(err, "Payment failed"));
                          }}
                        />
                      </Method>

                      <Method
                        icon={
                          <span className="grid size-9 place-items-center rounded-xl bg-muted">
                            <Wallet className="size-4" />
                          </span>
                        }
                        title="Crypto wallet"
                        subtitle={wallet ? `Connected ${short(wallet, 6, 4)}` : `MetaMask on ${chainName}`}
                      >
                        {!hasMetaMask() ? (
                          <p className="text-sm text-muted-foreground">Install the MetaMask extension to pay from this browser.</p>
                        ) : !wallet ? (
                          <Button size="lg" variant="outline" className="h-11 w-full rounded-xl" onClick={connect} disabled={connecting}>
                            {connecting ? <Spinner /> : <Wallet className="size-4" />}
                            {connecting ? "Connecting…" : "Connect wallet"}
                          </Button>
                        ) : (
                          <>
                            <Button size="lg" variant="outline" className="h-11 w-full rounded-xl" disabled={busy} onClick={payFromWallet}>
                              {(step === "approving" || step === "paying") && <Spinner />}
                              {step === "approving" ? "Approve in wallet…" : step === "paying" ? "Confirm payment in wallet…" : `Pay ${amountText} ${tokenOf(chainId)} with wallet`}
                            </Button>
                            <WalletSteps step={step} />
                          </>
                        )}
                      </Method>
                      </ModeGroup>

                      <ModeGroup
                        mode="bank"
                        active={mode}
                        onPick={setMode}
                        icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><Landmark className="size-4" /></span>}
                        title="Pay by bank transfer"
                        subtitle="In your own currency: UPI, SEPA, Pix, M-Pesa and more"
                      >
                      <Method
                        icon={
                          <span className="grid size-9 place-items-center rounded-xl bg-muted">
                            <Landmark className="size-4" />
                          </span>
                        }
                        title="Bank transfer"
                        subtitle="Pay in your own currency: UPI, SEPA, Pix, M-Pesa and more"
                      >
                        <FiatPay
                          amount={Number(order?.amount ?? 0) / 1e6}
                          token={tokenOf(chainId)}
                          seed={orderId}
                          onPay={async ({ country, reference }) => {
                            const r = await api<{ paid: boolean; currency?: string; fiatAmount?: string }>("/api/fiat/pay", { kind: "order", chainId, merchant, orderId, country, reference });
                            setDone({ hash: "", fiat: r.currency && r.fiatAmount ? { currency: r.currency, fiatAmount: r.fiatAmount } : undefined });
                            setStep("done");
                            setCelebrate("success");
                            void loadOrder();
                          }}
                        />
                      </Method>
                      </ModeGroup>
                    </div>
                  )}

                  {order && (
                    <div className="divide-y rounded-xl border px-4">
                      <DetailRow label="Pay to" mono>
                        {short(merchant, 10, 6)}
                      </DetailRow>
                      <DetailRow label="Order" mono>
                        {short(orderId, 10, 6)}
                      </DetailRow>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </motion.div>
      </main>
    </div>
    </ChainToken>
  );
}

/// The two wallet confirmations, so the payer knows what to expect.
function WalletSteps({ step }: { step: "idle" | "approving" | "paying" | "done" }) {
  const token = useToken();
  const items = [
    { id: "approving", label: `Approve ${token}` },
    { id: "paying", label: "Confirm payment" },
  ];
  const at = step === "approving" ? 0 : step === "paying" ? 1 : -1;
  return (
    <ol className="flex items-center gap-2 text-[11px] text-muted-foreground">
      {items.map((it, i) => (
        <li key={it.id} className="flex items-center gap-2">
          <span className={cn("grid size-4 place-items-center rounded-full border text-[9px] font-semibold", i < at && "border-success bg-success text-white", i === at && "border-brand text-brand")}>{i + 1}</span>
          <span className={cn(i === at && "font-medium text-foreground")}>{it.label}</span>
          {i < items.length - 1 && <span className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

/// A ring that empties as the payment window runs out.
function CountdownRing({ fraction, label }: { fraction: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="5" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke={f < 0.1 ? "oklch(0.7 0.19 25)" : "oklch(0.85 0.12 290)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ duration: 0.8, ease: "linear" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-medium tabular-nums">{label}</span>
    </div>
  );
}
