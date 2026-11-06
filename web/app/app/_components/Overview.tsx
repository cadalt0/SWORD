"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, Clock3, Inbox, Plus, Receipt, Repeat, RotateCcw, ShieldCheck, ShieldOff, TrendingUp, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { Section } from "./AppSidebar";
import type { Account } from "./Dashboard";
import { AnimatedNumber, EmptyState, FadeIn, IconChip, LoadingRows, PageHeader, Segmented, Shimmer, Stagger, StaggerItem, StatCard } from "./kit";
import { SubscriptionChip } from "./SubscriptionKit";
import { activityMeta, activitySubtitle, errorText, money, notify, short, StatusBadge, timeAgo } from "./shared";
import { Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

/// One subscription period collected.
type SubPayment = { subscriptionId: string; name: string; subscriber: string | null; period: number | null; periods: number | null; amount: string; txHash: string | null; at: string };
type Order = { orderId: string; reference: string; amount: string; status: string; createdAt: string; expiresAt?: string; refundedAmount?: string };
type Activity = { type: string; details: Record<string, unknown>; txHash: string | null; createdAt: string };
type Permission = { grantActive: boolean; grant?: { expiry: string } };
type Range = "7" | "14" | "30";

const PAID = new Set(["paid", "partially_refunded", "refunded"]);

/// The lines the volume chart can show. Paid is net of refunds.
const SERIES = [
  { key: "paid", label: "Paid", color: "var(--success)" },
  { key: "refunded", label: "Refunded", color: "var(--chart-1)" },
  { key: "pending", label: "Pending", color: "var(--chart-4)" },
  { key: "expired", label: "Expired", color: "var(--chart-5)" },
  { key: "subscriptions", label: "Subscriptions", color: "oklch(0.7 0.13 195)" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

const volumeConfig = Object.fromEntries(SERIES.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
const LINES_KEY = "wm-chart-lines";

const MIX = [
  { key: "paid", label: "Paid", color: "var(--chart-2)" },
  { key: "pending", label: "Pending", color: "var(--chart-4)" },
  { key: "refunded", label: "Refunded", color: "var(--chart-1)" },
  { key: "expired", label: "Expired", color: "var(--chart-5)" },
] as const;

const mixConfig = Object.fromEntries(MIX.map((m) => [m.key, { label: m.label, color: m.color }])) satisfies ChartConfig;

/// A calendar day in the viewer's time zone, as YYYY-MM-DD. Buckets and orders must use the same rule.
function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/// Refunded USDT on an order (the API gives base units).
const refundedOf = (o: Order) => Number(o.refundedAmount ?? "0") / 1e6;
/// What the merchant kept from a paid order: the amount less refunds.
const netOf = (o: Order) => Math.max(0, Number(o.amount) - refundedOf(o));

/// Volume per local day for the last `days` days, oldest first, one value per series.
function dailySeries(orders: Order[], subs: SubPayment[], days: number) {
  const out: ({ day: string } & Record<SeriesKey, number>)[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    index.set(dayKey(d), out.length);
    out.push({ day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), paid: 0, refunded: 0, pending: 0, expired: 0, subscriptions: 0 });
  }
  for (const o of orders) {
    const i = index.get(dayKey(new Date(o.createdAt)));
    if (i === undefined) continue;
    const row = out[i];
    if (PAID.has(o.status)) {
      row.paid += netOf(o);
      row.refunded += refundedOf(o);
    } else if (mixOf(o) === "pending") {
      row.pending += Number(o.amount);
    } else {
      row.expired += Number(o.amount);
    }
  }
  for (const p of subs) {
    const i = index.get(dayKey(new Date(p.at)));
    if (i === undefined) continue;
    out[i].paid += Number(p.amount);
    out[i].subscriptions += Number(p.amount);
  }
  return out;
}

/// The bucket an order falls in for the order-mix chart.
function mixOf(o: Order): (typeof MIX)[number]["key"] {
  if (o.status === "refunded" || o.status === "partially_refunded") return "refunded";
  if (PAID.has(o.status)) return "paid";
  if (o.status === "open" && (!o.expiresAt || Date.now() / 1000 <= Number(o.expiresAt))) return "pending";
  return "expired";
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

/// The merchant overview: revenue, order mix, key numbers, recent orders, and recent activity.
export function Overview({ chainId, account, onSection, onNewOrder }: { chainId: number; account: Account; onSection: (s: Section) => void; onNewOrder: () => void }) {
  const [orders, setOrders] = useState<Order[] | undefined>();
  const [subPayments, setSubPayments] = useState<SubPayment[]>([]);
  const [activity, setActivity] = useState<Activity[] | undefined>();
  const [permission, setPermission] = useState<Permission | undefined>();
  const [range, setRange] = useState<Range>("14");
  const [lines, setLines] = useState<SeriesKey[]>(() => {
    if (typeof window === "undefined") return ["paid"];
    try {
      const saved = JSON.parse(localStorage.getItem(LINES_KEY) ?? "null") as SeriesKey[] | null;
      return saved && saved.length ? saved : ["paid"];
    } catch {
      return ["paid"];
    }
  });

  function toggleLine(key: SeriesKey) {
    setLines((current) => {
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      const kept = next.length ? next : current;
      localStorage.setItem(LINES_KEY, JSON.stringify(kept));
      return kept;
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [a, o] = await Promise.all([
          api<{ activity: Activity[] }>("/api/activity"),
          api<{ orders: Order[] }>(`/api/orders?chainId=${chainId}`),
        ]);
        setActivity(a.activity);
        setOrders(o.orders);
        api<{ payments: SubPayment[] }>("/api/subscriptions/payments")
          .then((r) => setSubPayments(r.payments))
          .catch(() => setSubPayments([]));
        if (account.custody === "self") setPermission(await api<Permission>(`/api/permission?chainId=${chainId}`));
      } catch (err) {
        notify("error", errorText(err, "Could not load the overview"));
      }
    })();
  }, [chainId, account.custody]);

  const list = orders ?? [];
  const paid = list.filter((o) => PAID.has(o.status));
  const volume = paid.reduce((sum, o) => sum + netOf(o), 0) + subPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const average = paid.length ? paid.reduce((sum, o) => sum + Number(o.amount), 0) / paid.length : 0;
  const pending = list.filter((o) => mixOf(o) === "pending").length;
  const refunds = list.filter((o) => o.status === "refunded" || o.status === "partially_refunded").length;
  const chart = useMemo(() => dailySeries(orders ?? [], subPayments, Number(range)), [orders, subPayments, range]);
  const rangeVolume = chart.reduce((s, d) => s + d.paid, 0);
  const rangeRefunded = chart.reduce((s, d) => s + d.refunded, 0);
  const mix = useMemo(() => MIX.map((m) => ({ ...m, value: (orders ?? []).filter((o) => mixOf(o) === m.key).length })), [orders]);
  // Orders and subscription payments together, newest first: both are money coming in.
  const recent: ({ kind: "order"; at: string; order: Order } | { kind: "sub"; at: string; payment: SubPayment })[] = [
    ...list.map((o) => ({ kind: "order" as const, at: o.createdAt, order: o })),
    ...subPayments.map((p) => ({ kind: "sub" as const, at: p.at, payment: p })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={greeting()}
        title="Your business at a glance"
        description="Payments, orders, and refunds across your Sword merchant account."
        actions={
          <>
            {account.custody === "self" && (
              <span
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium",
                  permission === undefined ? "text-muted-foreground" : permission.grantActive ? "border-success/30 bg-success/8 text-success" : "border-warning/30 bg-warning/8 text-warning",
                )}
              >
                {permission?.grantActive ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
                {permission === undefined ? "Checking permission…" : permission.grantActive ? "Relayer permission active" : "No relayer permission"}
              </span>
            )}
            <Link
              href="/quick-payments"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium shadow-soft transition-colors hover:bg-muted"
            >
              <Zap className="size-4 text-brand" /> Quick payment
            </Link>
            <Button onClick={onNewOrder} className="h-9 gap-1.5 rounded-full px-4">
              <Plus className="size-4" /> New order
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.05} className="surface-card overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-0 md:p-6 md:pb-0">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">Net paid volume</p>
              <div className="mt-2 flex items-baseline gap-2">
                {orders ? (
                  <AnimatedNumber value={rangeVolume} format={usd} className="text-4xl font-semibold tracking-tight" />
                ) : (
                  <Shimmer className="h-10 w-40" rounded="rounded-lg" />
                )}
                <span className="text-sm font-medium text-muted-foreground"><Token /></span>
              </div>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-success" /> Last {range} days, after {usd(rangeRefunded)} <Token /> refunded · {usd(volume)} <Token /> all time
              </p>
            </div>
            <Segmented
              id="range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "7", label: "7D" },
                { value: "14", label: "14D" },
                { value: "30", label: "30D" },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 px-5 pt-4 md:px-6">
            {SERIES.map((sr) => {
              const on = lines.includes(sr.key);
              return (
                <button
                  key={sr.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLine(sr.key)}
                  className={cn(
                    "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all",
                    on ? "border-foreground/15 bg-muted text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-2 rounded-full transition-opacity" style={{ background: sr.color, opacity: on ? 1 : 0.35 }} />
                  {sr.label}
                </button>
              );
            })}
          </div>
          <div className="px-2 pb-3 pt-2 md:px-3">
            {!orders ? (
              <Shimmer className="m-3 h-60" rounded="rounded-xl" />
            ) : (
              <ChartContainer config={volumeConfig} className="aspect-auto h-64 w-full">
                <AreaChart data={chart} margin={{ left: 8, right: 12, top: 8, bottom: 0 }} accessibilityLayer>
                  <defs>
                    {SERIES.map((sr) => (
                      <linearGradient key={sr.key} id={`fill-${sr.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={`var(--color-${sr.key})`} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={`var(--color-${sr.key})`} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} className="text-[11px]" />
                  <YAxis tickLine={false} axisLine={false} width={44} className="text-[11px]" />
                  <ChartTooltip cursor={{ strokeDasharray: "4 4" }} content={<ChartTooltipContent indicator="line" />} />
                  {SERIES.filter((sr) => lines.includes(sr.key)).map((sr) => (
                    <Area
                      key={sr.key}
                      dataKey={sr.key}
                      type="monotone"
                      stroke={`var(--color-${sr.key})`}
                      fill={`url(#fill-${sr.key})`}
                      strokeWidth={2.25}
                      animationDuration={700}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="surface-card flex flex-col p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">Order mix</p>
              <p className="mt-1 text-sm">All orders by state</p>
            </div>
            <IconChip icon={Receipt} size="sm" />
          </div>
          {!orders ? (
            <Shimmer className="mx-auto mt-6 size-40" rounded="rounded-full" />
          ) : list.length === 0 ? (
            <EmptyState icon={Inbox} title="No orders yet" description="Your order mix appears after the first order." className="flex-1 py-6" />
          ) : (
            <>
              <div className="relative mx-auto mt-2">
                <ChartContainer config={mixConfig} className="aspect-square h-44">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                    <Pie data={mix.filter((m) => m.value > 0)} dataKey="value" nameKey="key" innerRadius={52} outerRadius={76} paddingAngle={3} cornerRadius={6} strokeWidth={0} animationDuration={900}>
                      {mix.filter((m) => m.value > 0).map((m) => (
                        <Cell key={m.key} fill={m.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <AnimatedNumber value={list.length} className="text-2xl font-semibold tracking-tight" />
                    <p className="text-[11px] text-muted-foreground">orders</p>
                  </div>
                </div>
              </div>
              <ul className="mt-auto grid grid-cols-2 gap-2 pt-4">
                {mix.map((m) => (
                  <li key={m.key} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </span>
                    <span className="font-medium tabular-nums">{m.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </FadeIn>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.1}>
        <StaggerItem>
          <StatCard label="Paid orders" value={orders ? paid.length : undefined} icon={Receipt} tone="success" hint="Including refunded orders" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Awaiting payment" value={orders ? pending : undefined} icon={Clock3} tone="info" hint="Open for 20 minutes each" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Average order" value={orders ? average : undefined} format={usd} suffix={tokenOf(chainId)} icon={CircleDollarSign} tone="brand" hint="Across paid orders" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Refunded orders" value={orders ? refunds : undefined} icon={RotateCcw} tone="warning" hint="Fully or partly refunded" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-5">
        <FadeIn delay={0.15} className="surface-card lg:col-span-3">
          <div className="flex items-center justify-between p-5 pb-3 md:px-6">
            <div>
              <h3 className="text-sm font-semibold">Recent orders</h3>
              <p className="text-xs text-muted-foreground">Orders and subscription payments</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onSection("orders")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </div>
          {!orders ? (
            <LoadingRows count={4} className="px-3 pb-3" />
          ) : recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No orders yet" description="Create an order and share its pay link with your customer." action={<Button size="sm" onClick={onNewOrder}><Plus className="size-4" /> New order</Button>} />
          ) : (
            <ul className="divide-y px-2 pb-2">
              {recent.map((r, i) =>
                r.kind === "order" ? (
                  <li key={`o-${r.order.orderId}`} className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50">
                    <IconChip icon={Receipt} size="sm" tone={PAID.has(r.order.status) ? "success" : "neutral"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.order.reference}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{short(r.order.orderId, 6, 4)} · {timeAgo(r.order.createdAt)}</p>
                    </div>
                    <StatusBadge status={mixOf(r.order) === "expired" && r.order.status === "open" ? "expired" : r.order.status === "open" ? "pending" : r.order.status} className="hidden sm:inline-flex" />
                    <p className="w-28 text-right text-sm font-semibold tabular-nums">{money(r.order.amount)} <span className="text-xs font-normal text-muted-foreground"><Token /></span></p>
                  </li>
                ) : (
                  <li key={`s-${r.payment.subscriptionId}-${r.payment.period}-${i}`}>
                    <Link href={`/subscriptions?id=${r.payment.subscriptionId}`} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
                      <IconChip icon={Repeat} size="sm" tone="brand" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          {r.payment.name} <SubscriptionChip />
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {r.payment.subscriber ? short(r.payment.subscriber, 6, 4) : "Subscriber"} · payment {r.payment.period ?? "—"}
                          {r.payment.periods ? ` of ${r.payment.periods}` : ""} · {timeAgo(r.payment.at)}
                        </p>
                      </div>
                      <StatusBadge status="paid" className="hidden sm:inline-flex" />
                      <p className="w-28 text-right text-sm font-semibold tabular-nums">{money(r.payment.amount)} <span className="text-xs font-normal text-muted-foreground"><Token /></span></p>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          )}
        </FadeIn>

        <FadeIn delay={0.2} className="surface-card lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3 md:px-6">
            <div>
              <h3 className="text-sm font-semibold">Activity</h3>
              <p className="text-xs text-muted-foreground">What happened on your account</p>
            </div>
            <ViewAllActivity />
          </div>
          <ActivityTimeline activity={activity} merchant />
        </FadeIn>
      </div>
    </div>
  );
}

/// The arrow to the full activity page.
export function ViewAllActivity() {
  return (
    <Link href="/activity" className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      View all <ArrowRight className="size-3.5" />
    </Link>
  );
}

/// Recent actions as a vertical timeline with a coloured icon per kind.
export function ActivityTimeline({ activity, merchant = false, limit = 7 }: { activity: Activity[] | undefined; merchant?: boolean; limit?: number }) {
  if (!activity) {
    return (
      <LoadingRows count={4} dense className="px-3 pb-3" />
    );
  }
  if (activity.length === 0) return <EmptyState icon={Inbox} title="Nothing yet" description="Actions you take will appear here." />;
  return (
    <ol className="relative px-5 pb-5 md:px-6">
      <span aria-hidden className="absolute bottom-8 left-[34px] top-3 w-px bg-border md:left-[38px]" />
      {activity.slice(0, limit).map((a, i) => {
        const meta = activityMeta(a.type);
        const label = merchant && a.type === "order.paid" ? "Order paid" : meta.label;
        return (
          <FadeIn key={`${a.createdAt}-${i}`} delay={0.04 * i} className="relative flex items-start gap-3 py-2">
            <IconChip icon={meta.icon} tone={meta.tone} size="sm" className="relative z-10 bg-card" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{label}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-mono text-[11px] text-muted-foreground">{activitySubtitle(a) || "—"}</p>
                {(typeof a.details.amount === "string" || typeof a.details.amount === "number") && (a.type === "funds.received" || a.type === "funds.sent" || a.type === "subscription.charged") && (
                  <span className={cn("shrink-0 text-xs font-semibold tabular-nums", a.type === "funds.sent" ? "text-foreground" : "text-success")}>
                    {a.type === "funds.sent" ? "−" : "+"}
                    {money(String(a.details.amount))} <Token />
                  </span>
                )}
              </div>
            </div>
          </FadeIn>
        );
      })}
    </ol>
  );
}
