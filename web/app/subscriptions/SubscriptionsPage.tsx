"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, CircleDollarSign, Plus, Repeat, Search, Users, Vault } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Address } from "@/lib/client/types";
import type { Account } from "../app/_components/Dashboard";
import { WalletButton } from "../app/_components/WalletButton";
import { EmptyState, LoadingRows, PageHeader, Segmented, StatCard } from "../app/_components/kit";
import { PageShell } from "../app/_components/PageShell";
import { SubscriptionDetail, SubscriptionTable, type Sub } from "../app/_components/SubscriptionKit";
import { NewSubscriptionDialog, subscriptionTotals, useSubscriptions } from "../app/_components/SubscriptionsPanel";
import { tokenOf } from "@/lib/shared/token";

type Filter = "all" | "waiting" | "active" | "ended";
type Sort = "newest" | "price" | "collected" | "held";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Highest price" },
  { value: "collected", label: "Most collected" },
  { value: "held", label: "Most held" },
];

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

const filterOf = (s: Sub): Exclude<Filter, "all"> => (s.status === "open" ? "waiting" : s.status === "active" ? "active" : "ended");

export function SubscriptionsPage() {
  return (
    <PageShell role="merchant">
      {(me) => <All account={me.accounts.find((a) => a.kind === "merchant")!} />}
    </PageShell>
  );
}

function All({ account }: { account: Account }) {
  const chainId = account.chainId;
  const { subs, load } = useSubscriptions(chainId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [creating, setCreating] = useState(false);
  // A link can name a subscription to open: /subscriptions?id=…
  const [open, setOpen] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("id") || undefined);
  const [wallet, setWallet] = useState<Address | undefined>();
  const base = { chainId, account, wallet };

  function show(id: string | undefined) {
    setOpen(id);
    window.history.replaceState(null, "", id ? `/subscriptions?id=${id}` : "/subscriptions");
  }

  const counts = useMemo(() => {
    const c = { all: 0, waiting: 0, active: 0, ended: 0 };
    for (const s of subs ?? []) {
      c.all += 1;
      c[filterOf(s)] += 1;
    }
    return c;
  }, [subs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subs ?? [])
      .filter((s) => filter === "all" || filterOf(s) === filter)
      .filter((s) => !q || [s.name, s.reference, s.description ?? "", s.subscriber ?? "", s.id].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "price") return Number(b.amount) - Number(a.amount);
        if (sort === "collected") return Number(b.collected) - Number(a.collected);
        if (sort === "held") return Number(b.held) - Number(a.held);
        return Number(b.createdAt) - Number(a.createdAt);
      });
  }, [subs, filter, query, sort]);

  const totals = useMemo(() => subscriptionTotals(subs ?? []), [subs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every subscription you created: who took it, what it has paid, and what it holds."
        actions={
          <>
            {account.custody === "self" && <WalletButton chainId={chainId} wallet={wallet} onConnected={setWallet} />}
            <Button className="h-9 gap-1.5 rounded-full px-4" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New subscription
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subscriptions" value={subs ? subs.length : undefined} icon={Repeat} tone="brand" hint={`${totals.waiting} waiting for a customer`} />
        <StatCard label="Active" value={subs ? totals.active : undefined} icon={Users} tone="success" hint={`${usd(totals.mrr)} ${tokenOf(account.chainId)} per month`} />
        <StatCard label="Held now" value={subs ? totals.held : undefined} format={usd} suffix={tokenOf(account.chainId)} icon={Vault} tone="info" hint="Ready to withdraw" />
        <StatCard label="Collected" value={subs ? totals.collected : undefined} format={usd} suffix={tokenOf(account.chainId)} icon={CircleDollarSign} tone="neutral" hint="After refunds" />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 md:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              id="subs-filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "waiting", label: "Waiting", count: counts.waiting },
                { value: "active", label: "Active", count: counts.active },
                { value: "ended", label: "Ended", count: counts.ended },
              ]}
            />
            <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
              <SelectTrigger size="sm" className="h-9 gap-2 rounded-full px-3 text-xs data-[size=sm]:h-9">
                <ArrowUpDown className="size-3.5" />
                <span>{SORTS.find((s) => s.value === sort)?.label}</span>
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, customer, or ID" className="h-9 rounded-full pl-9" />
          </div>
        </div>
        {!subs ? (
          <LoadingRows count={6} className="p-3" />
        ) : subs.length === 0 ? (
          <EmptyState icon={Repeat} title="No subscriptions yet" description="Create one, send its link to your customer, and get paid every period." action={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> New subscription</Button>} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} title="No matching subscriptions" description="Try another search or filter." />
        ) : (
          <SubscriptionTable subs={shown} onOpen={show} />
        )}
      </div>

      <NewSubscriptionDialog open={creating} onOpenChange={setCreating} base={base} onCreated={load} />
      <SubscriptionDetail id={open} base={base} onOpenChange={(o) => !o && show(undefined)} onChanged={load} />
    </div>
  );
}
