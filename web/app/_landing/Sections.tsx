"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Code2, Fingerprint, KeyRound, Play, Sparkles, Store } from "lucide-react";

import { LogoMark } from "../app/_components/kit";
import { Gradient, Marquee, Reveal, TiltCard } from "./ui";

/// A section title: one line, big. An optional second line, small.
function Title({ children, sub, className = "" }: { children: React.ReactNode; sub?: string; className?: string }) {
  return (
    <Reveal className={`text-center ${className}`}>
      <h2 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">{children}</h2>
      {sub && <p className="mt-5 text-lg text-white/45 md:text-xl">{sub}</p>}
    </Reveal>
  );
}

// ---------------------------------------------------------------------------------------------------- numbers

function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {n}
      {suffix}
    </span>
  );
}

export function Numbers() {
  const items = [
    { value: 80, suffix: "+", label: "countries" },
    { value: 50, suffix: "+", label: "currencies" },
    { value: 1, suffix: "%", label: "flat fee" },
    { value: 0, label: "hidden charges" },
  ];
  return (
    <section id="numbers" className="mx-auto max-w-6xl px-6 py-24 md:px-10">
      <div className="grid grid-cols-2 gap-y-12 md:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 0.08} className="text-center">
            <p className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-6xl font-semibold tracking-tight text-transparent md:text-7xl">
              <Count to={it.value} suffix={it.suffix} />
            </p>
            <p className="mt-2 text-sm text-white/45">{it.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- words

export function Words() {
  const words = ["Checkout", "Invoices", "Subscriptions", "Refunds", "Receipts", "Your keys"];
  return (
    <section className="py-10">
      <Marquee>
        {words.map((w) => (
          <span key={w} className="flex items-center gap-10 pr-6">
            <span className="text-[clamp(3rem,8vw,6.5rem)] font-semibold tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.22)]">{w}</span>
            <LogoMark size={36} className="opacity-70" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- control

const MODES = [
  { icon: Sparkles, name: "Managed", line: "We handle everything." },
  { icon: KeyRound, name: "Your wallet", line: "Only you hold the keys." },
  { icon: Fingerprint, name: "Sign once", line: "Approve once. Runs hands-free." },
];

export function Control() {
  return (
    <section id="control" className="scroll-mt-24 px-6 py-28 md:px-10">
      <Title sub="Custodial or fully decentralized. Your call.">
        Your money. <Gradient>Your rules.</Gradient>
      </Title>
      <div className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
        {MODES.map((m, i) => (
          <Reveal key={m.name} delay={i * 0.1}>
            <TiltCard className="h-full p-8">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_15px_40px_-12px_rgba(109,77,255,0.9)]">
                <m.icon className="size-6" />
              </span>
              <p className="mt-10 text-2xl font-semibold tracking-tight text-white">{m.name}</p>
              <p className="mt-1 text-white/45">{m.line}</p>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- customers

const STEPS = ["idle", "pressed", "confirming", "done"] as const;

export function Customers() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 1500);
    return () => clearInterval(t);
  }, [reduce]);
  const step = STEPS[i]!;

  return (
    <section id="customers" className="scroll-mt-24 overflow-hidden px-6 py-28 md:px-10">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
            Your customers
            <br />
            <Gradient>just tap.</Gradient>
          </h2>
          <p className="mt-6 text-xl text-white/45">No wallet. No fees. No seed phrase.</p>
          <div className="mt-10 flex flex-wrap gap-2">
            {["Signless wallet", "One-click pay", "Instant receipt", "Easy refunds"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70">
                {t}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="flex justify-center">
          <div className="relative">
            <div aria-hidden className="absolute -inset-16 rounded-full bg-[radial-gradient(closest-side,rgba(109,77,255,0.4),transparent)]" />
            <div className="relative h-[560px] w-[280px] rounded-[46px] border border-white/12 bg-[#0c0a16] p-2.5 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.95)]">
              <div className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="relative flex h-full flex-col overflow-hidden rounded-[38px] bg-[#100d1f] px-6 pb-6 pt-14">
                <div className="grid aspect-square place-items-center rounded-[28px] bg-[radial-gradient(circle_at_30%_20%,#8b5cf6,#3b2a9a_55%,#151032)]">
                  <svg viewBox="0 0 64 64" className="size-28 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                    <g transform="rotate(45 32 32)">
                      <path d="M32 4 L37 13 L37 39 L32 41 Z" fill="#fff" fillOpacity="0.75" />
                      <path d="M32 4 L27 13 L27 39 L32 41 Z" fill="#fff" />
                      <rect x="19" y="39" width="26" height="4.5" rx="2.25" fill="#f3c873" />
                      <rect x="29.8" y="43" width="4.4" height="10" rx="1.6" fill="#2a2147" />
                      <circle cx="32" cy="56" r="3.4" fill="#f3c873" />
                    </g>
                  </svg>
                </div>
                <p className="mt-6 text-lg font-semibold text-white">Pocket Sword</p>
                <p className="text-3xl font-semibold tabular-nums text-white">49.00</p>
                <div className="mt-auto">
                  <AnimatePresence mode="wait">
                    {step === "done" ? (
                      <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-semibold text-white">
                        <Check className="size-5" strokeWidth={3} /> Paid
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, scale: step === "pressed" ? 0.96 : 1 }}
                        exit={{ opacity: 0 }}
                        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-[#0a0912]"
                      >
                        {step === "confirming" ? (
                          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }} className="size-5 rounded-full border-2 border-black/15 border-t-black" />
                        ) : (
                          <>
                            <LogoMark size={20} /> Pay
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- developers

export function Developers() {
  return (
    <section id="developers" className="scroll-mt-24 px-6 py-28 md:px-10">
      <Reveal className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-1.5 text-sm font-medium text-amber-200">
          <Store className="size-4" /> For online stores &amp; sellers
        </span>
        <h2 className="mt-6 text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
          Run a store? <Gradient>Plug in.</Gradient>
        </h2>
        <p className="mt-5 text-lg text-white/45 md:text-xl">Add a Sword pay button to your website or app. Shoppers pay in one tap.</p>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-5xl items-center gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        {/* the seller's own checkout, with Sword in it */}
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0a16] shadow-[0_40px_100px_-40px_rgba(109,77,255,0.7)]">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex gap-1.5">
                <span className="size-3 rounded-full bg-white/10" />
                <span className="size-3 rounded-full bg-white/10" />
                <span className="size-3 rounded-full bg-white/10" />
              </div>
              <span className="flex-1 truncate rounded-full bg-white/[0.05] px-4 py-1.5 text-center text-xs text-white/45">yourstore.com/checkout</span>
            </div>
            <div className="grid gap-6 p-7 sm:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Your cart</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid size-16 place-items-center rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#8b5cf6,#2a1f6b)]">
                    <LogoMark size={30} />
                  </span>
                  <div>
                    <p className="font-medium text-white">Leather backpack</p>
                    <p className="text-sm text-white/40">Qty 1</p>
                  </div>
                </div>
                <div className="mt-6 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
                  <div className="flex justify-between text-white/45">
                    <span>Subtotal</span>
                    <span className="tabular-nums">$89.00</span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>Shipping</span>
                    <span>Free</span>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-semibold text-white">
                    <span>Total</span>
                    <span className="tabular-nums">$89.00</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Pay with</p>
                <span className="flex h-12 items-center justify-center rounded-2xl border border-white/10 text-sm text-white/35">Card</span>
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="relative flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-[#0a0912] shadow-[0_0_0_4px_rgba(167,139,250,0.25),0_15px_40px_-10px_rgba(139,92,246,0.9)]"
                >
                  <motion.span aria-hidden className="absolute inset-0 rounded-2xl ring-2 ring-violet-400" animate={{ opacity: [0.8, 0], scale: [1, 1.08] }} transition={{ duration: 1.8, repeat: Infinity }} />
                  <LogoMark size={20} /> Pay with Sword
                </motion.span>
                <p className="text-center text-xs text-white/35">One tap · no fees for shoppers</p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* what the seller's developer adds */}
        <Reveal delay={0.2}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-white/70">
              <Code2 className="size-4 text-violet-300" /> Your developer adds
            </p>
            <div className="mt-4 space-y-1.5 rounded-2xl bg-[#0a0814] p-4 font-mono text-[12.5px] leading-relaxed">
              <div>
                <span className="text-violet-300">const</span> <span className="text-white/80">sword = </span>
                <span className="text-violet-300">new</span> <span className="text-sky-300">Sword</span>
                <span className="text-white/80">()</span>
              </div>
              <div>
                <span className="text-white/80">sword.orders.</span>
                <span className="text-sky-300">create</span>
                <span className="text-white/80">{"({ amount: "}</span>
                <span className="text-emerald-300">&quot;89&quot;</span>
                <span className="text-white/80">{" })"}</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/45">That&apos;s it. A few lines, and the button works.</p>
            <Link href="/playground" className="group relative mt-5 inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_0_4px_rgba(167,139,250,0.18),0_15px_40px_-10px_rgba(109,77,255,0.9)] transition-transform hover:scale-[1.03]">
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
              <Play className="size-4 fill-current" /> Try it in the playground <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- closing

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-6 py-40 text-center md:px-10">
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(109,77,255,0.35),transparent)]" />
      <Reveal>
        <LogoMark size={64} className="mx-auto" />
        <h2 className="mt-10 text-[clamp(3rem,8vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-white">
          Money without <Gradient>borders.</Gradient>
        </h2>
        <div className="mt-12">
          <Link href="/app" className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-[#0a0912] shadow-[0_0_0_6px_rgba(255,255,255,0.06),0_20px_50px_-15px_rgba(139,92,246,0.9)] transition-transform hover:scale-[1.03]">
            Get started free <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-6 pb-10 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-white/[0.06] pt-8 text-sm text-white/35">
        <span className="flex items-center gap-2 text-white/60">
          <LogoMark size={20} /> Sword
        </span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
