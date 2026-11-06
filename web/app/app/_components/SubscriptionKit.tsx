"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, Ban, Landmark, Link2, Repeat, ShieldAlert, Undo2, Users, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client/api";
import { runAction } from "@/lib/client/actions";
import type { Address } from "@/lib/client/types";
import { periodAdjective, periodName, periodSecondsOf, subscribeLink } from "@/lib/shared/billing";
import { cn } from "@/lib/utils";
import { paidWithText, type PaidWith } from "./Fiat";
import type { Account } from "./Dashboard";
import { DetailRow, IconChip, LoadingRows, LoadingState, Segmented, Shimmer, Spinner } from "./kit";
import { CopyButton, decimal, errorText, money, notify, short, StatusBadge, timeAgo } from "./shared";
import { Token } from "@/lib/client/token";

/// Shared subscription pieces. A subscription is created by the merchant like an order, has its own deposit address,
/// and has exactly one customer.

export const BILLING = [
  { value: String(10 / 86_400), label: "Every 10 seconds (testing)" },
  { value: "7", label: "Weekly" },
  { value: "30", label: "Monthly" },
  { value: "90", label: "Quarterly" },
  { value: "365", label: "Yearly" },
] as const;

export type SubscriptionDraft = { name: string; amount: string; period: (typeof BILLING)[number]["value"]; periods: string; description: string };

export const emptyDraft = (): SubscriptionDraft => ({ name: "", amount: "9.99", period: "30", periods: "12", description: "" });

export function draftValid(d: SubscriptionDraft): boolean {
  const count = Number(d.periods);
  return !!d.name.trim() && Number(d.amount) > 0 && Number.isInteger(count) && count >= 1 && count <= 120;
}

/// A subscription as the merchant's lists show it. Amounts are decimal USDT; times are seconds.
export type Sub = {
  id: string;
  status: string;
  name: string;
  description: string | null;
  reference: string;
  periodDays: number;
  amount: string;
  periods: number;
  paidPeriods: number;
  subscriber: string | null;
  vault: string;
  collected: string;
  refunded: string;
  withdrawn: string;
  held: string;
  refundRequested: boolean;
  requestedAmount: string;
  createdAt: string;
  startedAt: string | null;
  cancelledAt: string | null;
  nextChargeAt: string | null;
  accessUntil: string | null;
  due: boolean;
  /// Set when the customer paid in local money.
  paidWith?: PaidWith;
};

/// The badge a subscription shows: an open one is waiting for its customer.
export const subBadge = (s: { status: string }) => (s.status === "open" ? "awaiting" : s.status);
export const isLive = (s: { status: string }) => s.status === "active" || s.status === "open";

type Base = { chainId: number; account: Account; wallet: Address | undefined };

const date = (seconds: string | null) => (seconds ? new Date(Number(seconds) * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const shortDate = (seconds: string | null) => (seconds ? new Date(Number(seconds) * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—");

/// A unique reference for a new subscription, from its name.
function referenceFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "subscription";
  return `${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/// Creates a subscription for the merchant. The relayer sends it when allowed; otherwise the merchant's wallet does.
/// Returns its id.
export async function createSubscription(base: Base, d: SubscriptionDraft): Promise<string> {
  const { chainId, account, wallet } = base;
  const reference = referenceFor(d.name);
  const terms = { name: d.name.trim(), description: d.description.trim() || null, amount: d.amount, periodDays: Number(d.period), periods: Number(d.periods), reference };
  const r = await runAction({
    account: { address: account.address, owner: account.owner, custody: account.custody },
    chainId,
    wallet,
    relayer: () => api("/api/subscriptions", { chainId, action: "create", ...terms }),
    owner: async (sdk) => {
      const periodSeconds = periodSecondsOf(terms.periodDays);
      const res = account.eoa
        ? await sdk.subscriptions.create({
            merchant: account.address,
            reference,
            amount: terms.amount,
            periodSeconds,
            periods: terms.periods,
            relayer: (await api<{ relayer: string }>(`/api/permission?chainId=${chainId}`)).relayer,
          })
        : await sdk.accounts.merchant.createSubscription({ account: account.address, reference, amount: terms.amount, periodSeconds, periods: terms.periods });
      return { hash: res.transaction.hash, data: { id: res.id.toLowerCase(), vault: res.vault } };
    },
    record: (res) => ({
      type: "subscription.created",
      details: { chainId, subscriptionId: res.data.id, name: terms.name, amount: terms.amount },
      txHash: res.hash,
      subscription: { id: res.data.id, merchantAddress: account.address, vault: res.data.vault, ...terms },
    }),
  });
  return String(r.data.id);
}

type Action = { kind: "refund"; amount: string } | { kind: "withdraw" } | { kind: "cancel" } | { kind: "deny" };

/// One merchant action on a subscription. The relayer sends it when allowed; otherwise the merchant's wallet does.
export async function subscriptionAction(base: Base, sub: Sub, action: Action): Promise<void> {
  const { chainId, account, wallet } = base;
  const id = sub.id as `0x${string}`;
  const details = { chainId, subscriptionId: sub.id, name: sub.name };
  await runAction({
    account: { address: account.address, owner: account.owner, custody: account.custody },
    chainId,
    wallet,
    relayer: () => api("/api/subscriptions", { chainId, action: action.kind, id: sub.id, ...(action.kind === "refund" ? { amount: action.amount } : {}) }),
    owner: async (sdk) => {
      const m = sdk.accounts.merchant;
      const a = account.address;
      const tx =
        action.kind === "refund"
          ? account.eoa
            ? await sdk.subscriptions.refund({ id, amount: action.amount })
            : await m.refundSubscription({ account: a, id, amount: action.amount })
          : action.kind === "withdraw"
            ? account.eoa
              ? await sdk.subscriptions.withdraw(id)
              : await m.withdrawSubscription({ account: a, id })
            : action.kind === "cancel"
              ? account.eoa
                ? await sdk.subscriptions.cancel(id)
                : await m.cancelSubscription({ account: a, id })
              : account.eoa
                ? await sdk.subscriptions.deny({ id })
                : await m.denySubscriptionRefund({ account: a, id });
      return { hash: tx.hash, data: {} };
    },
    record: (res) => ({
      type: action.kind === "refund" ? "subscription.refunded" : action.kind === "withdraw" ? "subscription.withdrawn" : action.kind === "cancel" ? "subscription.cancelled" : "subscription.refund_denied",
      details: action.kind === "refund" ? { ...details, amount: action.amount } : action.kind === "withdraw" ? { ...details, amount: sub.held } : details,
      txHash: res.hash,
    }),
  });
}

/// The fields of a subscription: name, price, billing, number of payments, and what's included, with a live summary.
export function SubscriptionFields({ draft, onChange, autoFocus }: { draft: SubscriptionDraft; onChange: (d: SubscriptionDraft) => void; autoFocus?: boolean }) {
  const set = (patch: Partial<SubscriptionDraft>) => onChange({ ...draft, ...patch });
  const count = Number(draft.periods);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="sub-name">Name</Label>
        <Input id="sub-name" autoFocus={autoFocus} className="h-11 rounded-xl" placeholder="Pro membership for Ada" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-amount">Price</Label>
        <div className="relative">
          <Input id="sub-amount" inputMode="decimal" className="h-14 rounded-xl pr-16 text-2xl font-semibold tabular-nums md:text-2xl" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"><Token /></span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Billing</Label>
        <Segmented id="sub-period" value={draft.period} onChange={(v) => set({ period: v })} className="grid w-full grid-cols-4" size="sm" options={BILLING.map((p) => ({ value: p.value, label: p.label }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-periods">Number of payments</Label>
        <div className="flex gap-2">
          <Input id="sub-periods" inputMode="numeric" className="h-10 w-24 rounded-xl tabular-nums" value={draft.periods} onChange={(e) => set({ periods: e.target.value })} />
          {["3", "6", "12", "24"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ periods: v })}
              className={cn("rounded-full border px-3 text-xs font-medium tabular-nums transition-colors", draft.periods === v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-desc">What&apos;s included (optional)</Label>
        <Textarea id="sub-desc" rows={2} className="rounded-xl" placeholder="Unlimited access, priority support" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      {draftValid(draft) && (
        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Your customer pays <span className="font-medium text-foreground">{money(draft.amount)} <Token /></span> every {periodName(Number(draft.period))}, {count} times. Total{" "}
          <span className="font-medium text-foreground">{money(Number(draft.amount) * count)} <Token /></span>. One customer takes this subscription.
        </p>
      )}
    </div>
  );
}

/// The moment after a subscription is created: its link, ready to send to the customer.
export function SubscriptionCreated({ id, draft, onDone }: { id: string; draft: SubscriptionDraft; onDone: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 p-6 text-center">
      <DialogHeader className="sr-only">
        <DialogTitle>Subscription created</DialogTitle>
        <DialogDescription>Send the link to your customer.</DialogDescription>
      </DialogHeader>
      <IconChip icon={Repeat} tone="brand" size="lg" className="mx-auto" />
      <div>
        <p className="text-lg font-semibold">Subscription ready</p>
        <p className="text-sm text-muted-foreground">
          {draft.name} · {money(draft.amount)} <Token /> / {periodName(Number(draft.period))}
        </p>
      </div>
      <div className="rounded-xl border bg-muted/40 p-3 text-left">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link2 className="size-3.5" /> Subscribe link
        </p>
        <p className="mt-1 truncate font-mono text-xs">{`${window.location.host}/subscribe/…${id.slice(-6)}`}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Send it to your customer. The first person to subscribe becomes its customer.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CopyButton value={subscribeLink(window.location.origin, id)} label="Copy link" className="h-10 justify-center rounded-xl border bg-card text-foreground" />
        <Button className="h-10 rounded-xl" onClick={onDone}>Done</Button>
      </div>
    </motion.div>
  );
}

/// Subscriptions as a table. Rows open the detail.
export function SubscriptionTable({ subs, onOpen }: { subs: Sub[]; onOpen: (id: string) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 pl-5 text-xs font-medium">Subscription</TableHead>
          <TableHead className="h-10 text-xs font-medium">Customer</TableHead>
          <TableHead className="h-10 text-xs font-medium">Status</TableHead>
          <TableHead className="h-10 text-xs font-medium">Payments</TableHead>
          <TableHead className="hidden h-10 text-right text-xs font-medium md:table-cell">Collected</TableHead>
          <TableHead className="hidden h-10 text-right text-xs font-medium lg:table-cell">Held</TableHead>
          <TableHead className="hidden h-10 pr-5 text-xs font-medium md:table-cell">Next payment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subs.map((s, i) => (
          <motion.tr
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 10) * 0.03 }}
            onClick={() => onOpen(s.id)}
            className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
          >
            <TableCell className="py-3 pl-5">
              <div className="flex items-center gap-3">
                <IconChip icon={Repeat} size="sm" tone={s.status === "active" ? "success" : s.status === "open" ? "info" : "neutral"} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {money(s.amount)} <Token /> / {periodName(s.periodDays)}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="py-3 font-mono text-xs">{s.subscriber ? short(s.subscriber, 6, 4) : <span className="font-sans text-muted-foreground">Waiting</span>}</TableCell>
            <TableCell className="py-3">
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={subBadge(s)} />
                {s.refundRequested && <span className="text-[11px] font-medium text-warning">Refund requested · {money(s.requestedAmount)}</span>}
              </div>
            </TableCell>
            <TableCell className="py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${(s.paidPeriods / s.periods) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.paidPeriods}/{s.periods}
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden py-3 text-right tabular-nums md:table-cell">{money(s.collected)}</TableCell>
            <TableCell className="hidden py-3 text-right tabular-nums lg:table-cell">{Number(s.held) > 0 ? money(s.held) : <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="hidden py-3 pr-5 text-xs md:table-cell">
              {s.due ? <span className="font-medium text-warning">Due now</span> : s.nextChargeAt ? shortDate(s.nextChargeAt) : <span className="text-muted-foreground">—</span>}
            </TableCell>
          </motion.tr>
        ))}
      </TableBody>
    </Table>
  );
}

type Detail = Sub & { history: { kind: "payment" | "refund"; period: number | null; amount: string; txHash: string | null; at: string }[] };

/// Everything about one subscription, and every action the merchant can take on it: refund any amount, withdraw what
/// it holds, close a refund request, or cancel.
export function SubscriptionDetail({ id, base, onOpenChange, onChanged }: { id: string | undefined; base: Base; onOpenChange: (open: boolean) => void; onChanged?: () => void }) {
  const [detail, setDetail] = useState<Detail | undefined>();
  const [busy, setBusy] = useState<Action["kind"] | undefined>();
  const [refund, setRefund] = useState("");

  useEffect(() => {
    if (!id) return;
    let live = true;
    api<Detail>(`/api/subscriptions/detail?id=${id}`)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setRefund(decimal(Math.min(Number(d.amount), Number(d.collected) - Number(d.refunded))));
      })
      .catch((err) => notify("error", errorText(err, "Could not load the subscription")));
    return () => {
      live = false;
      setTimeout(() => setDetail(undefined), 200);
    };
  }, [id]);

  async function run(action: Action, done: string) {
    if (!detail) return;
    setBusy(action.kind);
    try {
      await subscriptionAction(base, detail, action);
      notify("success", done);
      const fresh = await api<Detail>(`/api/subscriptions/detail?id=${detail.id}`);
      setDetail(fresh);
      onChanged?.();
    } catch (err) {
      notify("error", errorText(err, "That didn't go through"));
    } finally {
      setBusy(undefined);
    }
  }

  const refundable = detail ? Number(detail.collected) - Number(detail.refunded) : 0;
  const live = detail && isLive(detail);
  const progress = detail ? (detail.paidPeriods / detail.periods) * 100 : 0;

  return (
    <Dialog open={id !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <div className="relative overflow-hidden border-b px-6 pb-6 pt-6">
          <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
          <DialogHeader className="relative">
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogDescription className="text-xs font-medium uppercase tracking-[0.12em]">Subscription</DialogDescription>
              {detail && <StatusBadge status={subBadge(detail)} />}
            </div>
            <DialogTitle className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {detail ? money(detail.amount) : <Shimmer className="inline-block h-8 w-24 align-middle" />}{" "}
              <span className="text-base font-medium text-muted-foreground"><Token /> / {detail ? periodName(detail.periodDays) : "period"}</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{detail?.name ?? " "}</p>
          </DialogHeader>
        </div>

        {!detail ? (
          <div className="space-y-4 p-6">
            <Shimmer className="h-2 w-full" rounded="rounded-full" />
            <LoadingState compact label="Loading subscription" />
            <LoadingRows count={3} dense />
          </div>
        ) : (
          <div className="space-y-5 p-6">
            {detail.status === "open" ? (
              <div className="space-y-2 rounded-xl border border-info/30 bg-info/6 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Users className="size-4 text-info" /> Waiting for its customer
                </p>
                <p className="text-xs text-muted-foreground">Send the link. The first person to subscribe becomes its customer.</p>
                <CopyButton value={subscribeLink(window.location.origin, detail.id)} label="Copy subscribe link" className="h-9 w-full justify-center rounded-lg border bg-card text-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payments made</span>
                  <span className="font-medium tabular-nums">
                    {detail.paidPeriods} of {detail.periods}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.7 }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Held now", value: detail.held, strong: true },
                { label: "Collected", value: detail.collected },
                { label: "Refunded", value: detail.refunded },
                { label: "Withdrawn", value: detail.withdrawn },
              ].map((m) => (
                <div key={m.label} className={cn("rounded-xl border p-3", m.strong && "border-brand/30 bg-brand/5")}>
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <p className="text-base font-semibold tabular-nums">{money(m.value)} <span className="text-xs font-normal text-muted-foreground"><Token /></span></p>
                </div>
              ))}
            </div>

            <div className="divide-y rounded-xl border px-4">
              <DetailRow label="Customer">
                {detail.paidWith ? (
                  <span>Bank transfer · {paidWithText(detail.paidWith)}</span>
                ) : detail.subscriber ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    {short(detail.subscriber, 8, 6)} <CopyButton value={detail.subscriber} label="" className="h-6 px-1.5" />
                  </span>
                ) : (
                  "Not yet"
                )}
              </DetailRow>
              <DetailRow label="Billing">{`${periodAdjective(detail.periodDays)}, ${detail.periods} payments`}</DetailRow>
              <DetailRow label="Started">{date(detail.startedAt)}</DetailRow>
              <DetailRow label="Next payment">{detail.due ? <span className="font-medium text-warning">Due now</span> : date(detail.nextChargeAt)}</DetailRow>
              <DetailRow label="Access until">{date(detail.accessUntil)}</DetailRow>
              {detail.cancelledAt && <DetailRow label="Cancelled">{date(detail.cancelledAt)}</DetailRow>}
              <DetailRow label="Deposit address">
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  {short(detail.vault, 6, 4)} <CopyButton value={detail.vault} label="" className="h-6 px-1.5" />
                </span>
              </DetailRow>
            </div>

            {detail.refundRequested && (
              <section className="space-y-3 rounded-xl border border-warning/30 bg-warning/6 p-4">
                <div className="flex items-start gap-3">
                  <IconChip icon={ShieldAlert} tone="warning" size="sm" />
                  <div>
                    <p className="text-sm font-medium">Customer asked for a refund</p>
                    <p className="text-xs text-muted-foreground">Requested {money(detail.requestedAmount)} <Token />. Refund below, or decline.</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-xl" disabled={!!busy} onClick={() => void run({ kind: "deny" }, "Request declined")}>
                  {busy === "deny" ? <Spinner /> : <Ban className="size-4" />} Decline request
                </Button>
              </section>
            )}

            {detail.subscriber && refundable > 0 && (
              <section className="space-y-3 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <IconChip icon={Undo2} tone="brand" size="sm" />
                  <div>
                    <p className="text-sm font-medium">Refund</p>
                    <p className="text-xs text-muted-foreground">
                      Any amount up to {money(refundable)} <Token />{live ? ", and the subscription keeps running" : ""}. Paid from what it holds first.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { label: "1 period", value: Math.min(Number(detail.amount), refundable) },
                    { label: "All", value: refundable },
                  ].map((p) => (
                    <button key={p.label} type="button" onClick={() => setRefund(decimal(p.value))} className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input aria-label="Refund amount" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
                  </div>
                  <Button className="h-11 rounded-xl px-5" disabled={!!busy || !(Number(refund) > 0)} onClick={() => void run({ kind: "refund", amount: refund }, "Refund sent")}>
                    {busy === "refund" && <Spinner />} Refund
                  </Button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 rounded-xl" disabled={!!busy || !(Number(detail.held) > 0)} onClick={() => void run({ kind: "withdraw" }, "Withdrawn to your account")}>
                {busy === "withdraw" ? <Spinner /> : <Landmark className="size-4" />} Withdraw {Number(detail.held) > 0 ? money(detail.held) : ""}
              </Button>
              <Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive" disabled={!!busy || !live} onClick={() => void run({ kind: "cancel" }, "Subscription cancelled")}>
                {busy === "cancel" ? <Spinner /> : <XCircle className="size-4" />} Cancel
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">History</p>
              {detail.history.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ol className="space-y-1">
                  {detail.history.map((h, i) => (
                    <motion.li key={`${h.at}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                      <IconChip icon={h.kind === "refund" ? ArrowUpRight : ArrowDownLeft} tone={h.kind === "refund" ? "warning" : "success"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{h.kind === "refund" ? "Refund" : `Payment ${h.period ?? "—"} of ${detail.periods}`}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(h.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {timeAgo(h.at)}
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums", h.kind === "refund" ? "text-warning" : "text-success")}>
                        {h.kind === "refund" ? "−" : "+"}
                        {money(h.amount)}
                      </span>
                      {h.txHash && <CopyButton value={h.txHash} label="" className="h-7 px-1.5" />}
                    </motion.li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/// A small tag for subscription payments in lists.
export function SubscriptionChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-inset ring-brand/20">
      <Repeat className="size-3" /> Subscription
    </span>
  );
}
