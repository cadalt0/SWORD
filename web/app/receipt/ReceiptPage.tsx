"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Link2Off, Printer } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, LoadingState, Logo, SuccessMark } from "../app/_components/kit";
import { CopyButton, errorText, money, short } from "../app/_components/shared";
import { ChainToken, Token } from "@/lib/client/token";

type Receipt = {
  kind: string;
  title: string;
  amount: string;
  from: string | null;
  to: string | null;
  toLabel: string | null;
  reference: string | null;
  details: { label: string; value: string }[];
  txHash: string;
  chainId: number;
  network: string;
  at: string;
};

const REFUND = new Set(["order_refund", "subscription_refund"]);

/// A receipt the customer can open, share, and print. Everything on it is read from the chain, so anyone can check it.
export function ReceiptPage({ tx, chain }: { tx: string; chain: string }) {
  const [receipt, setReceipt] = useState<Receipt | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!tx) return;
    let live = true;
    fetch(`/api/receipt?tx=${tx}&chain=${chain || "1874"}`)
      .then(async (res) => {
        const data = (await res.json()) as Receipt & { error?: { message: string } };
        if (!res.ok) throw new Error(data.error?.message ?? "We couldn't load that receipt");
        if (live) setReceipt(data);
      })
      .catch((err) => live && setError(errorText(err, "We couldn't load that receipt")));
    return () => {
      live = false;
    };
  }, [tx, chain]);

  const refund = receipt ? REFUND.has(receipt.kind) : false;

  return (
    <ChainToken chainId={Number(chain) || undefined}>
    <div className="relative flex min-h-screen flex-col print:bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid print:hidden" />
      <header className="flex h-16 items-center justify-between px-4 md:px-8 print:hidden">
        <Logo withText />
        <ModeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center p-4 pb-16 md:items-center">
        {!tx || error ? (
          <EmptyState icon={Link2Off} title={error ?? "This receipt link is incomplete"} description="Check the link, or open the payment from your purchases." action={<Link href="/app" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Go to Sword</Link>} />
        ) : !receipt ? (
          <LoadingState label="Reading your receipt" />
        ) : (
          <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md overflow-hidden rounded-[28px] border bg-card shadow-lift print:shadow-none">
            <div className="relative overflow-hidden border-b px-6 pb-7 pt-8 text-center">
              <div aria-hidden className="absolute inset-0 bg-dots opacity-70" />
              <div className="relative">
                <SuccessMark size={56} />
                <p className="mt-4 text-sm font-medium text-muted-foreground">{receipt.title}</p>
                <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                  {refund ? "+" : ""}
                  {money(receipt.amount)} <span className="text-lg font-medium text-muted-foreground"><Token /></span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {refund ? "Refunded" : "Paid"} on {new Date(receipt.at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                </p>
              </div>
            </div>

            <dl className="divide-y px-6 text-sm">
              {receipt.to && (
                <Row label={refund ? "Refunded to" : "Paid to"}>
                  <span className="text-right">
                    {receipt.toLabel && <span className="block font-medium">{receipt.toLabel}</span>}
                    <span className="font-mono text-xs text-muted-foreground">{short(receipt.to, 8, 6)}</span>
                  </span>
                </Row>
              )}
              {receipt.from && (
                <Row label={refund ? "Refunded by" : "Paid by"}>
                  <span className="font-mono text-xs">{short(receipt.from, 8, 6)}</span>
                </Row>
              )}
              {receipt.reference && <Row label="For">{receipt.reference}</Row>}
              {receipt.details.map((d) => (
                <Row key={d.label} label={d.label}>
                  {/^0x[0-9a-fA-F]{64}$/.test(d.value) ? <span className="font-mono text-xs">{short(d.value, 8, 6)}</span> : d.value}
                </Row>
              ))}
              <Row label="Network">{receipt.network}</Row>
              <Row label="Status">
                <span className="inline-flex items-center gap-1.5 font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Confirmed
                </span>
              </Row>
              <Row label="Transaction">
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  {short(receipt.txHash, 8, 6)} <CopyButton value={receipt.txHash} label="" className="h-6 px-1.5 print:hidden" />
                </span>
              </Row>
            </dl>

            <div className={cn("grid gap-2 p-5 print:hidden", "grid-cols-2")}>
              <CopyButton value={typeof window === "undefined" ? "" : window.location.href} label="Copy link" className="h-10 justify-center rounded-xl border bg-card text-foreground" />
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => window.print()}>
                <Printer className="size-4" /> Print or save
              </Button>
            </div>
            <p className="border-t bg-muted/30 px-6 py-3 text-center text-[11px] text-muted-foreground">
              This receipt is read straight from {receipt.network}. Anyone with the transaction can check it.
              <Link href="/app" className="ml-1 inline-flex items-center gap-0.5 font-medium text-foreground print:hidden">
                Sword <ArrowRight className="size-3" />
              </Link>
            </p>
          </motion.article>
        )}
      </main>
    </div>
    </ChainToken>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
