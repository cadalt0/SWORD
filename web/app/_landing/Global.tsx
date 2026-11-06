"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowRight, Check, Lock, ShieldCheck, Snowflake } from "lucide-react";

import { LogoMark } from "../app/_components/kit";
import { Gradient, Marquee, Reveal } from "./ui";

const GlobeScene = dynamic(() => import("./GlobeScene"), { ssr: false, loading: () => null });

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/// A number that glides to its new value.
function Glide({ value, format = usd, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={className}>{text}</motion.span>;
}

// ---------------------------------------------------------------------------------------------------- fees

const MIN = 100;
const MAX = 20000;

export function Fees() {
  const [amount, setAmount] = useState(2500);
  const rows = [
    { name: "PayPal", note: "Per transfer", low: 4.4, high: 4.4 },
    { name: "Banks & SWIFT", note: "Fees + FX markup", low: 3, high: 4 },
    { name: "Other fintechs", note: "Hidden in the FX rate", low: 2, high: 5 },
  ];
  const ours = 0.01 * amount;
  const save = 0.044 * amount - ours;
  const pct = ((amount - MIN) / (MAX - MIN)) * 100;

  return (
    <section id="fees" className="scroll-mt-24 px-6 py-28 md:px-10">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <h2 className="text-[clamp(2.75rem,6.5vw,5.25rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-white">
            One price.
            <br />
            <Gradient>Just 1%.</Gradient>
          </h2>
          <p className="mt-6 max-w-md text-xl leading-relaxed text-white/50">Banks hide markups in the exchange rate. Apps take 4% or more. We charge 1%, and nothing else.</p>
          <ul className="mt-8 space-y-3 text-white/70">
            {["No FX markup", "No surprise fees", "One clear price"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative">
            <div aria-hidden className="absolute -inset-8 rounded-[48px] bg-[radial-gradient(closest-side,rgba(245,197,66,0.16),transparent)]" />
            <div className="relative rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-8 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl md:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Your client pays</p>
              <Glide value={amount} className="mt-2 block text-6xl font-semibold tabular-nums tracking-tight text-white" />

              <div className="relative mt-8 h-8">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
                <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${pct}%` }} />
                <div className="pointer-events-none absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-amber-400 shadow-[0_0_0_8px_rgba(245,197,66,0.18)]" style={{ left: `${pct}%` }} />
                <input
                  type="range"
                  min={MIN}
                  max={MAX}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  aria-label="Amount your client pays"
                  className="absolute inset-0 w-full cursor-pointer opacity-0"
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-xs text-white/35">
                <span>{usd(MIN)}</span>
                <span>{usd(MAX)}</span>
              </div>

              <div className="mt-8 divide-y divide-white/[0.07]">
                {rows.map((r) => (
                  <div key={r.name} className="grid grid-cols-[1.1fr_1fr_auto] items-center gap-4 py-4">
                    <div>
                      <p className="font-medium text-white/85">{r.name}</p>
                      <p className="text-xs text-white/40">{r.note}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-6 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
                        <motion.div className="relative h-full rounded-md bg-white/20" initial={{ width: 0 }} whileInView={{ width: `${(r.high / 5) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
                          {r.low !== r.high && <span className="absolute inset-y-0 left-0 rounded-md bg-white/25" style={{ width: `${(r.low / r.high) * 100}%` }} />}
                        </motion.div>
                      </div>
                      <span className="w-12 font-mono text-xs text-white/45">{r.low === r.high ? `${r.low}%` : `${r.low}–${r.high}%`}</span>
                    </div>
                    <span className="text-right text-lg tabular-nums text-white/70">
                      {r.low === r.high ? (
                        <Glide value={(r.low / 100) * amount} />
                      ) : (
                        <>
                          <Glide value={(r.low / 100) * amount} />–<Glide value={(r.high / 100) * amount} />
                        </>
                      )}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[1.1fr_1fr_auto] items-center gap-4 py-4">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-amber-300">
                      <LogoMark size={18} /> Sword
                    </p>
                    <p className="text-xs text-white/40">Flat · no FX markup</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-6 flex-1">
                      <motion.div className="h-full rounded-md bg-gradient-to-r from-amber-300 to-amber-500 shadow-[0_0_20px_rgba(245,197,66,0.5)]" initial={{ width: 0 }} whileInView={{ width: "20%" }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <span className="w-12 font-mono text-xs text-amber-300">1%</span>
                  </div>
                  <Glide value={ours} className="text-right text-xl font-semibold tabular-nums text-white" />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-[#0a0912]">
                Save <Glide value={save} className="text-amber-600" /> with Sword
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- pay anywhere

const PAYOUTS = [
  { to: "Ada · Lagos", amount: "₦ 1,240,000", code: "NGN" },
  { to: "Rahul · Mumbai", amount: "₹ 2,08,450", code: "INR" },
  { to: "Lucas · São Paulo", amount: "R$ 12,400", code: "BRL" },
  { to: "Maria · Manila", amount: "₱ 58,200", code: "PHP" },
  { to: "Jonas · Berlin", amount: "€ 2,280", code: "EUR" },
  { to: "Amina · Nairobi", amount: "KSh 186,000", code: "KES" },
  { to: "Diego · Mexico City", amount: "MX$ 41,900", code: "MXN" },
];

export function PayAnywhere() {
  const reduce = useReducedMotion();
  const [head, setHead] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setHead((h) => (h + 1) % PAYOUTS.length), 1800);
    return () => clearInterval(t);
  }, [reduce]);
  // Newest on top: each new payout drops in, the oldest leaves at the bottom.
  const n = PAYOUTS.length;
  const feed = [0, 1, 2, 3].map((k) => ({ index: (head - k + n * 4) % n, payout: PAYOUTS[(head - k + n * 4) % n]! }));

  return (
    <section id="global" className="relative scroll-mt-24 overflow-hidden px-6 py-28 md:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
            Any chain in. <Gradient>Local money out.</Gradient>
          </h2>
          <p className="mt-5 text-lg text-white/45 md:text-xl">Send stablecoins from any chain. They arrive as local currency in 80+ countries.</p>
        </Reveal>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <Reveal className="relative aspect-square w-full max-w-[640px] justify-self-center">
            <div aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(109,77,255,0.35),transparent)] blur-2xl" />
            <div className="absolute inset-0">
              <GlobeScene />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between px-1 pb-4">
                <p className="text-sm font-semibold text-white">Live payouts</p>
                <span className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Settling now
                </span>
              </div>
              <ul className="space-y-2">
                {feed.map(({ index, payout: p }, i) => (
                  <motion.li
                    key={index}
                    layout="position"
                    initial={i === 0 ? { opacity: 0, y: -14, scale: 0.97 } : false}
                    animate={{ opacity: 1 - i * 0.22, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-sky-500/30 font-mono text-[11px] font-semibold text-white">{p.code}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{p.to}</p>
                      <p className="text-xs text-white/40">Bank deposit · seconds</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-white">{p.amount}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- currencies

const CURRENCIES = [
  ["USD", "$"], ["EUR", "€"], ["GBP", "£"], ["INR", "₹"], ["BRL", "R$"], ["MXN", "$"], ["NGN", "₦"], ["KES", "KSh"], ["PHP", "₱"], ["IDR", "Rp"],
  ["VND", "₫"], ["TRY", "₺"], ["AED", "د.إ"], ["ZAR", "R"], ["JPY", "¥"], ["KRW", "₩"], ["CAD", "$"], ["AUD", "$"], ["ARS", "$"], ["COP", "$"],
  ["PKR", "₨"], ["BDT", "৳"], ["EGP", "£"], ["THB", "฿"], ["GHS", "₵"], ["SGD", "$"], ["CHF", "Fr"], ["PLN", "zł"], ["SEK", "kr"], ["MYR", "RM"],
];

function CurrencyChip({ code, symbol }: { code: string; symbol: string }) {
  return (
    <span className="flex items-center gap-3 whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-2.5 pr-5">
      <span className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-lg text-white">{symbol}</span>
      <span className="font-mono text-sm font-semibold text-white/80">{code}</span>
    </span>
  );
}

export function Currencies() {
  const half = Math.ceil(CURRENCIES.length / 2);
  return (
    <section className="overflow-hidden py-28">
      <Reveal className="px-6 text-center md:px-10">
        <h2 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
          Get paid in stablecoins.
          <br />
          <Gradient>Cash out in 50+ currencies.</Gradient>
        </h2>
      </Reveal>
      <div className="mt-14 space-y-4">
        <Marquee>
          {CURRENCIES.slice(0, half).map(([c, s]) => (
            <CurrencyChip key={c} code={c!} symbol={s!} />
          ))}
        </Marquee>
        <div className="[&_.animate-marquee]:[animation-direction:reverse]">
          <Marquee>
            {CURRENCIES.slice(half).map(([c, s]) => (
              <CurrencyChip key={c} code={c!} symbol={s!} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- no freezes

export function NoFreeze() {
  return (
    <section className="px-6 py-28 md:px-10">
      <Reveal className="text-center">
        <h2 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
          Get paid safely. <Gradient>No bank freezes.</Gradient>
        </h2>
        <p className="mt-5 text-lg text-white/45 md:text-xl">Your money stays yours. No holds, no frozen accounts, no waiting.</p>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-4xl items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-sky-200/10 bg-[linear-gradient(160deg,#1a2233,#10151f)] p-7 grayscale-[0.3]">
            <motion.div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(186,230,253,0.25),transparent_60%)]" animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 3, repeat: Infinity }} />
            <div className="relative flex items-center justify-between">
              <span className="text-sm text-white/50">Bank account</span>
              <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }} className="grid size-9 place-items-center rounded-full bg-sky-200/10 text-sky-200">
                <Lock className="size-4" />
              </motion.span>
            </div>
            <p className="relative mt-8 text-4xl font-semibold tabular-nums tracking-tight text-white/35 line-through decoration-sky-200/40">$12,480.00</p>
            <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-200/10 px-3 py-1 text-xs font-semibold text-sky-200">
              <Snowflake className="size-3.5" /> Frozen · under review
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="flex justify-center">
          <motion.span animate={{ x: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/60">
            <ArrowRight className="size-5" />
          </motion.span>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="relative overflow-hidden rounded-[28px] border border-violet-400/30 bg-[linear-gradient(160deg,rgba(109,77,255,0.35),rgba(20,14,48,0.9))] p-7 shadow-[0_30px_80px_-30px_rgba(109,77,255,0.9)]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-white/70">
                <LogoMark size={20} /> Sword
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                <ShieldCheck className="size-4" />
              </span>
            </div>
            <p className="mt-8 text-4xl font-semibold tabular-nums tracking-tight text-white">12,480.00</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Available now
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
