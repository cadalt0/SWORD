"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CHAINS } from "sword-sdk";
import Link from "next/link";
import { Inbox, Receipt, Search } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { Account, Me } from "../app/_components/Dashboard";
import { receiptHref } from "../app/_components/customer-data";
import { useIncomingTransfers } from "../app/_components/incoming";
import { DetailRow, EmptyState, IconChip, LoadingRows, PageHeader, Segmented } from "../app/_components/kit";
import { PageShell } from "../app/_components/PageShell";
import { activityMeta, activitySubtitle as subtitleOf, CopyButton, errorText, money, notify, short, timeAgo } from "../app/_components/shared";
import { Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

type Activity = { type: string; details: Record<string, unknown>; txHash: string | null; createdAt: string };
/// Activity that has a receipt: a payment, a refund, or a transfer.
const RECEIPT_TYPES = new Set(["order.paid", "subscription.charged", "subscription.subscribed", "subscription.refunded", "refund.paid", "funds.sent", "funds.received"]);

type Category = "all" | "payments" | "orders" | "refunds" | "subscriptions" | "account";

/// Which tab an entry belongs to.
function categoryOf(type: string): Exclude<Category, "all"> {
  if (type === "order.paid" || type === "subscription.charged" || type.startsWith("funds.")) return "payments";
  if (type.startsWith("refund.")) return "refunds";
  if (type.startsWith("subscription.") || type.startsWith("plan.")) return "subscriptions";
  if (type.startsWith("order.")) return "orders";
  return "account";
}

/// A label that fits the viewer: a merchant receives payments, a customer sends them.
function labelOf(a: Activity, role: "merchant" | "customer"): string {
  if (role === "merchant" && a.type === "order.paid") return "Order paid";
  return activityMeta(a.type).label;
}

/// The amount of an entry, when it has one. Signed by direction for the viewer.
function amountOf(a: Activity, role: "merchant" | "customer"): { text: string; incoming: boolean } | undefined {
  const raw = a.details.amount;
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const incoming = a.type === "funds.received" || (role === "merchant" && a.type === "subscription.charged");
  const outgoing = a.type === "funds.sent" || a.type === "fiat.withdrawn";
  return { text: `${incoming ? "+" : outgoing ? "−" : ""}${money(raw)} ${tokenOf(Number(a.details.chainId) || undefined)}`, incoming };
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function ActivityPage() {
  return (
    <PageShell>
      {(me) => {
        const account = me.accounts.find((a) => a.kind === me.user.role)!;
        return me.user.role === "customer" ? <CustomerActivity me={me} account={account} /> : <ActivityList role="merchant" extra={[]} account={account} />;
      }}
    </PageShell>
  );
}

/// Customers also see USDT that arrived in their account.
function CustomerActivity({ account }: { me: Me; account: Account }) {
  const incoming = useIncomingTransfers(account.chainId, account.address);
  const extra = useMemo(
    () => (incoming ?? []).map((t) => ({ type: "funds.received", details: { from: t.from, amount: t.amount, chainId: account.chainId }, txHash: t.hash, createdAt: t.at })),
    [incoming, account.chainId],
  );
  return <ActivityList role="customer" extra={extra} account={account} />;
}

function ActivityList({ role, extra, account }: { role: "merchant" | "customer"; extra: Activity[]; account: Account }) {
  const [activity, setActivity] = useState<Activity[] | undefined>();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Activity | undefined>();

  useEffect(() => {
    api<{ activity: Activity[] }>("/api/activity?limit=500")
      .then((r) => setActivity(r.activity))
      .catch((err) => notify("error", errorText(err, "Could not load activity")));
  }, []);

  const all = useMemo(() => (activity ? [...activity, ...extra].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) : undefined), [activity, extra]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: 0, payments: 0, orders: 0, refunds: 0, subscriptions: 0, account: 0 };
    for (const a of all ?? []) {
      c.all += 1;
      c[categoryOf(a.type)] += 1;
    }
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? [])
      .filter((a) => category === "all" || categoryOf(a.type) === category)
      .filter((a) => !q || [labelOf(a, role), a.txHash ?? "", ...Object.values(a.details).map(String)].join(" ").toLowerCase().includes(q));
  }, [all, category, query, role]);

  const groups = useMemo(() => {
    const out: { day: string; items: Activity[] }[] = [];
    for (const a of shown) {
      const day = dayLabel(a.createdAt);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(a);
      else out.push({ day, items: [a] });
    }
    return out;
  }, [shown]);

  const tabs: { value: Category; label: string }[] =
    role === "merchant"
      ? [
          { value: "all", label: "All" },
          { value: "payments", label: "Payments" },
          { value: "orders", label: "Orders" },
          { value: "subscriptions", label: "Subscriptions" },
          { value: "refunds", label: "Refunds" },
          { value: "account", label: "Account" },
        ]
      : [
          { value: "all", label: "All" },
          { value: "payments", label: "Payments" },
          { value: "refunds", label: "Refunds" },
          { value: "account", label: "Account" },
        ];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description={role === "merchant" ? "Every payment, order, subscription, and refund on your business." : "Every payment, transfer, and refund on your account."} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
          <Segmented id="activity-tabs" size="sm" value={category} onChange={setCategory} options={tabs.map((t) => ({ ...t, count: counts[t.value] }))} />
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by order, address, or plan" className="h-9 rounded-full pl-9" />
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {!all ? (
          <LoadingRows count={6} className="p-3" />
        ) : groups.length === 0 ? (
          <EmptyState icon={query ? Search : Inbox} title={query ? "Nothing matches" : "Nothing here yet"} description={query ? "Try another search." : "New activity shows up here as it happens."} />
        ) : (
          groups.map((g) => (
            <section key={g.day}>
              <p className="border-b bg-muted/40 px-5 py-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{g.day}</p>
              <ul className="divide-y">
                {g.items.map((a, i) => {
                  const meta = activityMeta(a.type);
                  const amount = amountOf(a, role);
                  return (
                    <motion.li key={`${a.createdAt}-${a.type}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}>
                      <button type="button" onClick={() => setOpen(a)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50">
                        <IconChip icon={meta.icon} tone={meta.tone} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{labelOf(a, role)}</p>
                          <p className="truncate text-xs text-muted-foreground">{subtitleOf(a)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {amount && <p className={cn("text-sm font-semibold tabular-nums", amount.incoming && "text-success")}>{amount.text}</p>}
                          <p className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <ActivityDetail activity={open} role={role} chainId={account.chainId} onOpenChange={(o) => !o && setOpen(undefined)} />
    </div>
  );
}

const LABELS: Record<string, string> = {
  orderId: "Order",
  subscriptionId: "Subscription",
  planId: "Plan ID",
  plan: "Plan",
  name: "Name",
  amount: "Amount",
  payer: "Paid by",
  subscriber: "Subscriber",
  from: "From",
  to: "To",
  period: "Payment",
  via: "Method",
  initiated: "Started by",
  chainId: "Network",
};

/// Turns one stored detail into something a person reads.
function present(key: string, value: unknown, details: Record<string, unknown>): React.ReactNode {
  const text = String(value);
  if (key === "chainId") return CHAINS[Number(value)]?.chain.name ?? text;
  if (key === "amount") return <span className="font-semibold tabular-nums">{money(text)} <Token /></span>;
  if (key === "via") return text === "transfer" ? "Scan and pay" : text;
  if (key === "initiated") return value ? "You" : "Customer";
  if (key === "period") return typeof details.periods === "number" ? `${text} of ${details.periods}` : text;
  if (/^0x[0-9a-fA-F]{40}$/.test(text) || /^0x[0-9a-fA-F]{64}$/.test(text)) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs">
        {short(text, 8, 6)} <CopyButton value={text} label="" className="h-6 px-1.5" />
      </span>
    );
  }
  return text;
}

/// One activity entry in full.
function ActivityDetail({ activity, role, chainId, onOpenChange }: { activity: Activity | undefined; role: "merchant" | "customer"; chainId: number; onOpenChange: (open: boolean) => void }) {
  const meta = activity ? activityMeta(activity.type) : undefined;
  const amount = activity ? amountOf(activity, role) : undefined;
  const rows = activity ? Object.entries(activity.details).filter(([k]) => k !== "periods" && k !== "amount" && LABELS[k]) : [];
  return (
    <Dialog open={activity !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-md">
        {activity && meta && (
          <>
            <div className="relative overflow-hidden border-b px-6 pb-6 pt-7 text-center">
              <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
              <DialogHeader className="relative items-center">
                <IconChip icon={meta.icon} tone={meta.tone} size="lg" />
                <DialogTitle className="mt-3 text-lg">{labelOf(activity, role)}</DialogTitle>
                {amount && <p className={cn("text-3xl font-semibold tracking-tight tabular-nums", amount.incoming && "text-success")}>{amount.text}</p>}
                <DialogDescription>{new Date(activity.createdAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 p-6">
              <div className="divide-y rounded-xl border px-4">
                {rows.map(([k, v]) => (
                  <DetailRow key={k} label={LABELS[k]}>
                    {present(k, v, activity.details)}
                  </DetailRow>
                ))}
                {!rows.some(([k]) => k === "chainId") && <DetailRow label="Network">{CHAINS[chainId]?.chain.name ?? chainId}</DetailRow>}
                <DetailRow label="When">{timeAgo(activity.createdAt)}</DetailRow>
                {activity.txHash && activity.txHash.length > 10 && (
                  <DetailRow label="Transaction">
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      {short(activity.txHash, 8, 6)} <CopyButton value={activity.txHash} label="" className="h-6 px-1.5" />
                    </span>
                  </DetailRow>
                )}
              </div>
              {activity.txHash && /^0x[0-9a-fA-F]{64}$/.test(activity.txHash) && RECEIPT_TYPES.has(activity.type) && (
                <Link href={receiptHref(activity.txHash, chainId)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium transition-colors hover:bg-muted">
                  <Receipt className="size-4" /> View receipt
                </Link>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
