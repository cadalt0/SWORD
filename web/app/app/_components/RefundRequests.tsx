"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Ban, CheckCircle2, ChevronRight, Clock3, RefreshCw, Repeat, Receipt, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { EmptyState, IconChip, LoadingRows, PageHeader, Segmented, StatCard, Stagger, StaggerItem } from "./kit";
import { OrderDialog, type Act, type Base, type Order } from "./MerchantPanel";
import { errorText, money, notify, short, timeAgo } from "./shared";
import { SubscriptionDetail, type Sub } from "./SubscriptionKit";
import { Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

/// Where one refund request stands.
type State = "needs" | "approved" | "declined" | "refunded";
type Tab = "needs" | "approved" | "done" | "all";
type Item =
  | { kind: "order"; state: State; at: string; amount: number; order: Order }
  | { kind: "sub"; state: State; at: string; amount: number; sub: Sub };

const STATES: Record<State, { label: string; tone: "warning" | "info" | "destructive" | "success"; icon: typeof Clock3 }> = {
  needs: { label: "Needs your decision", tone: "warning", icon: RotateCcw },
  approved: { label: "Approved, not paid yet", tone: "info", icon: Clock3 },
  declined: { label: "Declined", tone: "destructive", icon: Ban },
  refunded: { label: "Refunded", tone: "success", icon: CheckCircle2 },
};

const base6 = (v: string) => Number(v) / 1e6;
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function orderState(o: Order): State | undefined {
  if (o.refundStatus === "requested") return "needs";
  if (o.refundStatus === "approved") return "approved";
  if (o.refundStatus === "denied") return "declined";
  if (base6(o.refundedAmount) > 0) return "refunded";
  return undefined;
}

function orderAmount(o: Order, state: State): number {
  if (state === "needs") return base6(o.refundRequestedAmount);
  if (state === "approved") return base6(o.refundApprovedAmount);
  if (state === "refunded") return base6(o.refundedAmount);
  return base6(o.refundRequestedAmount) || num(o.amount);
}

const tabOf = (s: State): Exclude<Tab, "all"> => (s === "needs" ? "needs" : s === "approved" ? "approved" : "done");

/// Every refund request a merchant has: the ones waiting for a decision first, then approved ones waiting to be paid,
/// then the finished ones. Each opens the same details box as the Orders and Subscriptions pages.
export function RefundRequests({ chainId, account, wallet }: { chainId: number; account: Account; wallet: Address | undefined }) {
  const [orders, setOrders] = useState<Order[] | undefined>();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("needs");
  const [query, setQuery] = useState("");
  const [openOrder, setOpenOrder] = useState<string | undefined>();
  const [openSub, setOpenSub] = useState<string | undefined>();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [o, s] = await Promise.all([
        api<{ orders: Order[] }>(`/api/orders?chainId=${chainId}`),
        api<{ subscriptions: Sub[] }>(`/api/subscriptions?chainId=${chainId}`).catch(() => ({ subscriptions: [] as Sub[] })),
      ]);
      setOrders(o.orders);
      setSubs(s.subscriptions);
    } catch (err) {
      notify("error", errorText(err, "Could not load refund requests"));
      setOrders((current) => current ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [chainId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  /// Runs one action from the order box, then refreshes the list.
  const act: Act = async (label, fn) => {
    setBusy(true);
    try {
      await fn();
      notify("success", `${label} confirmed`);
      await load();
    } catch (err) {
      notify("error", errorText(err, `${label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const o of orders ?? []) {
      const state = orderState(o);
      if (state) out.push({ kind: "order", state, at: o.createdAt, amount: orderAmount(o, state), order: o });
    }
    for (const s of subs) {
      const state: State | undefined = s.refundRequested ? "needs" : num(s.refunded) > 0 ? "refunded" : undefined;
      if (state) out.push({ kind: "sub", state, at: s.startedAt ? new Date(Number(s.startedAt) * 1000).toISOString() : s.createdAt, amount: state === "needs" ? num(s.requestedAmount) : num(s.refunded), sub: s });
    }
    const rank: Record<State, number> = { needs: 0, approved: 1, declined: 2, refunded: 3 };
    return out.sort((a, b) => rank[a.state] - rank[b.state] || +new Date(b.at) - +new Date(a.at));
  }, [orders, subs]);

  const counts = useMemo(() => {
    const c = { needs: 0, approved: 0, done: 0, all: items.length };
    for (const it of items) c[tabOf(it.state)] += 1;
    return c;
  }, [items]);
  const owed = items.filter((i) => i.state === "needs" || i.state === "approved").reduce((s, i) => s + i.amount, 0);
  const paidBack = items.filter((i) => i.state === "refunded").reduce((s, i) => s + i.amount, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (tab !== "all" && tabOf(it.state) !== tab) return false;
      if (!q) return true;
      const hay = it.kind === "order" ? [it.order.reference, it.order.orderId, it.order.payer ?? ""] : [it.sub.name, it.sub.reference, it.sub.id, it.sub.subscriber ?? ""];
      return hay.join(" ").toLowerCase().includes(q);
    });
  }, [items, tab, query]);

  const base: Base = { chainId, account, wallet };
  const order = orders?.find((o) => o.orderId === openOrder);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="Every refund request from your customers. Review one to accept it, change the amount, or decline."
        actions={
          <Button variant="outline" size="icon" className="size-9 rounded-full" onClick={() => void load()} disabled={busy || refreshing} aria-label="Refresh">
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <Stagger className="grid gap-3 sm:grid-cols-3">
        <StaggerItem>
          <StatCard label="Need your decision" value={orders ? counts.needs : undefined} icon={RotateCcw} tone="warning" hint="Customers are waiting" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Still to pay back" value={orders ? owed : undefined} format={usdt2} suffix={tokenOf(chainId)} icon={Clock3} tone="info" hint="Requested or approved, not paid" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Paid back" value={orders ? paidBack : undefined} format={usdt2} suffix={tokenOf(chainId)} icon={CheckCircle2} tone="success" hint="Across orders and subscriptions" />
        </StaggerItem>
      </Stagger>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between md:px-4">
          <Segmented
            id="refund-tabs"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "needs", label: "Needs decision", count: counts.needs },
              { value: "approved", label: "Approved", count: counts.approved },
              { value: "done", label: "Done", count: counts.done },
              { value: "all", label: "All", count: counts.all },
            ]}
          />
          <div className="relative md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order, plan or payer" className="h-9 rounded-full pl-9" />
          </div>
        </div>

        {orders === undefined ? (
          <LoadingRows count={4} className="p-3" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={query ? Search : RotateCcw}
            title={query ? "Nothing matches" : tab === "needs" ? "No requests waiting" : "Nothing here yet"}
            description={query ? "Try another search." : tab === "needs" ? "When a customer asks for a refund, it shows up here for you to accept or decline." : "Refund requests in this group will show up here."}
          />
        ) : (
          <ul className="divide-y">
            {shown.map((it, i) => {
              const meta = STATES[it.state];
              const key = it.kind === "order" ? it.order.orderId : it.sub.id;
              const title = it.kind === "order" ? it.order.reference : it.sub.name;
              const who = it.kind === "order" ? it.order.payer : it.sub.subscriber;
              const original = it.kind === "order" ? num(it.order.amount) : num(it.sub.collected);
              return (
                <motion.li key={`${it.kind}-${key}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <button type="button" onClick={() => (it.kind === "order" ? setOpenOrder(it.order.orderId) : setOpenSub(it.sub.id))} className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 md:px-5">
                    <IconChip icon={it.kind === "order" ? Receipt : Repeat} tone={meta.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {title} <span className="text-xs font-normal text-muted-foreground">{it.kind === "order" ? "Order" : "Subscription"}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {who ? `From ${short(who, 6, 4)}` : "Customer"} · {timeAgo(it.at)} · paid {money(original)} <Token />
                      </p>
                      <p className={cn("mt-0.5 text-xs font-medium", it.state === "needs" ? "text-warning" : it.state === "refunded" ? "text-success" : it.state === "declined" ? "text-destructive" : "text-muted-foreground")}>{meta.label}</p>
                    </div>
                    <p className="w-28 text-right text-sm font-semibold tabular-nums">
                      {money(it.amount)} <span className="text-xs font-normal text-muted-foreground"><Token /></span>
                    </p>
                    {it.state === "needs" || it.state === "approved" ? (
                      <span className="hidden h-8 items-center rounded-full bg-warning px-3 text-xs font-medium text-black sm:inline-flex">Review</span>
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {order && <OrderDialog key={order.orderId} open onOpenChange={(o) => !o && setOpenOrder(undefined)} order={order} base={base} busy={busy} act={act} />}
      <SubscriptionDetail id={openSub} base={base} onOpenChange={(o) => !o && setOpenSub(undefined)} onChanged={() => void load()} />
    </div>
  );
}

const usdt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
