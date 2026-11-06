"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "motion/react";
import { CHAINS } from "sword-sdk";
import { ArrowLeft, ChevronDown, Clock3, Delete, Landmark, Smartphone, Zap } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { runAction } from "@/lib/client/actions";
import type { Address } from "@/lib/client/types";
import { walletPayUri } from "@/lib/shared/paylink";
import { cn } from "@/lib/utils";
import type { Account, Me } from "../app/_components/Dashboard";
import { Aurora, DetailRow, EmptyState, LoadingState, Logo, Shimmer, Spinner, SuccessMark } from "../app/_components/kit";
import { CopyButton, errorText, money, notify, short } from "../app/_components/shared";
import { PaymentSuccess, type PaymentStage } from "../app/_components/PaymentSuccess";
import { WalletButton } from "../app/_components/WalletButton";
import { FiatPay, paidWithText } from "../app/_components/Fiat";
import { ChainToken, Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

type PayOrder = { amount: string; collector: string; expiresAt: string; open: boolean; status: string };
type Transfer = { payer: string; transferTime: string; txHash: string };
type Phase = "amount" | "waiting" | "paid" | "expired";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/// A merchant's point of sale. Create a one-off order, show a QR any wallet can pay, and see it marked paid.
export function QuickPayments() {
  const [me, setMe] = useState<Me | null | undefined>();
  const [wallet, setWallet] = useState<Address | undefined>();

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const account = me?.accounts.find((a) => a.kind === "merchant");

  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
      <header className="flex h-16 items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/app" className="grid size-9 place-items-center rounded-full border bg-card shadow-soft transition-colors hover:bg-muted" aria-label="Back to dashboard">
            <ArrowLeft className="size-4" />
          </Link>
          <Logo withText />
        </div>
        <div className="flex items-center gap-2">
          {account?.custody === "self" && <WalletButton chainId={account.chainId} wallet={wallet} onConnected={setWallet} />}
          <ModeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 pb-12 md:items-center">
        {me === undefined ? (
          <LoadingState label="Opening quick payments" />
        ) : !account ? (
          <EmptyState
            icon={Zap}
            title="Sign in as a merchant"
            description="Quick payments are for merchant accounts."
            action={
              <Link href="/app" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                Go to sign in
              </Link>
            }
          />
        ) : (
          <Register account={account} wallet={wallet} />
        )}
      </main>
    </div>
  );
}

/// The amount, then the QR, then the paid screen.
function Register({ account, wallet }: { account: Account; wallet: Address | undefined }) {
  const router = useRouter();
  const chainId = account.chainId;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("amount");
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | undefined>();
  const [order, setOrder] = useState<PayOrder | undefined>();
  const [qr, setQr] = useState<string | undefined>();
  const [received, setReceived] = useState<Transfer | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const [celebrate, setCelebrate] = useState<PaymentStage>("hidden");
  const [paidBy, setPaidBy] = useState<string | undefined>();
  const [paidAt, setPaidAt] = useState<Date | undefined>();
  const [reference, setReference] = useState("");
  /// The customer pays by bank transfer instead of scanning: what they paid in local money.
  const [byBank, setByBank] = useState(false);
  const [bankPaid, setBankPaid] = useState<{ currency: string; fiatAmount: string } | undefined>();

  const base = { chainId, account: { address: account.address, owner: account.owner, custody: account.custody }, wallet };
  const valid = Number(amount) > 0;

  function press(key: (typeof KEYS)[number]) {
    setAmount((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === "." && current.includes(".")) return current;
      if (current.includes(".") && current.split(".")[1].length >= 2) return current;
      if (current === "0" && key !== ".") return key;
      if (current.length >= 9) return current;
      return current === "" && key === "." ? "0." : current + key;
    });
  }

  async function create() {
    setBusy(true);
    try {
      const reference = note.trim() || `quick-${Date.now().toString(36)}`;
      setReference(reference);
      const r = await runAction({
        ...base,
        relayer: () => api("/api/orders", { chainId, reference, amount }),
        owner: async (sdk) => {
          if (account.eoa) {
            const relayer = (await api<{ relayer: string }>(`/api/permission?chainId=${chainId}`)).relayer as Address;
            const res = await sdk.orders.create({ merchant: account.address as Address, reference, amount, relayer });
            return { hash: res.transaction.hash, data: { orderId: res.orderId, collector: res.collector } };
          }
          const res = await sdk.accounts.merchant.createOrder({ account: account.address, reference, amount });
          return { hash: res.transaction.hash, data: { orderId: res.orderId, collector: res.collector } };
        },
        record: (res) => ({
          type: "order.created",
          details: { chainId, orderId: res.data.orderId },
          txHash: res.hash,
          order: { chainId, merchantAddress: account.address, orderId: res.data.orderId, reference, collector: res.data.collector, amount },
        }),
      });
      const id = String(r.data.orderId);
      const res = await fetch(`/api/pay/order?chain=${chainId}&merchant=${account.address}&order=${id}`);
      const data = (await res.json()) as PayOrder & { error?: { message: string } };
      if (!res.ok) throw new Error(data.error?.message ?? "Could not load the new order");
      setOrderId(id);
      setOrder(data);
      setReceived(undefined);
      setPhase("waiting");
    } catch (err) {
      notify("error", errorText(err, "Could not create the payment"));
    } finally {
      setBusy(false);
    }
  }

  // The QR every wallet understands: network, USDT, the order's address, and the exact amount.
  useEffect(() => {
    if (!order) return;
    QRCode.toDataURL(walletPayUri(chainId, CHAINS[chainId].addresses.usdt, order.collector, order.amount), {
      margin: 1,
      width: 480,
      color: { dark: "#0b0b12", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, [chainId, order]);

  // While waiting: a clock for the countdown, and a check for the payment every few seconds.
  useEffect(() => {
    if (phase !== "waiting" || !orderId) return;
    let live = true;
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const check = async () => {
      try {
        const res = await fetch("/api/pay/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chainId, merchant: account.address, orderId }),
        });
        const data = (await res.json()) as { status: string; paid: boolean; transfer?: Transfer; payer?: string };
        if (!live) return;
        if (data.paid) {
          setPaidBy(data.payer);
          setPaidAt(new Date());
          setPhase("paid");
          setCelebrate("success");
        } else if (data.status === "received" && data.transfer) {
          setReceived(data.transfer);
        } else if (data.status === "expired" || data.status === "late" || data.status === "failed") {
          setPhase("expired");
        }
      } catch {
        // try again on the next tick
      }
    };
    const poll = window.setInterval(() => void check(), 4000);
    return () => {
      live = false;
      window.clearInterval(clock);
      window.clearInterval(poll);
    };
  }, [phase, orderId, chainId, account.address]);

  /// For merchants whose wallet confirms payments itself: confirm the transfer that arrived.
  async function confirmYourself() {
    if (!received || !orderId) return;
    setBusy(true);
    setCelebrate("confirming");
    try {
      await runAction({
        ...base,
        relayer: () => api("/api/pay/confirm", { chainId, merchant: account.address, orderId }),
        owner: async (sdk) => {
          const input = { orderId: orderId as `0x${string}`, payer: received.payer, transferTime: BigInt(received.transferTime), txHash: received.txHash as `0x${string}` };
          const tx = account.eoa
            ? await sdk.orders.confirmTransfer({ merchant: account.address, ...input })
            : await sdk.accounts.merchant.confirmTransfer({ account: account.address, ...input });
          return { hash: tx.hash, data: {} };
        },
        record: (r) => ({ type: "order.paid", details: { chainId, orderId, payer: received.payer, via: "transfer" }, txHash: r.hash }),
      });
      setPaidBy(received.payer);
      setPaidAt(new Date());
      setPhase("paid");
      setCelebrate("success");
    } catch (err) {
      setCelebrate("hidden");
      notify("error", errorText(err, "Could not confirm the payment"));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCelebrate("hidden");
    setPaidBy(undefined);
    setByBank(false);
    setBankPaid(undefined);
    setPhase("amount");
    setAmount("");
    setNote("");
    setOrder(undefined);
    setOrderId(undefined);
    setQr(undefined);
    setReceived(undefined);
  }

  const left = order ? Math.max(0, Number(order.expiresAt) - now / 1000) : 0;
  const shown = Number(amount || "0");

  return (
    <ChainToken chainId={chainId}>
    <>
    <PaymentSuccess
      stage={celebrate}
      amount={order ? Number(order.amount) / 1e6 : 0}
      title="Payment received"
      subtitle={CHAINS[chainId]?.chain.name}
      redirectText="Redirecting to your dashboard…"
      onDone={() => router.push("/app")}
      details={[
        ...(paidBy ? [{ label: "Paid by", value: <span className="font-mono text-xs">{short(paidBy, 6, 4)}</span> }] : []),
        ...(bankPaid ? [{ label: "Paid", value: paidWithText({ ...bankPaid, rate: "", country: null, reference: "", at: "" }) }] : []),
        { label: "Reference", value: reference },
        ...(orderId ? [{ label: "Order", value: <span className="font-mono text-xs">{short(orderId, 6, 4)}</span> }] : []),
        ...(paidAt ? [{ label: "Time", value: paidAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) }] : []),
      ]}
    />
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md overflow-hidden rounded-[28px] border bg-card shadow-lift"
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative overflow-hidden bg-[oklch(0.17_0.03_275)] px-6 pb-8 pt-6 text-center text-white">
              <Aurora />
              <div className="relative">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-white/60">
                  <Zap className="size-3.5" /> Quick payment
                </p>
                <p className="mt-5 text-6xl font-semibold tracking-tight tabular-nums">
                  {amount ? amount : <span className="text-white/35">0</span>}
                  <span className="ml-2 text-xl font-medium text-white/60"><Token /></span>
                </p>
                <p className="mt-2 text-xs text-white/50">on {CHAINS[chainId]?.chain.name ?? "Whitechain"}</p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <motion.button
                    key={k}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => press(k)}
                    aria-label={k === "back" ? "Delete" : k}
                    className="grid h-14 place-items-center rounded-2xl bg-muted/60 text-xl font-medium tabular-nums transition-colors hover:bg-muted"
                  >
                    {k === "back" ? <Delete className="size-5" /> : k}
                  </motion.button>
                ))}
              </div>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), such as table 4" className="h-11 rounded-xl" />
              <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={!valid || busy} onClick={() => void create()}>
                {busy && <Spinner />}
                {busy ? "Creating…" : valid ? `Charge ${money(shown)} ${tokenOf(chainId)}` : "Enter an amount"}
              </Button>
            </div>
          </motion.div>
        )}

        {phase === "waiting" && order && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Scan to pay</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
              {money(Number(order.amount) / 1e6)} <span className="text-base font-medium text-muted-foreground"><Token /></span>
            </p>
            <div className="relative mx-auto mt-5 w-fit">
              <motion.div aria-hidden className="absolute -inset-3 rounded-[28px] bg-brand/15 blur-xl" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity }} />
              <div className="relative rounded-3xl border bg-white p-3 shadow-lift">
                {qr ? <Image src={qr} alt="Wallet payment QR code" width={232} height={232} unoptimized className="rounded-xl" /> : <Shimmer className="size-[232px]" rounded="rounded-xl" />}
              </div>
            </div>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="size-3.5" /> Any wallet fills in the network, amount, and address
            </p>

            <div className="mt-5 divide-y rounded-xl border px-4 text-left">
              <DetailRow label="Pay to">
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  {short(order.collector, 8, 6)} <CopyButton value={order.collector} label="" className="h-6 px-1.5" />
                </span>
              </DetailRow>
              <DetailRow label="Amount">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {money(Number(order.amount) / 1e6)} <Token /> <CopyButton value={(Number(order.amount) / 1e6).toString()} label="" className="h-6 px-1.5" />
                </span>
              </DetailRow>
              <DetailRow label="Network">{CHAINS[chainId]?.chain.name ?? chainId}</DetailRow>
              <DetailRow label="Time left">
                <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs tabular-nums", left < 120 && "text-destructive")}>
                  <Clock3 className="size-3.5" />
                  {Math.floor(left / 60)}:{Math.floor(left % 60).toString().padStart(2, "0")}
                </span>
              </DetailRow>
            </div>

            {received ? (
              <div className="mt-5 space-y-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-left">
                <p className="text-sm font-medium">Payment received from {short(received.payer, 6, 4)}</p>
                <p className="text-xs text-muted-foreground">Your wallet confirms payments on this account. Confirm it to mark the order paid.</p>
                <Button className="w-full rounded-xl" disabled={busy} onClick={() => void confirmYourself()}>
                  {busy && <Spinner />} Confirm payment
                </Button>
              </div>
            ) : (
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-info" />
                </span>
                Waiting for payment
              </p>
            )}

            <div className="mt-5 rounded-xl border text-left">
              <button type="button" onClick={() => setByBank((v) => !v)} className="flex w-full items-center gap-3 p-4 text-sm font-medium">
                <span className="grid size-8 place-items-center rounded-lg bg-muted">
                  <Landmark className="size-4" />
                </span>
                <span className="flex-1">
                  Customer paying by bank transfer?
                  <span className="block text-xs font-normal text-muted-foreground">UPI, SEPA, Pix, M-Pesa and more, in their currency</span>
                </span>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", byBank && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {byBank && orderId && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="border-t p-4">
                      <FiatPay
                        amount={Number(order.amount) / 1e6}
                        token={tokenOf(chainId)}
                        seed={orderId}
                        payerLabel="the customer"
                        cta="Mark paid ·"
                        onPay={async ({ country, reference: id }) => {
                          const r = await api<{ paid: boolean; currency?: string; fiatAmount?: string }>("/api/fiat/pay", { kind: "order", chainId, merchant: account.address, orderId, country, reference: id });
                          setBankPaid(r.currency && r.fiatAmount ? { currency: r.currency, fiatAmount: r.fiatAmount } : undefined);
                          setPaidAt(new Date());
                          setPhase("paid");
                          setCelebrate("success");
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button variant="ghost" className="mt-3 w-full rounded-xl text-muted-foreground" onClick={reset}>
              Cancel and start over
            </Button>
          </motion.div>
        )}

        {phase === "paid" && order && (
          <motion.div key="paid" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 p-8 text-center">
            <SuccessMark size={80} />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Paid</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {bankPaid ? paidWithText({ ...bankPaid, rate: "", country: null, reference: "", at: "" }) : <>{money(Number(order.amount) / 1e6)} <Token /></>} received
              </p>
            </div>
            <Button size="lg" className="h-12 w-full rounded-xl" onClick={reset}>
              New payment
            </Button>
          </motion.div>
        )}

        {phase === "expired" && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 p-8 text-center">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Payment window closed</h2>
              <p className="mt-1 text-sm text-muted-foreground">No payment arrived in 20 minutes. Start a new one.</p>
            </div>
            <Button size="lg" className="h-12 w-full rounded-xl" onClick={reset}>
              New payment
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
    </ChainToken>
  );
}
