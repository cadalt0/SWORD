"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CHAINS } from "sword-sdk";
import { CalendarClock, Check, Landmark, Link2Off, LockKeyhole, Repeat, RotateCcw, Store, UserCheck, Wallet, XCircle } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Address } from "@/lib/client/types";
import { connectWallet, hasMetaMask, ownerSdk } from "@/lib/client/wallet";
import { periodAdjective, periodName } from "@/lib/shared/billing";
import { Aurora, DetailRow, EmptyState, LoadingState, Logo, Method, Spinner, SuccessMark } from "../app/_components/kit";
import { FiatPay, ModeGroup, paidWithText, type PayMode } from "../app/_components/Fiat";
import { api } from "@/lib/client/api";
import { PaymentSuccess, type PaymentStage } from "../app/_components/PaymentSuccess";
import { checkoutOrigin, useCheckoutHandBack, type CheckoutParams } from "@/lib/client/checkout";
import { subscriptionAction, subscriptionRefundAction } from "../app/_components/customer-actions";
import { SignInButton, useSword, SwordPay } from "../app/_components/SwordPay";
import { decimal, errorText, money, notify, short, StatusBadge } from "../app/_components/shared";
import { ChainToken, Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

type State = {
  status: string;
  paidPeriods: number;
  periods: number;
  amount: string;
  collected: string;
  refunded: string;
  refundRequested: boolean;
  nextChargeAt: string | null;
  accessUntil: string | null;
};

type Offer = {
  id: string;
  chainId: number;
  merchant: string;
  name: string;
  description: string | null;
  amount: string;
  periodDays: number;
  periods: number;
  status: string;
  taken: boolean;
  mine: boolean;
  /// Held by the signed-in customer's Sword account, so actions go through that account.
  viaAccount: boolean;
  state: State | null;
  /// In checkout mode: whether the site that opened this page may be told the result.
  originAllowed?: boolean;
};

const date = (seconds: string | null) =>
  seconds ? new Date(Number(seconds) * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

async function fetchOffer(id: string, wallet?: string, origin?: string): Promise<Offer> {
  const res = await fetch(`/api/subscribe?id=${encodeURIComponent(id)}${wallet ? `&wallet=${wallet}` : ""}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`);
  const data = (await res.json()) as Offer & { error?: { message: string } };
  if (!res.ok) throw new Error(data.error?.message ?? "Could not load this subscription");
  return data;
}

/// The page a customer opens from a merchant's subscription link. An open subscription can be taken by one wallet;
/// that wallet comes back here to see it, ask for a refund, or cancel.
export function SubscribePage({ subscriptionId, checkout }: { subscriptionId: string; checkout?: CheckoutParams }) {
  const [offer, setOffer] = useState<Offer | undefined>();
  const [error, setError] = useState<string | undefined>();
  const origin = checkoutOrigin(checkout);

  /// Reads the subscription again. A wallet address, when given, lets its owner see their own subscription.
  const load = useCallback(
    async (w?: string) => {
      try {
        setOffer(await fetchOffer(subscriptionId, w, origin));
      } catch (err) {
        setError(errorText(err, "Could not load this subscription"));
      }
    },
    [subscriptionId, origin],
  );

  useEffect(() => {
    if (!subscriptionId) return;
    fetchOffer(subscriptionId, undefined, origin)
      .then(setOffer)
      .catch((err) => setError(errorText(err, "Could not load this subscription")));
  }, [subscriptionId, origin]);

  if (!subscriptionId || error) {
    return (
      <Shell>
        <EmptyState
          icon={Link2Off}
          title={error ?? "This subscription link is incomplete"}
          description="Ask the merchant for the full link."
          action={
            <Link href="/app" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
              Go to Sword
            </Link>
          }
        />
      </Shell>
    );
  }

  if (!offer) {
    return (
      <Shell>
        <LoadingState label="Loading subscription" />
      </Shell>
    );
  }

  return <Offered offer={offer} reload={load} checkout={checkout} />;
}

/// One subscription's page, once it is loaded.
function Offered({ offer, reload, checkout }: { offer: Offer; reload: (wallet?: string) => Promise<void>; checkout?: CheckoutParams }) {
  const [wallet, setWallet] = useState<Address | undefined>();
  const [busy, setBusy] = useState<"connect" | "subscribe" | "cancel" | "refund" | undefined>();
  const [stage, setStage] = useState<PaymentStage>("hidden");
  // Which way to pay is open; the other is minimized to one row.
  const [mode, setMode] = useState<PayMode>("crypto");
  /// Paid in local money on this page: what was paid.
  const [bankPaid, setBankPaid] = useState<{ currency: string; fiatAmount: string } | undefined>();
  const chainId = offer.chainId;
  const total = Number(offer.amount) * offer.periods;
  const wm = useSword(chainId);
  const load = reload;
  const handBack = useCheckoutHandBack(checkout, offer.originAllowed);

  // In checkout mode, tell the store once the subscription is taken.
  useEffect(() => {
    if (stage === "success") handBack({ type: "subscribed", subscriptionId: offer.id, merchant: offer.merchant });
  }, [stage, handBack, offer.id, offer.merchant]);

  // Signing in to Sword can make this subscription theirs, so read it again.
  const signedInAs = wm.account?.address;
  useEffect(() => {
    if (signedInAs) void reload(wallet);
    // only when the signed-in account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInAs]);

  async function connect() {
    setBusy("connect");
    try {
      const w = await connectWallet(chainId);
      setWallet(w);
      await load(w);
    } catch (err) {
      notify("error", errorText(err, "Could not connect the wallet"));
    } finally {
      setBusy(undefined);
    }
  }

  async function subscribe() {
    if (!wallet) return;
    setBusy("subscribe");
    try {
      const { transaction } = await ownerSdk(chainId, wallet).subscriptions.subscribe(offer!.id as `0x${string}`);
      setStage("confirming");
      const res = await fetch("/api/subscriptions/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: offer!.id, subscriber: wallet, txHash: transaction.hash }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: { message: string } }).error?.message ?? "Could not confirm the subscription");
      setStage("success");
      await load(wallet);
    } catch (err) {
      setStage("hidden");
      notify("error", errorText(err, "Could not subscribe"));
    } finally {
      setBusy(undefined);
    }
  }

  async function cancel() {
    if (!wallet) return;
    setBusy("cancel");
    try {
      await ownerSdk(chainId, wallet).subscriptions.cancel(offer!.id as `0x${string}`);
      notify("success", "Subscription cancelled. You keep access until the end of the paid period.");
      await load(wallet);
    } catch (err) {
      notify("error", errorText(err, "Could not cancel"));
    } finally {
      setBusy(undefined);
    }
  }

  async function requestRefund(amount: string, reason: string) {
    if (!wallet) return;
    setBusy("refund");
    try {
      await ownerSdk(chainId, wallet).subscriptions.requestRefund({ id: offer!.id as `0x${string}`, amount, reason });
      notify("success", "Refund request sent to the merchant");
      await load(wallet);
    } catch (err) {
      notify("error", errorText(err, "Could not send the request"));
    } finally {
      setBusy(undefined);
    }
  }

  const state = offer.state;
  const ended = offer.status === "cancelled" || offer.status === "completed";

  return (
    <ChainToken chainId={offer.chainId}>
    <Shell>
      <PaymentSuccess
        stage={stage}
        amount={Number(offer.amount)}
        title="Subscription active"
        subtitle={`${offer.name} · ${periodAdjective(offer.periodDays)}`}
        onDone={() => setStage("hidden")}
        details={[
          { label: "Subscription", value: offer.name },
          { label: "Billed", value: `${money(offer.amount)} ${tokenOf(offer.chainId)} every ${periodName(offer.periodDays)}` },
          { label: "Payments", value: state ? `${state.paidPeriods} of ${state.periods}` : `1 of ${offer.periods}` },
          ...(bankPaid
            ? [{ label: "Paid", value: paidWithText({ ...bankPaid, rate: "", country: null, reference: "", at: "" }) }]
            : [{ label: "Next payment", value: date(state?.nextChargeAt ?? null) }]),
        ]}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="grid w-full max-w-4xl overflow-hidden rounded-[28px] border bg-card shadow-lift md:grid-cols-[1fr_1.05fr]"
      >
        <section className="relative overflow-hidden bg-[oklch(0.17_0.03_275)] p-6 text-white md:p-8">
          <Aurora />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-white/70">
                <span className="grid size-8 place-items-center rounded-xl bg-white/10">
                  <Store className="size-4" />
                </span>
                <span className="font-mono">{short(offer.merchant, 6, 4)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                <Repeat className="size-3.5" /> Subscription
              </span>
            </div>
            <div className="mt-10">
              <p className="text-sm text-white/60">{offer.name}</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
                {money(offer.amount)}
                <span className="ml-2 text-lg font-medium text-white/60"><Token /> / {periodName(offer.periodDays)}</span>
              </p>
              {offer.description && <p className="mt-4 max-w-sm text-sm text-white/70">{offer.description}</p>}
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                `${periodAdjective(offer.periodDays)} billing, ${offer.periods} payments in total`,
                offer.periodDays < 1 ? `First payment now, then every ${periodName(offer.periodDays)}` : "First payment today, then on the same day each period",
                "Cancel anytime. You keep access until the period ends",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-white/80">{line}</span>
                </li>
              ))}
            </ul>
            <p className="relative mt-auto pt-10 text-xs text-white/45">on {CHAINS[chainId]?.chain.name ?? "Whitechain"}</p>
          </div>
        </section>

        <section className="flex flex-col p-6 md:p-8">
          {offer.mine && state ? (
            <Manage
              state={state}
              chainId={chainId}
              subscriptionId={offer.id}
              name={offer.name}
              viaAccount={offer.viaAccount}
              wm={wm}
              busy={busy}
              onCancel={() => void cancel()}
              onRefund={(a, r) => void requestRefund(a, r)}
              onChanged={() => reload(wallet)}
            />
          ) : bankPaid ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <SuccessMark size={76} />
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">You&apos;re subscribed</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {offer.name} · {paidWithText({ ...bankPaid, rate: "", country: null, reference: "", at: "" })} paid
              </p>
              <p className="mt-4 max-w-xs text-xs text-muted-foreground">The merchant has your payment. Your receipt is on its way to them now.</p>
            </div>
          ) : offer.taken || ended ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <UserCheck className="size-5" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">{offer.status === "cancelled" && !offer.taken ? "This subscription is no longer available" : "This subscription is already taken"}</h1>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {wallet || wm.account ? "It belongs to someone else. Ask the merchant for your own link." : "If it's yours, sign in or connect the wallet you subscribed with to manage it."}
              </p>
              {offer.taken && !wm.account && (
                <div className="mt-6 w-full max-w-xs space-y-2">
                  {wm.me === null && <SignInButton label="Sign in to Sword" onSignedIn={() => void wm.reload()} />}
                  {!wallet && hasMetaMask() && (
                    <Button variant="outline" className="h-11 w-full rounded-xl" disabled={busy === "connect"} onClick={() => void connect()}>
                      {busy === "connect" ? <Spinner /> : <Wallet className="size-4" />} Connect wallet
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Start your subscription</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose how you pay. It takes under a minute.</p>
              <div className="mt-5 divide-y rounded-xl border px-4">
                <DetailRow label="Today">
                  <span className="font-semibold tabular-nums">{money(offer.amount)} <Token /></span>
                </DetailRow>
                <DetailRow label={`Then every ${periodName(offer.periodDays)}`}>
                  <span className="tabular-nums">{money(offer.amount)} <Token /></span>
                </DetailRow>
                <DetailRow label="Payments">{offer.periods}</DetailRow>
                <DetailRow label="Total over the subscription">
                  <span className="tabular-nums">{money(total)} <Token /></span>
                </DetailRow>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <ModeGroup
                  mode="crypto"
                  active={mode}
                  onPick={setMode}
                  icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><Wallet className="size-4" /></span>}
                  title="Pay with crypto"
                  subtitle="Sword account or a crypto wallet"
                >
                <Method icon={<Logo size={36} />} title="Sword account" subtitle="Subscribe from your balance in one tap" recommended>
                  <SwordPay
                    chainId={chainId}
                    state={wm}
                    label={`Subscribe · ${money(offer.amount)} ${tokenOf(offer.chainId)} / ${periodName(offer.periodDays)}`}
                    signInLabel="Sign in to subscribe"
                    amount={Number(offer.amount)}
                    action={subscriptionAction(chainId, offer, "subscribe")}
                    onStart={() => setStage("confirming")}
                    onDone={() => {
                      setStage("success");
                      void reload(wallet);
                    }}
                    onError={(err) => {
                      setStage("hidden");
                      notify("error", errorText(err, "Could not subscribe"));
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
                  subtitle={wallet ? `Connected ${short(wallet, 6, 4)}` : `MetaMask on ${CHAINS[chainId]?.chain.name ?? "your network"}`}
                >
                  {!hasMetaMask() ? (
                    <p className="text-sm text-muted-foreground">Install the MetaMask extension to subscribe from this browser.</p>
                  ) : !wallet ? (
                    <Button size="lg" variant="outline" className="h-11 w-full rounded-xl" disabled={busy === "connect"} onClick={() => void connect()}>
                      {busy === "connect" ? <Spinner /> : <Wallet className="size-4" />}
                      {busy === "connect" ? "Connecting…" : "Connect wallet"}
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" className="h-11 w-full rounded-xl" disabled={busy === "subscribe"} onClick={() => void subscribe()}>
                      {busy === "subscribe" && <Spinner />}
                      {busy === "subscribe" ? "Confirm in your wallet…" : `Subscribe with wallet`}
                    </Button>
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
                  subtitle="Pay the first period in your own currency"
                >
                  <FiatPay
                    amount={Number(offer.amount)}
                    token={tokenOf(chainId)}
                    seed={offer.id}
                    onPay={async ({ country, reference }) => {
                      const r = await api<{ paid: boolean; currency?: string; fiatAmount?: string }>("/api/fiat/pay", { kind: "subscription", id: offer.id, country, reference });
                      setBankPaid({ currency: r.currency ?? "USD", fiatAmount: r.fiatAmount ?? offer.amount });
                      setStage("success");
                    }}
                  />
                </Method>
                </ModeGroup>
              </div>
              <p className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-muted-foreground">
                <LockKeyhole className="size-3.5" /> Payments are only ever taken on schedule, and never more than the price.
              </p>
            </>
          )}
        </section>
      </motion.div>
    </Shell>
    </ChainToken>
  );
}

/// The customer's own subscription: where it stands, a refund request, and cancel.
function Manage({
  state,
  chainId,
  subscriptionId,
  name,
  viaAccount,
  wm,
  busy,
  onCancel,
  onRefund,
  onChanged,
}: {
  state: State;
  chainId: number;
  subscriptionId: string;
  name: string;
  /// Held by the signed-in customer's Sword account: act through it. Otherwise the connected wallet acts.
  viaAccount: boolean;
  wm: ReturnType<typeof useSword>;
  busy: string | undefined;
  onCancel: () => void;
  onRefund: (amount: string, reason: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState(decimal(Number(state.amount)));
  const [reason, setReason] = useState("");
  const progress = Math.round((state.paidPeriods / state.periods) * 100);
  const live = state.status === "active";
  const refundable = Number(state.collected) - Number(state.refunded);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">You&apos;re subscribed</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your subscription</p>
        </div>
        <StatusBadge status={state.status} />
      </div>
      <div className="mt-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Payments made</span>
          <span className="font-medium tabular-nums">
            {state.paidPeriods} of {state.periods}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} />
        </div>
      </div>
      <div className="mt-6 divide-y rounded-xl border px-4">
        <DetailRow label="Next payment">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-muted-foreground" /> {date(state.nextChargeAt)}
          </span>
        </DetailRow>
        <DetailRow label="Amount">{money(state.amount)} <Token /></DetailRow>
        <DetailRow label="Paid so far">{money(state.collected)} <Token /></DetailRow>
        {Number(state.refunded) > 0 && <DetailRow label="Refunded to you">{money(state.refunded)} <Token /></DetailRow>}
        <DetailRow label="Access until">{date(state.accessUntil)}</DetailRow>
      </div>

      {state.refundRequested ? (
        <p className="mt-5 rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm">Your refund request is with the merchant.</p>
      ) : refundable > 0 && asking ? (
        <div className="mt-5 space-y-3 rounded-xl border p-4">
          <div className="relative">
            <Input aria-label="Refund amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
          </div>
          <Textarea rows={2} className="rounded-xl" placeholder="Tell the merchant why" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setAsking(false)}>Back</Button>
            {viaAccount ? (
              <SwordPay
                chainId={chainId}
                state={wm}
                label="Send request"
                busyLabel="Sending…"
                caption={false}
                className="h-10 rounded-xl"
                disabled={!(Number(amount) > 0) || !reason.trim()}
                action={subscriptionRefundAction(chainId, { id: subscriptionId, name }, amount, reason)}
                onDone={() => {
                  notify("success", "Refund request sent to the merchant");
                  void onChanged();
                }}
              />
            ) : (
              <Button className="rounded-xl" disabled={busy === "refund" || !(Number(amount) > 0) || !reason.trim()} onClick={() => onRefund(amount, reason)}>
                {busy === "refund" && <Spinner />} Send request
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-auto space-y-2 pt-6">
        {refundable > 0 && !state.refundRequested && !asking && (
          <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setAsking(true)}>
            <RotateCcw className="size-4" /> Ask for a refund
          </Button>
        )}
        {live &&
          (viaAccount ? (
            <SwordPay
              chainId={chainId}
              state={wm}
              variant="outline"
              label="Cancel subscription"
              busyLabel="Cancelling…"
              caption={false}
              className="text-destructive hover:text-destructive"
              action={subscriptionAction(chainId, { id: subscriptionId, name, amount: state.amount }, "cancel")}
              onDone={() => {
                notify("success", "Subscription cancelled. You keep access until the end of the paid period.");
                void onChanged();
              }}
            />
          ) : (
            <Button variant="outline" className="h-11 w-full rounded-xl text-destructive hover:text-destructive" disabled={busy === "cancel"} onClick={onCancel}>
              {busy === "cancel" ? <Spinner /> : <XCircle className="size-4" />}
              {busy === "cancel" ? "Confirm in your wallet…" : "Cancel subscription"}
            </Button>
          ))}
      </div>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <Logo withText />
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 pb-12">{children}</main>
    </div>
  );
}

