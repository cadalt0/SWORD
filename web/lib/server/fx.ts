import "server-only";

import { CURRENCIES, FALLBACK_RATES, type Rates } from "@/lib/shared/fiat";

/// Live dollar exchange rates from ExchangeRate-API's open endpoint (free, no key, updated daily). Kept for an hour;
/// if the endpoint cannot be reached, recent fixed rates are used so pages never break.
const SOURCE = "https://open.er-api.com/v6/latest/USD";
const KEEP_MS = 60 * 60 * 1000;

let cached: { at: number; value: Rates } | undefined;

export async function dollarRates(): Promise<Rates> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.value;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (data.result !== "success" || !data.rates) throw new Error("no rates");
    const rates: Record<string, number> = {};
    for (const c of CURRENCIES) rates[c] = data.rates[c] ?? FALLBACK_RATES[c];
    const value: Rates = { base: "USD", rates, updatedAt: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString() : new Date().toISOString(), live: true };
    cached = { at: Date.now(), value };
    return value;
  } catch {
    // Keep showing the last live rates if there were any.
    if (cached) return cached.value;
    return { base: "USD", rates: { ...FALLBACK_RATES }, updatedAt: new Date().toISOString(), live: false };
  }
}

/// The rate for one currency, refusing ones Sword does not pay in.
export async function rateFor(currency: string): Promise<number> {
  const { rates } = await dollarRates();
  const rate = rates[currency];
  if (!rate) throw new Error(`Unsupported currency ${currency}`);
  return rate;
}
