"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Fingerprint,
  Link2,
  Plus,
  Receipt,
  Repeat,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client/api";
import { runAction } from "@/lib/client/actions";
import { payLink } from "@/lib/shared/paylink";
import type { Address } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { DetailRow, EmptyState, FadeIn, IconChip, LoadingRows, PageHeader, Segmented, Shimmer, Spinner, SuccessMark } from "./kit";
import { CopyButton, decimal, errorText, money, notify, short, StatusBadge, timeAgo, usdt } from "./shared";
import { createSubscription, draftValid, emptyDraft, SubscriptionChip, SubscriptionCreated, SubscriptionFields, type SubscriptionDraft } from "./SubscriptionKit";
import { Token } from "@/lib/client/token";
import { paidWithText, type PaidWith } from "./Fiat";

type Registration = { merchantId: string; registered: boolean; orderBook: string | null };
export type Order = {
  orderId: string;
  reference: string;
  /// Decimal USDT, as stored with the order.
  amount: string;
  status: string;
  payer: string | null;
  collector: string | null;
  createdAt: string;
  expiresAt: string;
  refundStatus: string;
  /// The refund amounts below are base units, read from the chain.
  refundRequestedAmount: string;
  refundApprovedAmount: string;
  refundedAmount: string;
  /// Set when the customer paid in local money. Its money is settled to the merchant in that currency.
  paidWith?: PaidWith;
};
type Filter = "all" | "pending" | "paid" | "subscriptions" | "refunds" | "closed";
/// One subscription period collected. Shown in the orders list next to one-time orders.
type SubPayment = { subscriptionId: string; name: string; subscriber: string | null; period: number | null; periods: number | null; amount: string; txHash: string | null; at: string };
type ListItem = { kind: "order"; at: string; order: Order } | { kind: "sub"; at: string; payment: SubPayment };

/// An open order is pending until its payment window closes, then it is expired.
export function displayStatus(o: Order): string {
  if (o.status !== "open") return o.status;
  return Date.now() / 1000 > Number(o.expiresAt) ? "expired" : "pending";
}

function filterOf(o: Order): Exclude<Filter, "all"> {
  const s = displayStatus(o);
  if (o.refundStatus === "requested" || o.refundStatus === "approved" || s === "refunded" || s === "partially_refunded") return "refunds";
  if (s === "pending") return "pending";
  if (s === "paid") return "paid";
  return "closed";
}

/// A pay link for display: the site, then the end of the order id. The full link is what gets copied.
function shortLink(link: string, orderId: string): string {
  try {
    return `${new URL(link).host}/app/…${orderId.slice(-6)}`;
  } catch {
    return short(link, 18, 6);
  }
}

/// The link the customer opens to pay the order.
function linkFor(chainId: number, merchant: string, orderId: string): string {
  return payLink(window.location.origin, chainId, merchant, orderId);
}

/// Merchant sections: orders with refund decisions, and the account (registration).
export function MerchantPanel({
  chainId,
  account,
  wallet,
  section,
  openCreate = false,
}: {
  chainId: number;
  account: Account;
  wallet: Address | undefined;
  section: "orders" | "account";
  /// Open the new-order form straight away, without waiting for the list to load.
  openCreate?: boolean;
}) {
  const [registration, setRegistration] = useState<Registration | undefined>();
  const [orders, setOrders] = useState<Order[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(openCreate);
  const [subPayments, setSubPayments] = useState<SubPayment[]>([]);

  async function loadRegistration() {
    try {
      setRegistration(await api<Registration>(`/api/merchant/status?chainId=${chainId}`));
    } catch (err) {
      notify("error", errorText(err, "Could not read the registration"));
    }
  }

  async function loadOrders() {
    setRefreshing(true);
    try {
      const [o, p] = await Promise.all([
        api<{ orders: Order[] }>(`/api/orders?chainId=${chainId}`),
        api<{ payments: SubPayment[] }>("/api/subscriptions/payments").catch(() => ({ payments: [] as SubPayment[] })),
      ]);
      setSubPayments(p.payments);
      setOrders(o.orders);
    } catch (err) {
      notify("error", errorText(err, "Could not load orders"));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadRegistration();
    void loadOrders();
    // reload when the chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  /// Runs one action, then refreshes the numbers and the list.
  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      notify("success", `${label} confirmed`);
      await loadRegistration();
      await loadOrders();
    } catch (err) {
      notify("error", errorText(err, `${label} failed`));
    } finally {
      setBusy(false);
    }
  }

  const base = { chainId, account, wallet };
  const registered = registration?.registered ?? false;

  const counts = useMemo(() => {
    const c = { all: subPayments.length, pending: 0, paid: 0, subscriptions: subPayments.length, refunds: 0, closed: 0 };
    for (const o of orders ?? []) {
      c.all += 1;
      c[filterOf(o)] += 1;
    }
    return c;
  }, [orders, subPayments]);
  const needsAction = (orders ?? []).filter((o) => o.refundStatus === "requested").length;

  // One-time orders and subscription payments in one list, newest first.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: ListItem[] = [
      ...(filter === "subscriptions" ? [] : (orders ?? []).filter((o) => filter === "all" || filterOf(o) === filter).map((o) => ({ kind: "order" as const, at: o.createdAt, order: o }))),
      ...(filter === "all" || filter === "subscriptions" ? subPayments.map((p) => ({ kind: "sub" as const, at: p.at, payment: p })) : []),
    ];
    return items
      .filter((it) =>
        !q
          ? true
          : it.kind === "order"
            ? it.order.reference.toLowerCase().includes(q) || it.order.orderId.toLowerCase().includes(q)
            : [it.payment.name, it.payment.subscriber ?? "", it.payment.subscriptionId].join(" ").toLowerCase().includes(q),
      )
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [orders, subPayments, filter, query]);

  if (section === "orders") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Orders"
          description="Create payment requests, share pay links, and settle refunds. Status is read from the chain."
          actions={
            <>
              <Button variant="outline" size="icon" className="size-9 rounded-full" onClick={loadOrders} disabled={busy || refreshing} aria-label="Refresh">
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              </Button>
              <Button className="h-9 gap-1.5 rounded-full px-4" onClick={() => setCreating(true)} disabled={registration !== undefined && !registered}>
                <Plus className="size-4" /> New order
              </Button>
            </>
          }
        />

        <AnimatePresence>
          {needsAction > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onClick={() => setFilter("refunds")}
              className="flex w-full items-center gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-3.5 text-left"
            >
              <IconChip icon={ShieldAlert} tone="warning" size="sm" />
              <p className="flex-1 text-sm">
                <span className="font-medium">{needsAction} refund {needsAction === 1 ? "request needs" : "requests need"} your decision.</span>{" "}
                <span className="text-muted-foreground">Open the order to approve or deny.</span>
              </p>
              <ChevronRight className="size-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        <FadeIn delay={0.05} className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 md:px-4">
            <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
              <Segmented
                id="order-filter"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "pending", label: "Pending", count: counts.pending },
                  { value: "paid", label: "Paid", count: counts.paid },
                  { value: "refunds", label: "Refunds", count: counts.refunds },
                  { value: "subscriptions", label: "Subscriptions", count: counts.subscriptions },
                  { value: "closed", label: "Closed", count: counts.closed },
                ]}
              />
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, subscription, or ID" className="h-9 rounded-full pl-9" />
            </div>
          </div>

          {!orders ? (
            <LoadingRows count={4} className="p-3" />
          ) : orders.length === 0 && subPayments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No orders yet"
              description={registered ? "Create your first order and share its pay link with the customer." : "Register your merchant in Account to start taking orders."}
              action={registered && <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New order</Button>}
            />
          ) : shown.length === 0 ? (
            <EmptyState icon={Search} title="No matching orders" description="Try another filter or search term." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 pl-5 text-xs font-medium">Order</TableHead>
                  <TableHead className="h-10 text-right text-xs font-medium">Amount</TableHead>
                  <TableHead className="h-10 text-xs font-medium">Status</TableHead>
                  <TableHead className="hidden h-10 text-xs font-medium lg:table-cell">Payer</TableHead>
                  <TableHead className="hidden h-10 text-xs font-medium md:table-cell">Created</TableHead>
                  <TableHead className="h-10 pr-5 text-right text-xs font-medium">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((it, i) =>
                  it.kind === "order" ? (
                    <OrderRow key={`o-${it.order.orderId}`} index={i} order={it.order} base={base} busy={busy} act={act} />
                  ) : (
                    <SubPaymentRow key={`s-${it.payment.subscriptionId}-${it.payment.period}-${i}`} index={i} payment={it.payment} />
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </FadeIn>

        <NewOrderDialog open={creating} onOpenChange={setCreating} base={base} busy={busy} act={act} />
      </div>
    );
  }

  // account
  return (
    <FadeIn delay={0.1} className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <IconChip icon={BookOpen} tone={registered ? "success" : "neutral"} size="lg" />
          <div>
            <h3 className="text-base font-semibold">Merchant registration</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Registration creates your order book on chain. It happens once.</p>
          </div>
        </div>
        {registration ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
              registered ? "bg-success/10 text-success ring-success/20" : "bg-muted text-muted-foreground ring-border",
            )}
          >
            {registered && <BadgeCheck className="size-3.5" />}
            {registered ? "Registered" : "Not registered"}
          </span>
        ) : (
          <Shimmer className="h-6 w-24" rounded="rounded-full" />
        )}
      </div>
      <div className="grid gap-px border-t bg-border sm:grid-cols-2">
        <div className="bg-card p-5 md:px-6">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Fingerprint className="size-3.5" /> Merchant ID
          </p>
          <div className="mt-1 flex items-center gap-1 font-mono text-sm">
            {short(account.address, 10, 6)} <CopyButton value={account.address} label="" />
          </div>
        </div>
        <div className="bg-card p-5 md:px-6">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" /> Order book
          </p>
          {registration?.orderBook ? (
            <div className="mt-1 flex items-center gap-1 font-mono text-sm">
              {short(registration.orderBook, 10, 6)} <CopyButton value={registration.orderBook} label="" />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Created on registration</p>
          )}
        </div>
      </div>
      {registration && !registered && (
        <div className="flex justify-end border-t p-4 md:px-6">
          <Button
            disabled={busy}
            className="rounded-full"
            onClick={() =>
              act("Registration", () =>
                runAction({
                  ...base,
                  relayer: () => api("/api/merchant/register", { chainId }),
                  owner: async (sdk) => {
                    if (account.eoa) {
                      const res = await sdk.merchant.register();
                      return { hash: res.transaction?.hash ?? "", data: {} };
                    }
                    const tx = await sdk.accounts.merchant.register(account.address as Address);
                    return { hash: tx.hash, data: {} };
                  },
                  record: (r) => ({ type: "merchant.registered", details: { chainId }, txHash: r.hash }),
                }),
              )
            }
          >
            {busy && <Spinner />}
            {account.custody === "self" && !wallet ? "Connect wallet to register" : "Register merchant"}
          </Button>
        </div>
      )}
    </FadeIn>
  );
}

export type Base = { chainId: number; account: Account; wallet: Address | undefined };
export type Act = (label: string, fn: () => Promise<unknown>) => Promise<void>;

/// Creates an order, then shows its pay link so it can be shared at once.
function NewOrderDialog({ open, onOpenChange, base, busy, act }: { open: boolean; onOpenChange: (v: boolean) => void; base: Base; busy: boolean; act: Act }) {
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("10");
  const [created, setCreated] = useState<{ orderId: string; amount: string; reference: string } | undefined>();
  // On: the box creates a subscription instead of a one-time order.
  const [recurring, setRecurring] = useState(false);
  const [draft, setDraft] = useState<SubscriptionDraft>(emptyDraft);
  const [planBusy, setPlanBusy] = useState(false);
  const [planCreated, setPlanCreated] = useState<string | undefined>();

  function close(v: boolean) {
    onOpenChange(v);
    if (!v)
      setTimeout(() => {
        setCreated(undefined);
        setPlanCreated(undefined);
        setRecurring(false);
        setDraft(emptyDraft());
      }, 200);
  }

  async function createPlan() {
    setPlanBusy(true);
    try {
      setPlanCreated(await createSubscription(base, draft));
    } catch (err) {
      notify("error", errorText(err, "Could not create the subscription"));
    } finally {
      setPlanBusy(false);
    }
  }

  function create() {
    void act("Order", async () => {
      const r = await runAction({
        account: base.account,
        chainId: base.chainId,
        wallet: base.wallet,
        relayer: () => api("/api/orders", { chainId: base.chainId, reference, amount }),
        owner: async (sdk) => {
          if (base.account.eoa) {
            const relayer = (await api<{ relayer: string }>(`/api/permission?chainId=${base.chainId}`)).relayer as Address;
            const res = await sdk.orders.create({ merchant: base.account.address as Address, reference, amount, relayer });
            return { hash: res.transaction.hash, data: { orderId: res.orderId, collector: res.collector } };
          }
          const res = await sdk.accounts.merchant.createOrder({ account: base.account.address, reference, amount });
          return { hash: res.transaction.hash, data: { orderId: res.orderId, collector: res.collector } };
        },
        record: (res) => ({
          type: "order.created",
          details: { chainId: base.chainId, orderId: res.data.orderId },
          txHash: res.hash,
          order: { chainId: base.chainId, merchantAddress: base.account.address, orderId: res.data.orderId, reference, collector: res.data.collector, amount },
        }),
      });
      if (typeof r.data.orderId === "string") setCreated({ orderId: r.data.orderId, amount, reference });
      setReference("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          {planCreated ? (
            <SubscriptionCreated key="plan-done" id={planCreated} draft={draft} onDone={() => close(false)} />
          ) : !created ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DialogHeader className="border-b p-5">
                <DialogTitle>{recurring ? "New subscription" : "New order"}</DialogTitle>
                <DialogDescription>{recurring ? "Customers subscribe once and pay every period." : "The customer pays the exact amount within 20 minutes."}</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 p-5">
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors", recurring ? "border-brand/40 bg-brand/5" : "hover:bg-muted/40")}>
                  <IconChip icon={Repeat} tone={recurring ? "brand" : "neutral"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Make it a subscription</p>
                    <p className="text-xs text-muted-foreground">Bill the customer every week, month, or year</p>
                  </div>
                  <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Make it a subscription" />
                </label>
                <AnimatePresence mode="wait" initial={false}>
                {recurring ? (
                  <motion.div key="plan" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <SubscriptionFields draft={draft} onChange={setDraft} />
                  </motion.div>
                ) : (
                <motion.div key="order" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <Input id="amount" inputMode="decimal" className="h-14 rounded-xl pr-16 text-2xl font-semibold tabular-nums md:text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"><Token /></span>
                  </div>
                  <div className="flex gap-2">
                    {["5", "10", "25", "50", "100"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(v)}
                        className={cn("rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors", amount === v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference</Label>
                  <Input id="reference" className="h-11 rounded-xl" placeholder="invoice-1042" value={reference} onChange={(e) => setReference(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Your own id, such as an invoice number. Must be unique.</p>
                </div>
                </motion.div>
                )}
                </AnimatePresence>
              </div>
              <div className="flex justify-end gap-2 border-t bg-muted/30 p-4">
                <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
                {recurring ? (
                  <Button disabled={planBusy || !draftValid(draft)} onClick={() => void createPlan()}>
                    {planBusy && <Spinner />}
                    {planBusy ? "Creating…" : "Create subscription"}
                  </Button>
                ) : (
                  <Button disabled={busy || !reference || !amount} onClick={create}>
                    {busy && <Spinner />}
                    {busy ? "Creating…" : "Create order"}
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 p-6 text-center">
              <DialogHeader className="sr-only">
                <DialogTitle>Order created</DialogTitle>
                <DialogDescription>Share the pay link with your customer.</DialogDescription>
              </DialogHeader>
              <SuccessMark size={56} />
              <div>
                <p className="text-lg font-semibold">Order created</p>
                <p className="text-sm text-muted-foreground">
                  {created.reference} · {money(created.amount)} <Token />
                </p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-left">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Link2 className="size-3.5" /> Pay link
                </p>
                <p className="mt-1 truncate font-mono text-xs">{shortLink(linkFor(base.chainId, base.account.address, created.orderId), created.orderId)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CopyButton value={linkFor(base.chainId, base.account.address, created.orderId)} label="Copy link" className="h-10 justify-center rounded-xl border bg-card text-foreground" />
                <Button className="h-10 rounded-xl" onClick={() => close(false)}>Done</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/// A subscription payment in the orders list. Opens that subscription, with its history.
function SubPaymentRow({ payment, index }: { payment: SubPayment; index: number }) {
  const router = useRouter();
  const href = `/subscriptions?id=${payment.subscriptionId}`;
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03 }}
      onClick={() => router.push(href)}
      className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
    >
      <TableCell className="py-3 pl-5">
        <div className="flex items-center gap-3">
          <IconChip icon={Repeat} size="sm" tone="brand" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{payment.name}</span>
              <SubscriptionChip />
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Payment {payment.period ?? "—"}
              {payment.periods ? ` of ${payment.periods}` : ""}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3 text-right">
        <span className="font-semibold tabular-nums">{money(payment.amount)}</span> <span className="text-xs text-muted-foreground"><Token /></span>
      </TableCell>
      <TableCell className="py-3">
        <StatusBadge status="paid" />
      </TableCell>
      <TableCell className="hidden py-3 font-mono text-xs lg:table-cell">{payment.subscriber ? short(payment.subscriber, 6, 4) : "—"}</TableCell>
      <TableCell className="hidden py-3 text-xs text-muted-foreground md:table-cell">{timeAgo(payment.at)}</TableCell>
      <TableCell className="py-3 pr-5">
        <div className="flex items-center justify-end">
          <span className="grid size-8 place-items-center rounded-full text-muted-foreground group-hover:text-foreground" aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        </div>
      </TableCell>
    </motion.tr>
  );
}

function OrderRow({ order, index, base, busy, act }: { order: Order; index: number; base: Base; busy: boolean; act: Act }) {
  const { chainId, account } = base;
  const shown = displayStatus(order);
  const requested = order.refundStatus === "requested";
  const approved = order.refundStatus === "approved";
  const paid = order.status === "paid" || order.status === "partially_refunded";
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03 }}
      onClick={() => setDetails(true)}
      className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
    >
      <TableCell className="py-3 pl-5">
        <div className="flex items-center gap-3">
          <IconChip icon={Receipt} size="sm" tone={paid || shown === "refunded" ? "success" : shown === "pending" ? "info" : "neutral"} />
          <div className="min-w-0">
            <div className="truncate font-medium">{order.reference}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{short(order.orderId, 6, 4)}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3 text-right">
        <span className="font-semibold tabular-nums">{money(order.amount)}</span> <span className="text-xs text-muted-foreground"><Token /></span>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={shown} />
          {requested && <span className="text-[11px] font-medium text-warning">Refund requested · {usdt(order.refundRequestedAmount)}</span>}
          {approved && <span className="text-[11px] text-muted-foreground">Refund approved · {usdt(order.refundApprovedAmount)}</span>}
        </div>
      </TableCell>
      <TableCell className="hidden py-3 font-mono text-xs lg:table-cell">{order.payer ? short(order.payer, 6, 4) : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="hidden py-3 text-xs text-muted-foreground md:table-cell">{timeAgo(order.createdAt)}</TableCell>
      <TableCell className="py-3 pr-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {shown === "pending" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={async () => {
                await navigator.clipboard.writeText(linkFor(chainId, account.address, order.orderId));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Link2 className="size-3.5" /> {copied ? "Copied" : "Pay link"}
            </Button>
          )}
          {(requested || approved) && (
            <Button size="sm" className="h-8 rounded-full bg-warning text-black hover:bg-warning/90" onClick={() => setDetails(true)}>
              <RotateCcw className="size-3.5" /> Review
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground group-hover:text-foreground" aria-label="Order details" onClick={() => setDetails(true)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <OrderDialog open={details} onOpenChange={setDetails} order={order} base={base} busy={busy} act={act} />
      </TableCell>
    </motion.tr>
  );
}

/// Everything about one order, and every action that applies to it now.
export function OrderDialog({ open, onOpenChange, order, base, busy, act }: { open: boolean; onOpenChange: (v: boolean) => void; order: Order; base: Base; busy: boolean; act: Act }) {
  const { chainId, account, wallet } = base;
  const common = { account: { address: account.address, owner: account.owner, custody: account.custody }, chainId, wallet };
  const shown = displayStatus(order);
  // Paid in local money: settled in that currency, so there is nothing to withdraw or refund on chain.
  const paid = (order.status === "paid" || order.status === "partially_refunded") && !order.paidWith;
  const requested = order.refundStatus === "requested";
  const approved = order.refundStatus === "approved";
  const canRefundNow = paid && (order.refundStatus === "none" || order.refundStatus === "denied");
  const remaining = Math.max(0, Number(order.amount) - Number(order.refundedAmount) / 1e6);
  const [refund, setRefund] = useState(order.refundRequestedAmount !== "0" ? (Number(order.refundRequestedAmount) / 1e6).toString() : "");
  const [direct, setDirect] = useState(decimal(remaining));
  const link = linkFor(chainId, account.address, order.orderId);
  // Which action is running, so only its own button shows the spinner.
  const [running, setRunning] = useState<string | undefined>();
  const run: Act = async (label, fn) => {
    setRunning(label);
    try {
      await act(label, fn);
    } finally {
      setRunning(undefined);
    }
  };

  const withdraw = () =>
    run("Withdrawal", () =>
      runAction({
        ...common,
        relayer: () => api("/api/orders/withdraw", { chainId, orderId: order.orderId }),
        owner: async (sdk) => ({ hash: (await sdk.orders.withdraw(account.address as Address, order.orderId as `0x${string}`)).hash, data: {} }),
        record: (r) => ({ type: "order.withdrawn", details: { chainId, orderId: order.orderId }, txHash: r.hash }),
      }),
    );

  const approve = () =>
    run("Refund approval", () =>
      runAction({
        ...common,
        relayer: () => api("/api/refunds", { chainId, action: "approve", orderId: order.orderId, amount: refund }),
        owner: async (sdk) => ({
          hash: account.eoa
            ? (await sdk.refunds.approve({ merchant: account.address as Address, orderId: order.orderId as `0x${string}`, amount: refund })).hash
            : (await sdk.accounts.merchant.approveRefund({ account: account.address, orderId: order.orderId as `0x${string}`, amount: refund })).hash,
          data: {},
        }),
        record: (r) => ({ type: "refund.approved", details: { chainId, orderId: order.orderId }, txHash: r.hash }),
      }),
    );

  const deny = () =>
    run("Refund denial", () =>
      runAction({
        ...common,
        relayer: () => api("/api/refunds", { chainId, action: "deny", orderId: order.orderId, note: "denied" }),
        owner: async (sdk) => ({
          hash: account.eoa
            ? (await sdk.refunds.deny({ merchant: account.address as Address, orderId: order.orderId as `0x${string}`, note: "denied" })).hash
            : (await sdk.accounts.merchant.denyRefund({ account: account.address, orderId: order.orderId as `0x${string}`, note: "denied" })).hash,
          data: {},
        }),
        record: (r) => ({ type: "refund.denied", details: { chainId, orderId: order.orderId }, txHash: r.hash }),
      }),
    );

  const payApproved = () =>
    run("Refund payment", () =>
      runAction({
        ...common,
        relayer: () => api("/api/refunds", { chainId, action: "execute", orderId: order.orderId }),
        owner: async (sdk) => ({
          hash: account.eoa
            ? (await sdk.refunds.executeFromBalance(account.address as Address, order.orderId as `0x${string}`)).hash
            : (await sdk.accounts.merchant.executeRefundFromBalance({ account: account.address, orderId: order.orderId as `0x${string}` })).hash,
          data: {},
        }),
        record: (r) => ({ type: "refund.paid", details: { chainId, orderId: order.orderId }, txHash: r.hash }),
      }),
    );

  const refundNow = () =>
    run("Refund", () =>
      runAction({
        ...common,
        relayer: () => api("/api/refunds", { chainId, action: "refund", orderId: order.orderId, amount: direct }),
        owner: async (sdk) => ({
          hash: account.eoa
            ? (await sdk.refunds.refund({ merchant: account.address as Address, orderId: order.orderId as `0x${string}`, amount: direct })).payment.hash
            : (await sdk.accounts.merchant.refund({ account: account.address, orderId: order.orderId as `0x${string}`, amount: direct })).payment.hash,
          data: {},
        }),
        record: (r) => ({ type: "refund.paid", details: { chainId, orderId: order.orderId, initiated: true }, txHash: r.hash }),
      }),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <div className="relative overflow-hidden border-b px-6 pb-6 pt-6">
          <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
          <DialogHeader className="relative">
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogDescription className="text-xs font-medium uppercase tracking-[0.12em]">Order details</DialogDescription>
              <StatusBadge status={shown} />
            </div>
            <DialogTitle className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {money(order.amount)} <span className="text-base font-medium text-muted-foreground"><Token /></span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{order.reference}</p>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="divide-y rounded-xl border px-4">
            <DetailRow label="Order ID">
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                {short(order.orderId, 8, 6)} <CopyButton value={order.orderId} label="" className="h-6 px-1.5" />
              </span>
            </DetailRow>
            {order.paidWith ? (
              <>
                <DetailRow label="Paid by">Bank transfer · {paidWithText(order.paidWith)}</DetailRow>
                <DetailRow label="Payment ID" mono>
                  {order.paidWith.reference}
                </DetailRow>
              </>
            ) : (
              <DetailRow label="Payer" mono>
                {order.payer ? short(order.payer, 8, 6) : "—"}
              </DetailRow>
            )}
            <DetailRow label="Created">{new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</DetailRow>
            <DetailRow label="Refund status">
              <span className="capitalize">{order.refundStatus}</span>
            </DetailRow>
            <DetailRow label="Refunded">
              <span className="tabular-nums">{usdt(order.refundedAmount)} <Token /></span>
            </DetailRow>
          </div>

          {shown === "pending" && (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Link2 className="size-3.5" /> Pay link
              </p>
              <p className="truncate font-mono text-xs">{shortLink(link, order.orderId)}</p>
              <CopyButton value={link} label="Copy pay link" className="h-9 w-full justify-center rounded-lg border bg-card text-foreground" />
            </div>
          )}

          {requested && (
            <section className="space-y-3 rounded-xl border border-warning/30 bg-warning/6 p-4">
              <div className="flex items-start gap-3">
                <IconChip icon={ShieldAlert} tone="warning" size="sm" />
                <div>
                  <p className="text-sm font-medium">Customer asked for a refund</p>
                  <p className="text-xs text-muted-foreground">Requested {usdt(order.refundRequestedAmount)} <Token />. You choose the amount.</p>
                </div>
              </div>
              <div className="relative">
                <Input aria-label="Refund amount" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl" disabled={busy} onClick={deny}>
                  {running === "Refund denial" && <Spinner />} Deny
                </Button>
                <Button className="rounded-xl" disabled={busy || !refund} onClick={approve}>
                  {running === "Refund approval" && <Spinner />} Approve
                </Button>
              </div>
            </section>
          )}

          {approved && (
            <section className="space-y-3 rounded-xl border p-4">
              <p className="text-sm">
                Approved <span className="font-semibold tabular-nums">{usdt(order.refundApprovedAmount)} <Token /></span>. Pay it to send the money back to the customer.
              </p>
              <Button className="w-full rounded-xl" disabled={busy} onClick={payApproved}>
                {running === "Refund payment" && <Spinner />} Pay refund
              </Button>
            </section>
          )}

          {canRefundNow && (
            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <IconChip icon={Undo2} tone="brand" size="sm" />
                <div>
                  <p className="text-sm font-medium">Refund this order</p>
                  <p className="text-xs text-muted-foreground">Send money back without waiting for a request. Up to {money(remaining)} <Token />.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input id={`refund-now-${order.orderId}`} aria-label="Refund amount" inputMode="decimal" value={direct} onChange={(e) => setDirect(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                  <button type="button" onClick={() => setDirect(decimal(remaining))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Max
                  </button>
                </div>
                <Button className="h-11 rounded-xl px-5" disabled={busy || !direct} onClick={refundNow}>
                  {running === "Refund" && <Spinner />} Refund
                </Button>
              </div>
            </section>
          )}

          {paid && (
            <Button variant="outline" className="h-11 w-full rounded-xl" disabled={busy} onClick={withdraw}>
              {running === "Withdrawal" ? <Spinner /> : <ArrowDownToLine className="size-4" />} Withdraw to merchant
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
