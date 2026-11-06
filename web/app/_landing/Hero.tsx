"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, Check, Zap } from "lucide-react";

import { LogoMark } from "../app/_components/kit";
import { useRates } from "../app/_components/Fiat";
import { countryOf, FALLBACK_RATES } from "@/lib/shared/fiat";
import { Gradient } from "./ui";

/// The 3D coins are drawn only in the browser, after the page shows, so the page appears at once.
const CoinScene = dynamic(() => import("./CoinScene"), { ssr: false, loading: () => null });

const NAV = [
  { href: "#fees", label: "Pricing" },
  { href: "#global", label: "Global" },
  { href: "#features", label: "Features" },
  { href: "#developers", label: "For stores" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div className={`flex h-14 w-full max-w-5xl items-center justify-between rounded-full px-3 pl-5 transition-all duration-500 ${scrolled ? "border border-white/10 bg-[#0a0912]/70 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl" : "border border-transparent"}`}>
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <LogoMark size={28} />
          <span className="text-[17px] font-semibold tracking-tight">Sword</span>
        </Link>
        <nav className="hidden items-center md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-full px-4 py-2 text-sm text-white/55 transition-colors hover:text-white">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/app" className="hidden rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:text-white sm:block">
            Sign in
          </Link>
          <Link href="/app" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0a0912] transition-transform hover:scale-[1.03]">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  const { scrollY } = useScroll();
  const sceneY = useTransform(scrollY, [0, 800], [0, 160]);
  const textY = useTransform(scrollY, [0, 800], [0, -60]);
  const fade = useTransform(scrollY, [0, 600], [1, 0]);

  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[55%] top-[45%] size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(109,77,255,0.32),transparent)]" />
        <div className="absolute left-[75%] top-[30%] size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.14),transparent)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-4 px-6 md:px-10 lg:grid-cols-[1fr_1.05fr]">
        <motion.div style={{ y: textY, opacity: fade }} className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(3rem,6.6vw,6.25rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-white [&>*]:whitespace-nowrap"
          >
            <span className="block">Pay anyone.</span>
            <span className="block">
              <Gradient>Pay anywhere.</Gradient>
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }} className="mt-7 max-w-xl text-xl leading-snug text-white/55 md:text-2xl">
            Stablecoins in from any chain. Local money out in 80+ countries.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/app" className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#0a0912] shadow-[0_0_0_6px_rgba(255,255,255,0.06),0_20px_50px_-15px_rgba(139,92,246,0.9)] transition-transform hover:scale-[1.03]">
              Start for free <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/playground" className="inline-flex h-13 items-center rounded-full px-6 py-3.5 text-base text-white/70 transition-colors hover:text-white">
              Try the demo
            </Link>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: sceneY }} className="relative flex h-[520px] items-center justify-center sm:h-[600px] lg:h-[680px]">
          <div className="absolute inset-0">
            <CoinScene />
          </div>
          <TransferCard />
        </motion.div>
      </div>

      <motion.a href="#numbers" style={{ opacity: fade }} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/35" aria-label="Scroll">
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }} className="block h-10 w-6 rounded-full border border-white/20">
          <span className="mx-auto mt-2 block h-2 w-1 rounded-full bg-white/50" />
        </motion.span>
      </motion.a>
    </section>
  );
}

/// Countries the hero's card cycles through, with how long each payment took to arrive.
const ROUTES = [
  { code: "IN", seconds: "2.1" },
  { code: "BR", seconds: "1.8" },
  { code: "DE", seconds: "2.6" },
  { code: "NG", seconds: "2.3" },
  { code: "MX", seconds: "1.9" },
  { code: "PH", seconds: "2.4" },
  { code: "GB", seconds: "2.2" },
  { code: "KE", seconds: "2.0" },
];
const SEND = 1000;
const STEPS = ["Sent", "Converted", "Delivered"];

/// Local money as people write it there (₦, ₱, R$), without decimals once the number is large.
function local(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: amount >= 10_000 ? 0 : 2,
    minimumFractionDigits: amount >= 10_000 ? 0 : 2,
  }).format(amount);
}

/// A live transfer: 1,000 USDC in, local money out, at today's exchange rate. It moves on to the next country every
/// few seconds, and its three steps fill in each time.
function TransferCard() {
  const rates = useRates();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const ticks = [
      window.setTimeout(() => setStep(1), 700),
      window.setTimeout(() => setStep(2), 1400),
      window.setTimeout(() => setStep(3), 2100),
      window.setTimeout(() => {
        setStep(0);
        setI((n) => (n + 1) % ROUTES.length);
      }, 4200),
    ];
    return () => ticks.forEach(window.clearTimeout);
  }, [i, reduce]);

  const route = ROUTES[i];
  const country = countryOf(route.code)!;
  const rate = rates?.rates[country.currency] ?? FALLBACK_RATES[country.currency] ?? 1;
  const done = reduce || step >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[380px]"
    >
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.35),transparent)] blur-2xl" />
      <div className="overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="flex items-center gap-2 text-sm font-medium text-white/80">
            <LogoMark size={22} /> Transfer
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live rates
          </span>
        </div>

        <div className="mx-4 mt-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/8">
          <p className="text-xs text-white/45">You send</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-white">1,000.00</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/8 py-1 pl-1 pr-3 text-sm font-medium text-white">
              <span className="grid size-6 place-items-center rounded-full bg-[#2775ca] text-[11px] font-bold">$</span>
              USDC
            </span>
          </div>
        </div>

        <div className="relative z-10 -my-3 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#15122a] px-3 py-1.5 text-[11px] text-white/60 shadow-lg">
            <ArrowDown className="size-3.5 text-violet-300" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={country.code} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="tabular-nums">
                1 USDC = {local(rate, country.currency)}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className="mx-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/8">
          <p className="text-xs text-white/45">They receive</p>
          <div className="mt-1 h-10 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={country.code} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex items-center justify-between gap-3">
                <span className="truncate text-3xl font-semibold tracking-tight tabular-nums text-white">{local(SEND * rate, country.currency)}</span>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/8 py-1 pl-1.5 pr-3 text-sm font-medium text-white">
                  <span className="text-base leading-none">{country.flag}</span>
                  {country.currency}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={country.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1 text-xs text-white/45">
              To a bank in {country.name} · {country.rails}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="px-6 pb-5 pt-5">
          <div className="flex items-center">
            {STEPS.map((label, n) => {
              const reached = reduce || step > n;
              return (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.span
                      animate={{ scale: reached ? 1 : 0.85, backgroundColor: reached ? "rgb(52 211 153)" : "rgba(255,255,255,0.08)" }}
                      transition={{ duration: 0.3 }}
                      className="grid size-6 place-items-center rounded-full text-[#0a0912]"
                    >
                      {reached ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-white/30" />}
                    </motion.span>
                    <span className={`text-[11px] ${reached ? "text-white/80" : "text-white/35"}`}>{label}</span>
                  </div>
                  {n < STEPS.length - 1 && (
                    <div className="mx-2 mb-5 h-px flex-1 overflow-hidden bg-white/10">
                      <motion.div className="h-full bg-emerald-400" animate={{ width: reduce || step > n + 1 ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4 text-xs">
            <span className="text-white/45">
              Fee <span className="font-medium text-white">$0.00</span>
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={`${country.code}-${done}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`inline-flex items-center gap-1 font-medium ${done ? "text-emerald-300" : "text-white/45"}`}>
                <Zap className="size-3.5" />
                {done ? `Arrived in ${route.seconds}s` : "Sending…"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
