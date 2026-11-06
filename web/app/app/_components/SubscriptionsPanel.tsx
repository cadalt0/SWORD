"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarClock, CircleDollarSign, Plus, Repeat, Users, Vault, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import type { Account } from "./Dashboard";
import { EmptyState, FadeIn, LoadingRows, PageHeader, Spinner, StatCard, Stagger, StaggerItem } from "./kit";
import { errorText, notify } from "./shared";
import {
  createSubscription,
  draftValid,
  emptyDraft,
  SubscriptionCreated,
  SubscriptionDetail,
  SubscriptionFields,
  SubscriptionTable,
  type Sub,
  type SubscriptionDraft,
} from "./SubscriptionKit";
import { tokenOf } from "@/lib/shared/token";

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
type Base = { chainId: number; account: Account; wallet: Address | undefined };

/// The numbers across a set of subscriptions.
export function subscriptionTotals(subs: Sub[]) {
  const active = subs.filter((s) => s.status === "active");
  return {
    active: active.length,
    waiting: subs.filter((s) => s.status === "open").length,
    mrr: active.reduce((sum, s) => sum + (Number(s.amount) * 30) / s.periodDays, 0),
    held: subs.reduce((sum, s) => sum + Number(s.held), 0),
    collected: subs.reduce((sum, s) => sum + Number(s.collected) - Number(s.refunded), 0),
    due: subs.filter((s) => s.due).length,
  };
}

/// Loads the merchant's subscriptions, and collects anything that fell due.
export function useSubscriptions(chainId: number) {
  const [subs, setSubs] = useState<Sub[] | undefined>();
  const [collecting, setCollecting] = useState(false);

  async function load() {
    try {
      setSubs((await api<{ subscriptions: Sub[] }>(`/api/subscriptions?chainId=${chainId}`)).subscriptions);
    } catch (err) {
      notify("error", errorText(err, "Could not load subscriptions"));
    }
  }

  async function collect(quiet = false) {
    setCollecting(true);
    try {
      const r = await api<{ charged: number; failed: { id: string; reason: string }[] }>("/api/subscriptions", { chainId, action: "collect" });
      if (!quiet || r.charged) notify("success", r.charged ? `Collected ${r.charged} ${r.charged === 1 ? "payment" : "payments"}` : "Nothing due right now");
      if (r.failed.length) notify("error", `${r.failed.length} ${r.failed.length === 1 ? "payment" : "payments"} could not be collected. The customer may be short on funds.`);
      await load();
    } catch (err) {
      if (!quiet) notify("error", errorText(err, "Could not collect payments"));
    } finally {
      setCollecting(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await load();
      await collect(true);
    })();
    // reload when the chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  return { subs, load, collect, collecting };
}

/// Merchant subscriptions: each one is created like an order and has one customer.
export function SubscriptionsPanel({ chainId, account, wallet }: { chainId: number; account: Account; wallet: Address | undefined }) {
  const { subs, load, collect, collecting } = useSubscriptions(chainId);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | undefined>();
  const base = { chainId, account, wallet };
  const totals = useMemo(() => subscriptionTotals(subs ?? []), [subs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Bill a customer every week, month, or year. Each subscription has its own link and one customer."
        actions={
          <>
            <Button variant="outline" className="h-9 gap-1.5 rounded-full px-4" disabled={collecting} onClick={() => void collect()}>
              {collecting ? <Spinner /> : <Zap className="size-4 text-brand" />}
              Collect due
              {totals.due > 0 && <span className="rounded-full bg-warning px-1.5 text-[11px] font-semibold text-black">{totals.due}</span>}
            </Button>
            <Button className="h-9 gap-1.5 rounded-full px-4" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New subscription
            </Button>
          </>
        }
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard label="Active" value={subs ? totals.active : undefined} icon={Users} tone="success" hint={`${totals.waiting} waiting for a customer`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Monthly recurring" value={subs ? totals.mrr : undefined} format={usd} suffix={tokenOf(chainId)} icon={Repeat} tone="brand" hint="Active subscriptions, per month" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Held now" value={subs ? totals.held : undefined} format={usd} suffix={tokenOf(chainId)} icon={Vault} tone="info" hint="Ready to withdraw" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Collected" value={subs ? totals.collected : undefined} format={usd} suffix={tokenOf(chainId)} icon={CircleDollarSign} tone="neutral" hint={totals.due ? `${totals.due} due now` : "After refunds"} />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.05} className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b p-4 md:px-5">
          <div>
            <h3 className="text-sm font-semibold">Recent subscriptions</h3>
            <p className="text-xs text-muted-foreground">Open one to refund, withdraw, or cancel</p>
          </div>
          {subs && subs.length > 0 && (
            <Link href="/subscriptions" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              View all {subs.length} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        {!subs ? (
          <LoadingRows count={4} className="p-3" />
        ) : subs.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No subscriptions yet" description="Create one, send its link to your customer, and get paid every period." action={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> New subscription</Button>} />
        ) : (
          <SubscriptionTable subs={subs.slice(0, 8)} onOpen={setOpen} />
        )}
      </FadeIn>

      <NewSubscriptionDialog open={creating} onOpenChange={setCreating} base={base} onCreated={load} />
      <SubscriptionDetail id={open} base={base} onOpenChange={(o) => !o && setOpen(undefined)} onChanged={load} />
    </div>
  );
}

/// Creating a subscription, then its link to send to the customer.
export function NewSubscriptionDialog({ open, onOpenChange, base, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; base: Base; onCreated: () => Promise<void> | void }) {
  const [draft, setDraft] = useState<SubscriptionDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | undefined>();

  function close(v: boolean) {
    onOpenChange(v);
    if (!v)
      setTimeout(() => {
        setCreated(undefined);
        setDraft(emptyDraft());
      }, 200);
  }

  async function create() {
    setBusy(true);
    try {
      setCreated(await createSubscription(base, draft));
      await onCreated();
    } catch (err) {
      notify("error", errorText(err, "Could not create the subscription"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          {!created ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DialogHeader className="border-b p-5">
                <DialogTitle>New subscription</DialogTitle>
                <DialogDescription>One customer subscribes and pays every period.</DialogDescription>
              </DialogHeader>
              <div className="p-5">
                <SubscriptionFields draft={draft} onChange={setDraft} />
              </div>
              <div className="flex justify-end gap-2 border-t bg-muted/30 p-4">
                <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
                <Button disabled={busy || !draftValid(draft)} onClick={() => void create()}>
                  {busy && <Spinner />} Create subscription
                </Button>
              </div>
            </motion.div>
          ) : (
            <SubscriptionCreated key="done" id={created} draft={draft} onDone={() => close(false)} />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
