"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, ArrowDownLeft, ArrowRight, CalendarClock, ExternalLink, Receipt, Repeat, RotateCcw, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import { periodAdjective, periodName } from "@/lib/shared/billing";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { inDays, niceDate, receiptHref, shortfall, upcoming, type MySub } from "./customer-data";
import { subscriptionAction, subscriptionRefundAction } from "./customer-actions";
import { DetailRow, EmptyState, FadeIn, IconChip, LoadingRows, LoadingState, PageHeader, Shimmer } from "./kit";
import { CopyButton, decimal, errorText, money, notify, short, StatusBadge, timeAgo } from "./shared";
import { useSword, SwordPay } from "./SwordPay";
import { Token } from "@/lib/client/token";

/// The customer's subscriptions: what they hold, what's coming up, and whether their balance covers it.

export function useMySubscriptions() {
  const [subs, setSubs] = useState<MySub[] | undefined>();
  async function load() {
    try {
      setSubs((await api<{ subscriptions: MySub[] }>("/api/my/subscriptions")).subscriptions);
    } catch (err) {
      notify("error", errorText(err, "Could not load your subscriptions"));
      setSubs([]);
    }
  }
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);
  return { subs, load };
}

/// The next payments, and a warning when the balance can't cover the ones coming soon.
export function UpcomingPayments({ subs, balance, address, onViewAll, limit = 3 }: { subs: MySub[] | undefined; balance: number | undefined; address: string; onViewAll?: () => void; limit?: number }) {
  const { shortIds, needed, first } = useMemo(() => shortfall(subs ?? [], balance), [subs, balance]);
  const next = upcoming(subs ?? []);

  if (subs === undefined) {
    return (
      <div className="surface-card p-5">
        <LoadingRows count={2} dense />
      </div>
    );
  }
  if (next.length === 0) return null;

  return (
    <FadeIn className="surface-card overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3 md:px-6">
        <div>
          <h3 className="text-sm font-semibold">Upcoming payments</h3>
          <p className="text-xs text-muted-foreground">Taken automatically from your account</p>
        </div>
        {onViewAll && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onViewAll}>
            All subscriptions <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>

      {shortIds.size > 0 && first && (
        <div className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/8 p-3 md:mx-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
              <AlertTriangle className="size-4" />
            </span>
            <p className="text-sm">
              <span className="font-medium">Your balance is {balance === undefined ? "…" : money(balance)} <Token />, and {money(needed)} <Token /> is due soon.</span>{" "}
              <span className="text-muted-foreground">
                {first.name} ({money(first.amount)} <Token />) is {inDays(first.nextChargeAt)}. Add <Token /> to your account so it goes through.
              </span>
            </p>
          </div>
          <CopyButton value={address} label="Copy account address" className="h-8 rounded-full border bg-card text-foreground" />
        </div>
      )}

      <ul className="divide-y px-2 pb-2">
        {next.slice(0, limit).map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-3">
            <IconChip icon={Repeat} size="sm" tone={shortIds.has(s.id) ? "warning" : "brand"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {niceDate(s.nextChargeAt)} · {inDays(s.nextChargeAt)}
                {s.merchantLabel ? ` · ${s.merchantLabel}` : ""}
              </p>
            </div>
            {shortIds.has(s.id) && <span className="rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-warning/25">Low balance</span>}
            <p className="w-24 text-right text-sm font-semibold tabular-nums">
              {money(s.amount)} <span className="text-xs font-normal text-muted-foreground"><Token /></span>
            </p>
          </li>
        ))}
      </ul>
    </FadeIn>
  );
}

/// The Subscriptions page of a customer.
export function MySubscriptions({ chainId, account }: { chainId: number; account: Account }) {
  const { subs, load } = useMySubscriptions();
  const wm = useSword(chainId);
  const [open, setOpen] = useState<string | undefined>();
  const { shortIds } = useMemo(() => shortfall(subs ?? [], wm.balance), [subs, wm.balance]);

  const sorted = useMemo(() => {
    const rank = (s: MySub) => (s.status === "active" ? 0 : s.status === "open" ? 1 : s.status === "completed" ? 2 : 3);
    return [...(subs ?? [])].sort((a, b) => rank(a) - rank(b) || Number(b.createdAt) - Number(a.createdAt));
  }, [subs]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Subscriptions" description="Everything you subscribe to, what's coming up, and your payment history." />

      <UpcomingPayments subs={subs} balance={wm.balance} address={account.address} limit={5} />

      {subs === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Shimmer key={i} className="h-44" rounded="rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="surface-card">
          <EmptyState icon={Repeat} title="No subscriptions yet" description="When you subscribe to something, it shows up here, with its payments and your receipts." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((s, i) => {
            const live = s.status === "active";
            return (
              <motion.button
                key={s.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
                whileHover={{ y: -2 }}
                onClick={() => setOpen(s.id)}
                className="surface-card flex flex-col p-5 text-left outline-none transition-shadow hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Store className="size-3" /> {s.merchantLabel ?? short(s.merchant, 6, 4)}
                    </p>
                  </div>
                  <StatusBadge status={s.status === "open" ? "awaiting" : s.status} />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                  {money(s.amount)} <span className="text-sm font-medium text-muted-foreground"><Token /> / {periodName(s.periodDays)}</span>
                </p>
                <div className="mt-4 space-y-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-success" style={{ width: `${(s.paidPeriods / s.periods) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {s.paidPeriods} of {s.periods} paid
                    </span>
                    <span>{live ? `Next ${niceDate(s.nextChargeAt)}` : s.accessUntil ? `Access until ${niceDate(s.accessUntil)}` : ""}</span>
                  </div>
                </div>
                {live && shortIds.has(s.id) && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" /> Low balance for the next payment
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      <MySubscriptionDialog id={open} chainId={chainId} wm={wm} subs={subs ?? []} onOpenChange={(o) => !o && setOpen(undefined)} onChanged={load} />
    </div>
  );
}

type Detail = MySub & { history: { kind: "payment" | "refund"; period: number | null; amount: string; txHash: string | null; at: string }[] };

/// One subscription in full: where it stands, every payment with its receipt, a refund request, and cancel.
function MySubscriptionDialog({
  id,
  chainId,
  wm,
  subs,
  onOpenChange,
  onChanged,
}: {
  id: string | undefined;
  chainId: number;
  wm: ReturnType<typeof useSword>;
  subs: MySub[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail | undefined>();
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const summary = subs.find((s) => s.id === id);

  async function fetchDetail(subId: string) {
    const d = await api<Detail>(`/api/my/subscriptions/detail?id=${subId}`);
    setDetail(d);
    return d;
  }

  useEffect(() => {
    if (!id) return;
    let live = true;
    api<Detail>(`/api/my/subscriptions/detail?id=${id}`)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setAmount(decimal(Math.min(Number(d.amount), Number(d.collected) - Number(d.refunded))));
      })
      .catch((err) => notify("error", errorText(err, "Could not load the subscription")));
    return () => {
      live = false;
      setAsking(false);
      setReason("");
      setTimeout(() => setDetail(undefined), 200);
    };
  }, [id]);

  const refundable = detail ? Number(detail.collected) - Number(detail.refunded) : 0;
  const live = detail?.status === "active" || detail?.status === "open";

  async function changed(message: string) {
    notify("success", message);
    if (id) await fetchDetail(id);
    await onChanged();
  }

  return (
    <Dialog open={id !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <div className="relative overflow-hidden border-b px-6 pb-6 pt-6">
          <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
          <DialogHeader className="relative">
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogDescription className="text-xs font-medium uppercase tracking-[0.12em]">Subscription</DialogDescription>
              {(detail ?? summary) && <StatusBadge status={(detail ?? summary)!.status === "open" ? "awaiting" : (detail ?? summary)!.status} />}
            </div>
            <DialogTitle className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {(detail ?? summary) ? money((detail ?? summary)!.amount) : <Shimmer className="inline-block h-8 w-24 align-middle" />}{" "}
              <span className="text-base font-medium text-muted-foreground"><Token /> / {(detail ?? summary) ? periodName((detail ?? summary)!.periodDays) : "period"}</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{(detail ?? summary)?.name ?? " "}</p>
          </DialogHeader>
        </div>

        {!detail ? (
          <div className="space-y-4 p-6">
            <LoadingState compact label="Loading your subscription" />
            <LoadingRows count={3} dense />
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payments made</span>
                <span className="font-medium tabular-nums">
                  {detail.paidPeriods} of {detail.periods}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${(detail.paidPeriods / detail.periods) * 100}%` }} transition={{ duration: 0.7 }} />
              </div>
            </div>

            <div className="divide-y rounded-xl border px-4">
              <DetailRow label="Merchant">{detail.merchantLabel ?? short(detail.merchant, 6, 4)}</DetailRow>
              <DetailRow label="Billing">{`${periodAdjective(detail.periodDays)}, ${detail.periods} payments`}</DetailRow>
              <DetailRow label="Next payment">{detail.due ? <span className="font-medium text-warning">Due now</span> : niceDate(detail.nextChargeAt, true)}</DetailRow>
              <DetailRow label="Access until">{niceDate(detail.accessUntil, true)}</DetailRow>
              <DetailRow label="Paid so far">{money(detail.collected)} <Token /></DetailRow>
              {Number(detail.refunded) > 0 && <DetailRow label="Refunded to you">{money(detail.refunded)} <Token /></DetailRow>}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Payments and receipts</p>
              {detail.history.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ol className="space-y-1">
                  {detail.history.map((h, i) => (
                    <li key={`${h.at}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                      <IconChip icon={h.kind === "refund" ? ArrowDownLeft : Receipt} tone={h.kind === "refund" ? "success" : "neutral"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{h.kind === "refund" ? "Refund to you" : `Payment ${h.period ?? "—"} of ${detail.periods}`}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · {timeAgo(h.at)}
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums", h.kind === "refund" && "text-success")}>
                        {h.kind === "refund" ? "+" : "−"}
                        {money(h.amount)}
                      </span>
                      {h.txHash && (
                        <Link href={receiptHref(h.txHash, chainId)} className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                          Receipt
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {!detail.viaAccount ? (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
                <p className="text-sm">You took this subscription with your wallet, so you manage it from its own page.</p>
                <Link href={`/subscribe?id=${detail.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                  Open <ExternalLink className="size-3.5" />
                </Link>
              </div>
            ) : (
              <>
                {detail.refundRequested ? (
                  <p className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm">Your refund request for {money(detail.requestedAmount)} <Token /> is with the merchant.</p>
                ) : refundable > 0 && asking ? (
                  <div className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-medium">Ask for a refund</p>
                    <div className="relative">
                      <Input aria-label="Refund amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
                    </div>
                    <Textarea rows={2} className="rounded-xl" placeholder="Tell the merchant why" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" className="rounded-xl" onClick={() => setAsking(false)}>Back</Button>
                      <SwordPay
                        chainId={chainId}
                        state={wm}
                        label="Send request"
                        busyLabel="Sending…"
                        caption={false}
                        className="h-10 rounded-xl"
                        disabled={!(Number(amount) > 0) || !reason.trim()}
                        action={subscriptionRefundAction(chainId, { id: detail.id, name: detail.name }, amount, reason)}
                        onDone={() => {
                          setAsking(false);
                          void changed("Refund request sent to the merchant");
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {refundable > 0 && !detail.refundRequested && !asking && (
                    <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setAsking(true)}>
                      <RotateCcw className="size-4" /> Ask for a refund
                    </Button>
                  )}
                  {live && (
                    <SwordPay
                      chainId={chainId}
                      state={wm}
                      variant="outline"
                      label="Cancel subscription"
                      busyLabel="Cancelling…"
                      caption={false}
                      className="text-destructive hover:text-destructive"
                      action={subscriptionAction(chainId, { id: detail.id, name: detail.name, amount: detail.amount }, "cancel")}
                      onDone={() => void changed("Subscription cancelled. You keep access until the end of the paid period.")}
                    />
                  )}
                </div>
              </>
            )}
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="size-3" /> Payments are only taken on schedule, and never more than the price.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
