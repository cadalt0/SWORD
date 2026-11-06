"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { ArrowDownLeft, BadgeCheck, Check, Link2, Repeat, RotateCcw, Zap } from "lucide-react";

import { LogoMark } from "../app/_components/kit";
import { Gradient, Reveal } from "./ui";

/// The features, as a pinned showcase: the list scrolls on the left, one large living mock-up of the product on the
/// right changes with it. On small screens it becomes a simple stack.

type Feature = { key: string; icon: typeof Zap; title: string; line: string; accent: string; Visual: () => ReactNode };

const FEATURES: Feature[] = [
  { key: "tap", icon: Zap, title: "One tap.", line: "Show a code. Get paid in seconds.", accent: "#a78bfa", Visual: TapVisual },
  { key: "link", icon: Link2, title: "Just a link.", line: "Send it anywhere. Get paid.", accent: "#7dd3fc", Visual: LinkVisual },
  { key: "renew", icon: Repeat, title: "Bills that renew.", line: "Subscriptions and recurring invoices.", accent: "#c4b5fd", Visual: RenewVisual },
  { key: "refund", icon: RotateCcw, title: "Instant refunds.", line: "Full or partial. One click.", accent: "#6ee7b7", Visual: RefundVisual },
  { key: "proof", icon: BadgeCheck, title: "Proof on-chain.", line: "Every receipt, verifiable by anyone.", accent: "#fcd34d", Visual: ProofVisual },
];

/// Steps through 0..count-1 every `ms`, for the looping mock-ups. Stays on the last step when motion is reduced.
function useLoop(count: number, ms: number) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? count - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStep((s) => (s + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms, reduce]);
  return step;
}

export function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => setActive(Math.min(FEATURES.length - 1, Math.max(0, Math.floor(p * FEATURES.length)))));
  const feature = FEATURES[active]!;

  return (
    <section id="features" className="scroll-mt-24">
      <div className="px-6 pt-28 text-center md:px-10">
        <Reveal>
          <h2 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white">
            One place. <Gradient>Every payment.</Gradient>
          </h2>
        </Reveal>
      </div>

      {/* large screens: pinned showcase */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${FEATURES.length * 80}vh` }}>
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[0.9fr_1.1fr] items-center gap-16 px-10">
            <ol className="space-y-2">
              {FEATURES.map((f, i) => {
                const on = i === active;
                return (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => {
                        const el = ref.current;
                        if (!el) return;
                        const top = el.getBoundingClientRect().top + window.scrollY;
                        window.scrollTo({ top: top + (i + 0.5) * (el.offsetHeight / FEATURES.length) - window.innerHeight / 2, behavior: "smooth" });
                      }}
                      className="group relative flex w-full items-start gap-5 rounded-3xl px-6 py-5 text-left"
                    >
                      {on && <motion.span layoutId="feature-active" className="absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.04]" transition={{ type: "spring", stiffness: 300, damping: 32 }} />}
                      <span className="relative mt-1 grid size-10 shrink-0 place-items-center rounded-2xl transition-colors" style={{ background: on ? `${f.accent}26` : "rgba(255,255,255,0.04)", color: on ? f.accent : "rgba(255,255,255,0.35)" }}>
                        <f.icon className="size-5" />
                      </span>
                      <span className="relative">
                        <span className={`block text-3xl font-semibold tracking-tight transition-colors duration-300 ${on ? "text-white" : "text-white/25 group-hover:text-white/45"}`}>{f.title}</span>
                        <span className={`block overflow-hidden text-lg transition-all duration-500 ${on ? "mt-1 max-h-10 text-white/50" : "max-h-0 text-white/0"}`}>{f.line}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="relative aspect-[1.05] w-full">
              <motion.div aria-hidden className="absolute -inset-10 rounded-full blur-3xl" animate={{ background: `radial-gradient(closest-side, ${feature.accent}40, transparent)` }} transition={{ duration: 0.8 }} />
              <div className="relative h-full overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
                <AnimatePresence mode="wait">
                  <motion.div key={feature.key} initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 grid place-items-center p-10">
                    <div className="scale-[1.12]">
                      <feature.Visual />
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="absolute inset-x-10 bottom-7 flex gap-1.5">
                  {FEATURES.map((f, i) => (
                    <span key={f.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.span className="block h-full rounded-full" style={{ background: f.accent }} animate={{ width: i < active ? "100%" : i === active ? "100%" : "0%" }} transition={{ duration: i === active ? 0.6 : 0.3 }} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* small screens: a stack */}
      <div className="space-y-5 px-6 pb-10 pt-14 lg:hidden">
        {FEATURES.map((f) => (
          <Reveal key={f.key}>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
              <div className="flex justify-center overflow-hidden px-2 py-8">
                <div className="origin-top scale-[0.88] [margin-bottom:-6%]">
                  <f.Visual />
                </div>
              </div>
              <div className="border-t border-white/[0.06] p-6">
                <p className="text-2xl font-semibold tracking-tight text-white">{f.title}</p>
                <p className="mt-1 text-white/50">{f.line}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- the mock-ups

const glass = "rounded-[28px] border border-white/12 bg-[#0d0b19]/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]";

/// A till: the amount, then the code to scan, then paid.
function TapVisual() {
  const step = useLoop(3, 1800);
  return (
    <div className={`${glass} w-[300px] p-6`}>
      <div className="flex items-center justify-between text-sm text-white/50">
        <span>New order</span>
        <LogoMark size={22} />
      </div>
      <p className="mt-4 text-center text-6xl font-semibold tabular-nums tracking-tight text-white">45.00</p>
      <p className="text-center text-sm text-white/40">USDT</p>
      <div className="relative mx-auto mt-6 grid size-44 place-items-center">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid w-full grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                <span key={k} className="grid h-12 place-items-center rounded-xl bg-white/[0.06] text-lg text-white/80">
                  {k}
                </span>
              ))}
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="qr" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="size-44 rounded-3xl bg-white p-3">
              <svg viewBox="0 0 21 21" className="size-full" shapeRendering="crispEdges">
                {QR.map((row, y) => row.split("").map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0912" /> : null)))}
              </svg>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="paid" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} exit={{ opacity: 0 }} className="relative grid size-36 place-items-center rounded-full bg-emerald-500">
              <motion.span className="absolute inset-0 rounded-full border-2 border-emerald-400" animate={{ scale: [1, 1.7], opacity: [0.8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <Check className="size-16 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={`mt-6 text-center text-sm font-medium transition-colors ${step === 2 ? "text-emerald-300" : "text-white/40"}`}>{["Enter the amount", "Customer scans", "Paid in 2 seconds"][step]}</p>
    </div>
  );
}

/// A chat: the link goes out, the customer pays, the merchant is told.
function LinkVisual() {
  const step = useLoop(4, 1500);
  return (
    <div className={`${glass} w-[340px] space-y-3 p-5`}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-semibold text-white">A</span>
        <div>
          <p className="text-sm font-semibold text-white">Alex · Client</p>
          <p className="text-xs text-emerald-300/80">online</p>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: step >= 0 ? 1 : 0, x: 0 }} className="ml-auto w-[240px] overflow-hidden rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06]">
        <div className="bg-gradient-to-br from-violet-500/40 to-sky-500/30 px-4 py-4">
          <p className="text-xs text-white/70">Invoice · Website design</p>
          <p className="text-3xl font-semibold tabular-nums text-white">1,200.00</p>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="truncate text-xs text-white/50">sword.app/pay/1042</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${step >= 2 ? "bg-emerald-500 text-white" : "bg-white text-[#0a0912]"}`}>{step >= 2 ? "Paid" : "Pay"}</span>
        </div>
      </motion.div>
      <AnimatePresence>
        {step >= 1 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-fit rounded-2xl rounded-bl-md bg-white/[0.08] px-4 py-2.5 text-sm text-white/85">
            {step >= 2 ? "Done ✓" : "Paying now…"}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {step >= 3 && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-emerald-500/15 px-4 py-3">
            <Check className="size-4 text-emerald-300" />
            <span className="text-sm font-medium text-emerald-200">+1,200.00 received</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/// A plan renewing month after month.
function RenewVisual() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const step = useLoop(months.length + 1, 900);
  const paid = Math.min(step, months.length);
  return (
    <div className={`${glass} w-[360px] p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50">Pro plan</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-white">
            29.00<span className="text-base font-normal text-white/40"> / month</span>
          </p>
        </div>
        <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-200">Active</span>
      </div>
      <div className="mt-8 grid grid-cols-6 gap-2">
        {months.map((m, i) => {
          const done = i < paid;
          return (
            <div key={m} className="flex flex-col items-center gap-2">
              <motion.span
                animate={{ scale: done && i === paid - 1 ? [1, 1.2, 1] : 1, backgroundColor: done ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.05)" }}
                transition={{ duration: 0.4 }}
                className="grid size-11 place-items-center rounded-full text-white"
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-white/25" />}
              </motion.span>
              <span className="text-[11px] text-white/40">{m}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-7 flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-white/60">
          <Repeat className="size-4" /> Renewed
        </span>
        <span className="font-semibold tabular-nums text-white">{paid}×</span>
      </div>
    </div>
  );
}

/// An order being refunded: the amount slides back to the customer.
function RefundVisual() {
  const step = useLoop(3, 1700);
  return (
    <div className={`${glass} w-[340px] p-6`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/50">Order #1042</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${step === 2 ? "bg-emerald-500/20 text-emerald-200" : "bg-white/[0.06] text-white/60"}`}>{step === 2 ? "Refunded" : "Paid"}</span>
      </div>
      <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-white">80.00</p>
      <div className="mt-8 flex items-center justify-between">
        <span className="grid size-12 place-items-center rounded-full bg-white/[0.06]">
          <LogoMark size={26} />
        </span>
        <div className="relative mx-3 h-px flex-1 bg-white/10">
          {step >= 1 && (
            <motion.span initial={{ left: "0%" }} animate={{ left: "100%" }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="absolute -top-3.5 -translate-x-1/2 rounded-full bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-[#062b1f] shadow-[0_0_20px_rgba(52,211,153,0.6)]">
              32.00
            </motion.span>
          )}
        </div>
        <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-semibold text-white">A</span>
      </div>
      <motion.button
        type="button"
        animate={{ scale: step === 1 ? 0.97 : 1 }}
        className={`mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold transition-colors ${step === 2 ? "bg-emerald-500 text-white" : "bg-white text-[#0a0912]"}`}
      >
        {step === 2 ? (
          <>
            <Check className="size-4" strokeWidth={3} /> Sent back instantly
          </>
        ) : (
          <>
            <ArrowDownLeft className="size-4" /> Refund 32.00
          </>
        )}
      </motion.button>
    </div>
  );
}

/// A receipt printing out, then stamped as verified.
function ProofVisual() {
  const step = useLoop(3, 1700);
  const rows = [
    ["Paid to", "Blade & Co."],
    ["Amount", "249.00 USDT"],
    ["Fees", "0.00"],
    ["Time", "10:24:07"],
  ];
  return (
    <div className="relative">
      <div className="mx-auto h-3 w-[320px] rounded-full bg-white/10" />
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="relative mx-auto -mt-1.5 w-[290px] overflow-visible rounded-b-2xl bg-[#f6f4ff] px-6 pb-7 pt-6 text-[#15122a] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        {step === 0 && <motion.span aria-hidden initial={{ top: 0, opacity: 0.9 }} animate={{ top: "100%", opacity: 0 }} transition={{ duration: 1.5, ease: "easeInOut" }} className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-violet-400/0 via-violet-400/25 to-violet-400/0" />}
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-sm font-semibold">Receipt</span>
        </div>
        <div className="mt-5 space-y-2.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-black/10 pb-2.5">
              <span className="text-black/45">{k}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 truncate font-mono text-[11px] text-black/35">0x8de6…b3da79</p>
        <AnimatePresence>
          {step >= 1 && (
            <motion.div initial={{ scale: 2.2, opacity: 0, rotate: -25 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="absolute -right-6 bottom-14 flex items-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-white px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-emerald-600 shadow-lg">
              <BadgeCheck className="size-4" /> Verified
            </motion.div>
          )}
        </AnimatePresence>
        <span aria-hidden className="absolute inset-x-0 -bottom-2 h-3 bg-[linear-gradient(-45deg,transparent_6px,#f6f4ff_0),linear-gradient(45deg,transparent_6px,#f6f4ff_0)] bg-[length:12px_12px] bg-repeat-x" />
      </motion.div>
    </div>
  );
}

const QR = [
  "111111101011101111111",
  "100000100110001000001",
  "101110101001001011101",
  "101110100111101011101",
  "101110101100001011101",
  "100000101011101000001",
  "111111101010101111111",
  "000000001101100000000",
  "110101111011011010110",
  "011000010100110101001",
  "101111101110001110111",
  "010010010001101001010",
  "111001111010110110101",
  "000000001011001000110",
  "111111100110111010011",
  "100000101001010011100",
  "101110100111101100101",
  "101110101000011011010",
  "101110100110110100111",
  "100000101101001011001",
  "111111101011110110101",
];
