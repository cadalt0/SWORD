"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Banknote, CheckCircle2, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { Token, useToken } from "@/lib/client/token";
import { COUNTRIES, countryOf, FALLBACK_RATES, formatFiat, toFiat } from "@/lib/shared/fiat";
import type { Account } from "./Dashboard";
import { CountryPicker, RateLine, useHomeCountry, useRates } from "./Fiat";
import { EmptyState, FadeIn, IconChip, PageHeader, Shimmer, Spinner, SuccessMark } from "./kit";
import { errorText, money, notify, timeAgo } from "./shared";

type Payout = {
  id: string;
  amount: string;
  currency: string;
  fiatAmount: string;
  rate: string;
  country: string;
  holderName: string;
  bankName: string | null;
  accountLast4: string;
  reference: string;
  status: string;
  createdAt: string;
};
type Summary = { balance: number; available: number; payouts: Payout[] };

/// Cash out: convert the balance to local money at today's rate and send it to a bank account.
export function CashOutPanel({ chainId, account }: { chainId: number; account: Account }) {
  const token = useToken();
  const rates = useRates();
  const [code, setCode] = useHomeCountry();
  const [summary, setSummary] = useState<Summary | undefined>();
  const [amount, setAmount] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Payout | undefined>();
  const country = countryOf(code) ?? COUNTRIES[0];
  const value = Number(amount);
  const local = toFiat(Number.isFinite(value) ? value : 0, country.currency, rates?.rates ?? FALLBACK_RATES);

  async function load() {
    try {
      setSummary(await api<Summary>(`/api/fiat/payouts?chainId=${chainId}`));
    } catch (err) {
      notify("error", errorText(err, "Could not read your balance"));
    }
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
    // load for this account
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.address, chainId]);

  const tooMuch = summary !== undefined && value > summary.available + 1e-9;
  const ready = value > 0 && !tooMuch && holderName.trim().length >= 2 && accountNumber.replace(/\s+/g, "").length >= 4;

  async function cashOut() {
    setBusy(true);
    try {
      const { payout } = await api<{ payout: Payout }>("/api/fiat/payouts", { chainId, amount, country: country.code, holderName, bankName, accountNumber });
      setSent(payout);
      setAmount("");
      notify("success", `${formatFiat(Number(payout.fiatAmount), payout.currency)} is on its way to your bank`);
      await load();
    } catch (err) {
      notify("error", errorText(err, "Could not cash out"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cash out" description="Turn your balance into local money and send it to your bank account, at today's exchange rate." />

      <div className="grid gap-4 lg:grid-cols-5">
        <FadeIn delay={0.05} className="surface-card lg:col-span-3">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center p-8 text-center">
                <SuccessMark size={72} />
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">{formatFiat(Number(sent.fiatAmount), sent.currency)} sent</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {money(sent.amount)} {token} converted and paid to {sent.bankName ?? "your bank"} ••{sent.accountLast4}
                </p>
                <div className="mt-6 w-full max-w-sm divide-y rounded-xl border px-4 text-left text-sm">
                  <Row label="Account holder">{sent.holderName}</Row>
                  <Row label="Rate">1 {token} = {formatFiat(Number(sent.rate), sent.currency)}</Row>
                  <Row label="Reference"><span className="font-mono text-xs">{sent.reference}</span></Row>
                  <Row label="Arrives">Usually within minutes</Row>
                </div>
                <Button className="mt-6 h-11 rounded-xl px-6" onClick={() => setSent(undefined)}>
                  Cash out again
                </Button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 p-5 md:p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cashout-amount">You send</Label>
                    <span className="text-xs text-muted-foreground">
                      Available: {summary ? <span className="font-medium text-foreground tabular-nums">{money(summary.available)} <Token /></span> : "…"}
                    </span>
                  </div>
                  <div className="relative">
                    <Input id="cashout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className="h-14 rounded-xl pr-24 text-2xl font-semibold tabular-nums md:text-2xl" />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      <button type="button" onClick={() => summary && setAmount(String(Math.floor(summary.available * 100) / 100))} className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                        Max
                      </button>
                      <span className="px-1 text-xs text-muted-foreground"><Token /></span>
                    </div>
                  </div>
                  {tooMuch && <p className="text-xs text-destructive">That is more than your available balance.</p>}
                </div>

                <div className="flex justify-center">
                  <span className="grid size-8 place-items-center rounded-full border bg-card text-muted-foreground shadow-soft">
                    <ArrowDown className="size-4" />
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cashout-country">You receive in</Label>
                  <CountryPicker id="cashout-country" value={country.code} onChange={setCode} />
                  <motion.div key={`${country.code}-${amount}`} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="rounded-xl border border-brand/25 bg-brand/5 p-4">
                    <p className="text-xs text-muted-foreground">They receive</p>
                    <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">{formatFiat(local, country.currency)}</p>
                    <RateLine country={country} token={token} rates={rates} className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">No fee · Paid by {country.rails}</p>
                  </motion.div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cashout-holder">Account holder</Label>
                    <Input id="cashout-holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name" className="h-11 rounded-xl" autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashout-bank">Bank (optional)</Label>
                    <Input id="cashout-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className="h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cashout-account">{country.accountLabel}</Label>
                  <Input id="cashout-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-11 rounded-xl font-mono" autoComplete="off" />
                </div>

                <Button size="lg" className="h-12 w-full rounded-xl text-[15px]" disabled={!ready || busy} onClick={() => void cashOut()}>
                  {busy ? <Spinner /> : <Landmark className="size-4" />}
                  {busy ? "Sending to your bank…" : value > 0 ? `Cash out ${formatFiat(local, country.currency)}` : "Enter an amount"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </FadeIn>

        <FadeIn delay={0.1} className="surface-card flex flex-col lg:col-span-2">
          <div className="flex items-center gap-3 border-b p-5 md:px-6">
            <IconChip icon={Banknote} tone="brand" size="sm" />
            <div>
              <p className="text-sm font-semibold">Cash-outs</p>
              <p className="text-xs text-muted-foreground">Money sent to your bank</p>
            </div>
          </div>
          <div className="flex-1 p-3">
            {!summary ? (
              <div className="space-y-2 p-2">
                <Shimmer className="h-14" rounded="rounded-xl" />
                <Shimmer className="h-14" rounded="rounded-xl" />
              </div>
            ) : summary.payouts.length === 0 ? (
              <EmptyState icon={Landmark} title="No cash-outs yet" description="Your cash-outs will show here." className="py-10" />
            ) : (
              <ul className="space-y-1">
                {summary.payouts.map((p) => {
                  const c = countryOf(p.country);
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50">
                      <span className="text-xl leading-none">{c?.flag ?? "🏦"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.bankName ?? "Bank"} ••{p.accountLast4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {money(p.amount)} <Token /> · {timeAgo(p.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatFiat(Number(p.fiatAmount), p.currency)}</p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-success">
                          <CheckCircle2 className="size-3" /> Paid
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
