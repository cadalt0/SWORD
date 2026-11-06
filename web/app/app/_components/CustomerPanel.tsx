"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock3, Link2, Receipt, RotateCcw, ScanLine, Send, Store, Wallet2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import { runAction } from "@/lib/client/actions";
import type { Address } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { DetailRow, FadeIn, IconChip, Segmented, Spinner, SuccessMark } from "./kit";
import { PaymentSuccess, type PaymentStage } from "./PaymentSuccess";
import { QrScanner, type ScanTarget } from "./QrScanner";
import { CopyButton, decimal, errorText, money, notify, short, StatusBadge, usdt } from "./shared";
import { Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

type PayOrder = { merchant: string; orderId: string; reference: string | null; amount: string; status: string; open: boolean; expiresAt: string };

/// Reads merchant and order from a pasted pay link. Returns undefined when the text is not a pay link.
function parseLink(text: string): { merchant: string; order: string } | undefined {
  try {
    const url = new URL(text.trim());
    const merchant = url.searchParams.get("merchant");
    const order = url.searchParams.get("order");
    return merchant && order ? { merchant, order } : undefined;
  } catch {
    return undefined;
  }
}

/// Public order details, the same ones the pay page shows.
async function fetchOrder(chainId: number, merchant: string, orderId: string): Promise<PayOrder> {
  const res = await fetch(`/api/pay/order?chain=${chainId}&merchant=${merchant}&order=${orderId}`);
  const data = (await res.json()) as PayOrder & { error?: { message: string } };
  if (!res.ok) throw new Error(data.error?.message ?? "Could not find this order");
  return data;
}

const slide = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

type PanelProps = {
  chainId: number;
  account: Account;
  wallet: Address | undefined;
  section: "overview" | "pay" | "refunds";
  /// Merchant and order from a pay link, so the form is already filled in.
  prefill?: { merchant?: string; order?: string };
  /// A scanned QR from the home screen: a pay link or an address.
  target?: ScanTarget;
};

/// Customer sections. Pay: send to an address, or pay a merchant order, from a typed entry or a scanned QR.
/// Refunds: ask the merchant for a refund on an order.
export function CustomerPanel(props: PanelProps) {
  const { section, prefill, target } = props;
  const fromLink = !!(prefill?.merchant && prefill?.order);
  const [mode, setMode] = useState<"send" | "order">(target?.kind === "order" || (!target && fromLink) ? "order" : "send");
  const [scanned, setScanned] = useState<ScanTarget | undefined>(target);
  const [scanning, setScanning] = useState(false);
  const [round, setRound] = useState(0);

  if (section === "refunds") return <OrderFlow {...props} />;

  const orderPrefill = scanned?.kind === "order" ? { merchant: scanned.merchant, order: scanned.order } : prefill;

  return (
    <div className="mx-auto max-w-lg">
      <FadeIn className="mb-6 text-center">
        <IconChip icon={Send} tone="brand" size="lg" className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pay</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send <Token /> to any address, or pay a merchant order.</p>
      </FadeIn>

      <FadeIn delay={0.05} className="mb-4 flex items-center justify-between gap-2">
        <Segmented
          id="pay-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "send", label: "Send", icon: Send },
            { value: "order", label: "Pay order", icon: Receipt },
          ]}
        />
        <Button variant="outline" className="h-10 gap-1.5 rounded-xl" onClick={() => setScanning(true)}>
          <ScanLine className="size-4" /> Scan QR
        </Button>
      </FadeIn>

      {mode === "send" ? (
        <SendFlow key={`send-${round}`} {...props} to={scanned?.kind === "address" ? scanned.address : ""} presetAmount={scanned?.kind === "address" ? scanned.amount : undefined} />
      ) : (
        <OrderFlow key={`order-${round}`} {...props} prefill={orderPrefill} hideHeader />
      )}

      <QrScanner
        open={scanning}
        onOpenChange={setScanning}
        onResult={(t) => {
          setScanned(t);
          setMode(t.kind === "address" ? "send" : "order");
          setRound((r) => r + 1);
        }}
      />
    </div>
  );
}

/// Sends USDT from the customer's account to a plain address.
function SendFlow({ chainId, account, wallet, to: initialTo, presetAmount }: PanelProps & { to: string; presetAmount?: string }) {
  const [to, setTo] = useState(initialTo);
  const [amount, setAmount] = useState(presetAmount ?? "");
  const [step, setStep] = useState<"enter" | "review" | "done">("enter");
  const [hash, setHash] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<PaymentStage>("hidden");

  const base = { chainId, account: { address: account.address, owner: account.owner, custody: account.custody }, wallet };
  const needsWallet = account.custody === "self" && !wallet;
  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to.trim());
  const validAmount = Number(amount) > 0;

  async function send() {
    setBusy(true);
    setCelebrate("confirming");
    try {
      const recipient = to.trim();
      const r = await runAction({
        ...base,
        relayer: () => api("/api/send", { chainId, to: recipient, amount }),
        owner: async (sdk) => ({ hash: (await sdk.accounts.sendUsdt({ account: account.address, to: recipient, amount })).hash, data: {} }),
        record: (res) => ({ type: "funds.sent", details: { chainId, to: recipient, amount }, txHash: res.hash }),
      });
      setHash(r.hash);
      setStep("done");
      setCelebrate("success");
    } catch (err) {
      setCelebrate("hidden");
      notify("error", errorText(err, "Transfer failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <PaymentSuccess
        stage={celebrate}
        amount={Number(amount) || 0}
        title="Money sent"
        subtitle={`To ${short(to.trim(), 6, 4)}`}
        onDone={() => setCelebrate("hidden")}
        details={[
          { label: "To", value: <span className="font-mono text-xs">{short(to.trim(), 6, 4)}</span> },
          { label: "From", value: account.custody === "self" ? "Your wallet-owned account" : "Your Sword account" },
          { label: "Network fee", value: "Paid by Sword" },
          ...(hash ? [{ label: "Transaction", value: <span className="font-mono text-xs">{short(hash, 6, 4)}</span> }] : []),
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        {step === "enter" && (
          <motion.div key="enter" {...slide} className="space-y-5 p-5 md:p-6">
            <div className="space-y-2">
              <Label htmlFor="send-to">To</Label>
              <div className="relative">
                <Wallet2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="send-to" className="h-11 rounded-xl pl-9 font-mono text-sm" placeholder="0x… recipient address" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              {to && !validTo && <p className="text-xs text-destructive">That is not a valid address.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-amount">Amount</Label>
              <div className="relative">
                <Input id="send-amount" inputMode="decimal" placeholder="0.00" className="h-14 rounded-xl pr-16 text-2xl font-semibold tabular-nums md:text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"><Token /></span>
              </div>
              <div className="flex gap-2">
                {["5", "10", "25", "50"].map((v) => (
                  <button key={v} type="button" onClick={() => setAmount(v)} className={cn("rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors", amount === v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={!validTo || !validAmount} onClick={() => setStep("review")}>
              Review <ArrowRight className="size-4" />
            </Button>
          </motion.div>
        )}

        {step === "review" && (
          <motion.div key="review" {...slide}>
            <div className="relative overflow-hidden border-b bg-muted/30 px-5 pb-6 pt-5 text-center md:px-6">
              <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setStep("enter")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-3.5" /> Back
                  </button>
                </div>
                <p className="mt-4 text-xs font-medium text-muted-foreground">You send</p>
                <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                  {money(amount || 0)} <span className="text-lg font-medium text-muted-foreground"><Token /></span>
                </p>
              </div>
            </div>
            <div className="space-y-5 p-5 md:p-6">
              <div className="divide-y rounded-xl border px-4">
                <DetailRow label="To" mono>
                  {short(to.trim(), 8, 6)}
                </DetailRow>
                <DetailRow label="From">{account.custody === "self" ? "Your wallet-owned account" : "Your Sword account"}</DetailRow>
                <DetailRow label="Network fee">Paid by Sword</DetailRow>
              </div>
              <p className="text-xs text-muted-foreground">Transfers on chain can&apos;t be reversed. Check the address before you send.</p>
              <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={busy || needsWallet} onClick={() => void send()}>
                {busy && <Spinner />}
                {busy ? "Sending…" : needsWallet ? "Connect wallet to send" : `Send ${money(amount || 0)} ${tokenOf(chainId)}`}
              </Button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" {...slide} className="space-y-5 p-6 text-center md:p-8">
            <SuccessMark />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Sent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {money(amount || 0)} <Token /> to {short(to.trim(), 6, 4)}
              </p>
            </div>
            {hash && (
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                <span className="truncate font-mono text-xs text-muted-foreground">{short(hash, 10, 8)}</span>
                <CopyButton value={hash} label="" />
              </div>
            )}
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => {
                setStep("enter");
                setAmount("");
                setHash(undefined);
              }}
            >
              Send again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/// Paying a merchant order, or asking for a refund on one.
function OrderFlow({
  chainId,
  account,
  wallet,
  section,
  prefill,
  hideHeader = false,
}: PanelProps & { hideHeader?: boolean }) {
  const [merchant, setMerchant] = useState(prefill?.merchant ?? "");
  const [orderId, setOrderId] = useState(prefill?.order ?? "");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState<PayOrder | undefined>();
  const [looking, setLooking] = useState(false);
  const [step, setStep] = useState<"enter" | "review" | "done">("enter");
  const [hash, setHash] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<PaymentStage>("hidden");

  const base = { chainId, account: { address: account.address, owner: account.owner, custody: account.custody }, wallet };
  const needsWallet = account.custody === "self" && !wallet;

  async function lookUp() {
    setLooking(true);
    try {
      const found = await fetchOrder(chainId, merchant, orderId);
      setOrder(found);
      if (section === "refunds" && !amount) setAmount(decimal(Number(found.amount) / 1e6));
      setStep("review");
    } catch (err) {
      notify("error", errorText(err, "Could not find this order"));
    } finally {
      setLooking(false);
    }
  }

  // A pay link opened while signed in goes straight to the review.
  useEffect(() => {
    if (!prefill?.merchant || !prefill?.order) return;
    fetchOrder(chainId, prefill.merchant, prefill.order)
      .then((found) => {
        setOrder(found);
        setStep("review");
      })
      .catch((err) => notify("error", errorText(err, "Could not find this order")));
    // only for the link this page was opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onLink(text: string) {
    setLink(text);
    const parsed = parseLink(text);
    if (parsed) {
      setMerchant(parsed.merchant);
      setOrderId(parsed.order);
    }
  }

  function reset() {
    setStep("enter");
    setOrder(undefined);
    setHash(undefined);
    setLink("");
    setReason("");
    setAmount("");
  }

  async function act(label: string, fn: () => Promise<{ hash: string }>) {
    const payment = label === "Payment";
    setBusy(true);
    if (payment) setCelebrate("confirming");
    try {
      const r = await fn();
      setHash(r.hash);
      setStep("done");
      if (payment) setCelebrate("success");
      else notify("success", `${label} confirmed`);
    } catch (err) {
      setCelebrate("hidden");
      notify("error", errorText(err, `${label} failed`));
    } finally {
      setBusy(false);
    }
  }

  const pay = () =>
    act("Payment", () =>
      runAction({
        ...base,
        relayer: () => api("/api/orders/pay", { chainId, merchantAddress: merchant, orderId }),
        owner: async (sdk) => ({
          hash: (await sdk.accounts.customer.payOrder({ account: account.address as Address, merchant: merchant as Address, orderId: orderId as `0x${string}` })).hash,
          data: {},
        }),
        record: (r) => ({ type: "order.paid", details: { chainId, orderId, merchant }, txHash: r.hash }),
      }),
    );

  const requestRefund = () =>
    act("Refund request", () =>
      runAction({
        ...base,
        relayer: () => api("/api/refunds", { chainId, action: "request", merchantAddress: merchant, orderId, amount, reason }),
        owner: async (sdk) => ({
          hash: (
            await sdk.accounts.customer.requestOrderRefund({
              account: account.address as Address,
              merchant: merchant as Address,
              orderId: orderId as `0x${string}`,
              amount,
              reason,
            })
          ).hash,
          data: {},
        }),
        record: (r) => ({ type: "refund.requested", details: { chainId, orderId, amount }, txHash: r.hash }),
      }),
    );

  const isPay = section !== "refunds";

  return (
    <div className={cn(!hideHeader && "mx-auto max-w-lg")}>
      <PaymentSuccess
        stage={celebrate}
        amount={order ? Number(order.amount) / 1e6 : 0}
        subtitle={order?.reference ? `Paid for ${order.reference}` : undefined}
        onDone={() => setCelebrate("hidden")}
        details={[
          { label: "Paid to", value: <span className="font-mono text-xs">{short(merchant, 6, 4)}</span> },
          { label: "Order", value: <span className="font-mono text-xs">{short(orderId, 6, 4)}</span> },
          ...(hash ? [{ label: "Transaction", value: <span className="font-mono text-xs">{short(hash, 6, 4)}</span> }] : []),
        ]}
      />
      {!hideHeader && (
      <FadeIn className="mb-6 text-center">
        <IconChip icon={isPay ? Receipt : RotateCcw} tone={isPay ? "brand" : "warning"} size="lg" className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{isPay ? "Pay an order" : "Request a refund"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPay ? "Paste the pay link from the merchant, or enter the IDs." : "The merchant reviews your request and refunds you on chain."}
        </p>
      </FadeIn>
      )}

      <div className="surface-card overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === "enter" && (
            <motion.div key="enter" {...slide} className="space-y-5 p-5 md:p-6">
              <div className="space-y-2">
                <Label htmlFor="link">Pay link</Label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="link" className="h-11 rounded-xl pl-9" placeholder="https://…/pay?merchant=…&order=…" value={link} onChange={(e) => onLink(e.target.value)} />
                </div>
                <AnimatePresence>
                  {parseLink(link) && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-success">
                      Link recognised. Merchant and order filled in.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or enter IDs <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="merchant">Merchant ID</Label>
                  <Input id="merchant" className="h-11 rounded-xl font-mono text-sm" placeholder="0x…" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Order ID</Label>
                  <Input id="order" className="h-11 rounded-xl font-mono text-sm" placeholder="0x…" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
                </div>
              </div>

              <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={looking || !merchant || !orderId} onClick={() => void lookUp()}>
                {looking ? <Spinner /> : null}
                {looking ? "Finding order…" : "Continue"}
                {!looking && <ArrowRight className="size-4" />}
              </Button>
            </motion.div>
          )}

          {step === "review" && order && (
            <motion.div key="review" {...slide}>
              <div className="relative overflow-hidden border-b bg-muted/30 px-5 pb-6 pt-5 text-center md:px-6">
                <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setStep("enter")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="size-3.5" /> Back
                    </button>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-4 text-xs font-medium text-muted-foreground">{isPay ? "You pay" : "Order total"}</p>
                  <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                    {usdt(order.amount)} <span className="text-lg font-medium text-muted-foreground"><Token /></span>
                  </p>
                  {order.reference && <p className="mt-2 text-sm text-muted-foreground">Reference {order.reference}</p>}
                </div>
              </div>

              <div className="space-y-5 p-5 md:p-6">
                <div className="divide-y rounded-xl border px-4">
                  <DetailRow label="Merchant">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <Store className="size-3.5 text-muted-foreground" /> {short(order.merchant, 6, 4)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Order" mono>
                    {short(order.orderId, 6, 4)}
                  </DetailRow>
                  {isPay && (
                    <DetailRow label="Time left">
                      <Countdown expiresAt={order.expiresAt} open={order.open} />
                    </DetailRow>
                  )}
                  <DetailRow label="Paid from">{account.custody === "self" ? "Your wallet-owned account" : "Your Sword account"}</DetailRow>
                </div>

                {!isPay && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="refund-amount">Amount to refund</Label>
                      <div className="relative">
                        <Input id="refund-amount" inputMode="decimal" className="h-12 rounded-xl pr-16 text-lg font-semibold tabular-nums md:text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"><Token /></span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 0.5, 0.25].map((f) => (
                          <button key={f} type="button" onClick={() => setAmount(decimal((Number(order.amount) / 1e6) * f))} className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                            {f === 1 ? "Full" : `${f * 100}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason</Label>
                      <div className="flex flex-wrap gap-2">
                        {["Item not received", "Wrong item", "Damaged", "Changed my mind"].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setReason(r)}
                            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", reason === r ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <Textarea id="reason" rows={2} className="rounded-xl" placeholder="Tell the merchant what happened" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                  </div>
                )}

                {isPay ? (
                  <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={busy || !order.open || needsWallet} onClick={pay}>
                    {busy && <Spinner />}
                    {busy ? "Paying…" : needsWallet ? "Connect wallet to pay" : !order.open ? "Order is closed" : `Pay ${usdt(order.amount)} ${tokenOf(chainId)}`}
                  </Button>
                ) : (
                  <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={busy || !amount || !reason || needsWallet} onClick={requestRefund}>
                    {busy && <Spinner />}
                    {busy ? "Sending…" : needsWallet ? "Connect wallet to send" : "Send refund request"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div key="done" {...slide} className="space-y-5 p-6 text-center md:p-8">
              <SuccessMark />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{isPay ? "Payment sent" : "Request sent"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPay ? `${order ? usdt(order.amount) : ""} ${tokenOf(chainId)} paid to ${short(merchant, 6, 4)}` : "The merchant will review it. You'll see the refund in your activity."}
                </p>
              </div>
              {hash && (
                <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                  <span className="truncate font-mono text-xs text-muted-foreground">{short(hash, 10, 8)}</span>
                  <CopyButton value={hash} label="" />
                </div>
              )}
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={reset}>
                {isPay ? "Pay another order" : "New request"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/// Minutes and seconds until the order stops accepting payment.
function Countdown({ expiresAt, open }: { expiresAt: string; open: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Number(expiresAt) - now / 1000);
  if (!open || left === 0) return <span className="text-muted-foreground">Closed</span>;
  const urgent = left < 120;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs tabular-nums", urgent && "text-destructive")}>
      <Clock3 className="size-3.5" />
      {Math.floor(left / 60)}:{Math.floor(left % 60).toString().padStart(2, "0")}
    </span>
  );
}
