"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Receipt, RotateCcw, Search, ShoppingBag, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { orderRefundAction } from "./customer-actions";
import { receiptHref, type MyPurchase } from "./customer-data";
import { DetailRow, EmptyState, FadeIn, IconChip, LoadingRows, PageHeader } from "./kit";
import { decimal, errorText, money, notify, short, StatusBadge, timeAgo } from "./shared";
import { useSword, SwordPay } from "./SwordPay";
import { Token } from "@/lib/client/token";
import { tokenOf } from "@/lib/shared/token";

const REASONS = ["Item not received", "Wrong item", "Damaged", "Changed my mind"];

/// Where a purchase's refund stands, in words: nothing to say if no refund was ever asked.
function refundLine(p: MyPurchase, token: string): { text: string; tone: "warn" | "ok" | "muted" } | undefined {
  if (p.refundStatus === "requested") return { text: `Refund requested · ${money(p.refundRequestedAmount)} ${token}`, tone: "warn" };
  if (p.refundStatus === "approved") return { text: `Refund approved · ${money(p.refundApprovedAmount)} ${token}, on its way`, tone: "ok" };
  if (p.refundStatus === "denied") return { text: "Refund declined. You can ask again.", tone: "muted" };
  if (Number(p.refundedAmount) > 0) return { text: `Refunded ${money(p.refundedAmount)} ${token}`, tone: "ok" };
  return undefined;
}

/// Everything the customer paid, with each order's refund progress and a way to ask for a refund.
export function MyPurchases({ chainId }: { chainId: number; account: Account }) {
  const [purchases, setPurchases] = useState<MyPurchase[] | undefined>();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | undefined>();
  const wm = useSword(chainId);

  async function load() {
    try {
      setPurchases((await api<{ purchases: MyPurchase[] }>("/api/my/purchases")).purchases);
    } catch (err) {
      notify("error", errorText(err, "Could not load your purchases"));
      setPurchases([]);
    }
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (purchases ?? [])
      .filter((p) => !q || [p.reference, p.merchantLabel ?? "", p.merchant, p.orderId].join(" ").toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  }, [purchases, query]);

  const selected = purchases?.find((p) => p.orderId === open);
  const waiting = (purchases ?? []).filter((p) => p.refundStatus === "requested" || p.refundStatus === "approved").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Purchases" description="Everything you paid, with its receipt and refund progress." />

      {waiting > 0 && (
        <FadeIn className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-3.5">
          <IconChip icon={RotateCcw} tone="warning" size="sm" />
          <p className="text-sm">
            <span className="font-medium">
              {waiting} {waiting === 1 ? "refund is" : "refunds are"} in progress.
            </span>{" "}
            <span className="text-muted-foreground">You&apos;ll see each one move to Refunded when the merchant pays it.</span>
          </p>
        </FadeIn>
      )}

      <div className="surface-card overflow-hidden">
        <div className="border-b p-3 md:px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by merchant or reference" className="h-9 rounded-full pl-9" />
          </div>
        </div>
        {purchases === undefined ? (
          <LoadingRows count={5} className="p-3" />
        ) : purchases.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No purchases yet" description="Orders you pay from your account show up here, with a receipt for each." />
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} title="Nothing matches" description="Try another search." />
        ) : (
          <ul className="divide-y">
            {shown.map((p, i) => {
              const line = refundLine(p, tokenOf(chainId));
              return (
                <motion.li key={p.orderId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <button type="button" onClick={() => setOpen(p.orderId)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 md:px-5">
                    <IconChip icon={Store} tone={p.status === "refunded" ? "brand" : "success"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.reference}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.merchantLabel ?? short(p.merchant, 6, 4)} · {timeAgo(p.paidAt)}
                      </p>
                      {line && <p className={cn("mt-0.5 text-xs font-medium", line.tone === "warn" ? "text-warning" : line.tone === "ok" ? "text-success" : "text-muted-foreground")}>{line.text}</p>}
                    </div>
                    <StatusBadge status={p.status} className="hidden sm:inline-flex" />
                    <p className="w-28 text-right text-sm font-semibold tabular-nums">
                      {money(p.amount)} <span className="text-xs font-normal text-muted-foreground"><Token /></span>
                    </p>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <PurchaseDialog purchase={selected} chainId={chainId} wm={wm} onOpenChange={(o) => !o && setOpen(undefined)} onChanged={load} />
    </div>
  );
}

/// One purchase: its details, its receipt, and a refund request.
function PurchaseDialog({ purchase, chainId, wm, onOpenChange, onChanged }: { purchase: MyPurchase | undefined; chainId: number; wm: ReturnType<typeof useSword>; onOpenChange: (open: boolean) => void; onChanged: () => Promise<void> }) {
  return (
    <Dialog open={purchase !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-md">
        {purchase && <PurchaseBody key={purchase.orderId} purchase={purchase} chainId={chainId} wm={wm} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseBody({ purchase, chainId, wm, onChanged }: { purchase: MyPurchase; chainId: number; wm: ReturnType<typeof useSword>; onChanged: () => Promise<void> }) {
  // The form starts fresh for each purchase, because this body is keyed by it.
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState(decimal(Number(purchase.refundable)));
  const [reason, setReason] = useState("");

  const line = refundLine(purchase, tokenOf(chainId));
  const canAsk = purchase.viaAccount && (purchase.status === "paid" || purchase.status === "partially_refunded") && (purchase.refundStatus === "none" || purchase.refundStatus === "denied") && Number(purchase.refundable) > 0;

  return (
    <>
      <div className="relative overflow-hidden border-b px-6 pb-6 pt-6">
        <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
        <DialogHeader className="relative">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogDescription className="text-xs font-medium uppercase tracking-[0.12em]">Purchase</DialogDescription>
            <StatusBadge status={purchase.status} />
          </div>
          <DialogTitle className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {money(purchase.amount)} <span className="text-base font-medium text-muted-foreground"><Token /></span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{purchase.reference}</p>
        </DialogHeader>
      </div>

      <div className="space-y-5 p-6">
        <div className="divide-y rounded-xl border px-4">
          <DetailRow label="Merchant">{purchase.merchantLabel ?? short(purchase.merchant, 6, 4)}</DetailRow>
          <DetailRow label="Paid">{new Date(purchase.paidAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</DetailRow>
          <DetailRow label="Refunded">{money(purchase.refundedAmount)} <Token /></DetailRow>
          <DetailRow label="Can still be refunded">{money(purchase.refundable)} <Token /></DetailRow>
        </div>

        {line && <p className={cn("rounded-xl border p-3 text-sm", line.tone === "warn" ? "border-warning/30 bg-warning/8" : line.tone === "ok" ? "border-success/30 bg-success/8" : "bg-muted/40")}>{line.text}</p>}

        <AnimatePresence initial={false}>
          {asking && canAsk && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-sm font-medium">Ask for a refund</p>
                <div className="relative">
                  <Input aria-label="Refund amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", reason === r ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea rows={2} className="rounded-xl" placeholder="Tell the merchant what happened" value={reason} onChange={(e) => setReason(e.target.value)} />
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
                    action={orderRefundAction(chainId, { orderId: purchase.orderId, merchant: purchase.merchant }, amount, reason)}
                    onDone={() => {
                      setAsking(false);
                      notify("success", "Refund request sent to the merchant");
                      void onChanged();
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-2">
          {purchase.txHash && (
            <Link href={receiptHref(purchase.txHash, chainId)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium transition-colors hover:bg-muted">
              <Receipt className="size-4" /> View receipt
            </Link>
          )}
          {canAsk && !asking && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setAsking(true)}>
              <RotateCcw className="size-4" /> Ask for a refund
            </Button>
          )}
          {!purchase.viaAccount && <p className="text-center text-xs text-muted-foreground">You paid this with your wallet, so ask the merchant directly for a refund.</p>}
        </div>
      </div>
    </>
  );
}
