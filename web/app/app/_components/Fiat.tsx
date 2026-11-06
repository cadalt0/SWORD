"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, ChevronDown, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { COUNTRIES, countryOf, FALLBACK_RATES, formatFiat, toFiat, type Country, type Rates } from "@/lib/shared/fiat";
import { cn } from "@/lib/utils";
import { Spinner } from "./kit";
import { CopyButton, errorText } from "./shared";

/// Local money: live rates, a country picker, and paying in local money. Used by every payment page and by Cash out.

let ratesOnce: Promise<Rates> | undefined;

/// Live dollar rates, fetched once per page and shared.
export function useRates(): Rates | undefined {
  const [rates, setRates] = useState<Rates | undefined>();
  useEffect(() => {
    let live = true;
    ratesOnce ??= fetch("/api/fx")
      .then((r) => r.json() as Promise<Rates>)
      .catch(() => {
        ratesOnce = undefined;
        return { base: "USD", rates: FALLBACK_RATES, updatedAt: new Date().toISOString(), live: false } as Rates;
      });
    void ratesOnce.then((r) => live && setRates(r));
    return () => {
      live = false;
    };
  }, []);
  return rates;
}

/// The visitor's country from their browser's language (en-IN is India), else the United States.
export function useHomeCountry(): [string, (code: string) => void] {
  const [code, setCode] = useState("US");
  useEffect(() => {
    const region = navigator.languages?.map((l) => l.split("-")[1]?.toUpperCase()).find((r) => r && countryOf(r));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after hydration
    if (region) setCode(region);
  }, []);
  return [code, setCode];
}

export function CountryPicker({ value, onChange, id }: { value: string; onChange: (code: string) => void; id?: string }) {
  const country = countryOf(value) ?? COUNTRIES[0];
  return (
    <Select value={country.code} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} className="h-11 w-full rounded-xl">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{country.flag}</span>
          <span className="truncate">{country.name}</span>
          <span className="text-xs text-muted-foreground">{country.currency}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">{c.flag}</span>
              {c.name}
              <span className="text-xs text-muted-foreground">{c.currency}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/// "1 USDC = ₹88.62", with when the rate was last updated.
export function RateLine({ country, token, rates, className }: { country: Country; token: string; rates: Rates | undefined; className?: string }) {
  const rate = rates?.rates[country.currency];
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <ArrowRightLeft className="size-3" />
      {rate ? (
        <>
          1 {token} = {formatFiat(rate, country.currency)}
          {rates?.live && (
            <span className="inline-flex items-center gap-1">
              · <span className="size-1.5 rounded-full bg-success" /> live rate
            </span>
          )}
        </>
      ) : (
        "Loading rate…"
      )}
    </p>
  );
}

/// The id a payer quotes in their bank transfer, so the payment is matched to this order. Fixed per page.
function usePaymentCode(seed: string) {
  const [code, setCode] = useState("");
  useEffect(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let s = "";
    for (let i = 0; i < 6; i++) {
      s += chars[h % chars.length];
      h = Math.floor(h / chars.length) + (i + 1) * 7919;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- made on the client so the server and client agree
    setCode(`SW-${s}`);
  }, [seed]);
  return code;
}

/// Pay in local money: pick a country, see the amount at today's rate, pay with the bank or app used there, then
/// enter the id it shows. `seed` identifies what is being paid (an order or subscription id).
export function FiatPay({
  amount,
  token,
  seed,
  onPay,
  cta = "I've paid",
  payerLabel = "you",
}: {
  /// In the stablecoin, which tracks the dollar.
  amount: number;
  token: string;
  seed: string;
  onPay: (input: { country: string; reference: string }) => Promise<void>;
  cta?: string;
  /// Who sends the transfer, in the instructions: "you" or "the customer".
  payerLabel?: string;
}) {
  const rates = useRates();
  const [code, setCode] = useHomeCountry();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const payCode = usePaymentCode(seed);
  const country = countryOf(code) ?? COUNTRIES[0];
  const local = toFiat(amount, country.currency, rates?.rates ?? FALLBACK_RATES);
  const localText = formatFiat(local, country.currency);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await onPay({ country: country.code, reference: reference.trim() });
    } catch (err) {
      setError(errorText(err, "Could not confirm the payment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`fiat-country-${seed}`}>Country</Label>
        <CountryPicker id={`fiat-country-${seed}`} value={country.code} onChange={setCode} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={country.code} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Amount to pay</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{localText}</p>
          <RateLine country={country} token={token} rates={rates} className="mt-1" />
          <ol className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Step n={1} />
              <span>
                {payerLabel === "you" ? "Pay" : "The customer pays"} <span className="font-medium text-foreground">{localText}</span> with {country.rails}.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Step n={2} />
              <span className="flex flex-wrap items-center gap-1">
                Add this note to the payment:
                <span className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground ring-1 ring-border">{payCode || "…"}</span>
                {payCode && <CopyButton value={payCode} label="" className="h-6 px-1.5" />}
              </span>
            </li>
            <li className="flex gap-2">
              <Step n={3} />
              <span>Enter the {country.referenceLabel} {payerLabel === "you" ? "your bank shows" : "from the customer's receipt"}.</span>
            </li>
          </ol>
        </motion.div>
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor={`fiat-ref-${seed}`}>{country.referenceLabel}</Label>
        <Input id={`fiat-ref-${seed}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={placeholderFor(country)} className="h-11 rounded-xl font-mono" autoComplete="off" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="lg" variant="outline" className="h-11 w-full rounded-xl" disabled={busy || reference.trim().length < 4} onClick={submit}>
        {busy ? <Spinner /> : <Landmark className="size-4" />}
        {busy ? "Confirming payment…" : `${cta} ${localText}`}
      </Button>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-semibold text-foreground">{n}</span>;
}

function placeholderFor(c: Country): string {
  if (c.code === "IN") return "e.g. 432118765012";
  if (c.code === "BR") return "e.g. E1234567820251106";
  if (c.code === "KE") return "e.g. SKL7Q2M4XP";
  return "e.g. TXN4821937";
}

/// How an order or subscription was paid in local money.
export type PaidWith = { currency: string; fiatAmount: string; rate: string; country: string | null; reference: string; at: string };

export function paidWithText(p: PaidWith): string {
  const c = countryOf(p.country ?? undefined);
  return `${formatFiat(Number(p.fiatAmount), p.currency)}${c ? ` · ${c.rails.split(/,| or /)[0].trim()}` : ""}`;
}

export type PayMode = "crypto" | "bank";

/// One of the two ways to pay on a payment page. The chosen one is open and first; the other shrinks to a single row
/// that brings it back (and minimizes the first) when pressed.
export function ModeGroup({
  mode,
  active,
  onPick,
  icon,
  title,
  subtitle,
  children,
}: {
  mode: PayMode;
  active: PayMode;
  onPick: (mode: PayMode) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const open = mode === active;
  return (
    <motion.div layout="position" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} style={{ order: open ? 0 : 1 }}>
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div key="open" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-3">
            {children}
          </motion.div>
        ) : (
          <motion.button
            key="closed"
            type="button"
            onClick={() => onPick(mode)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
            aria-label={`Show ${title}`}
          >
            {icon}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Show <ChevronDown className="size-3.5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
