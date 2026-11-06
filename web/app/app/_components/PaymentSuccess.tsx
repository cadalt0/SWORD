"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck } from "lucide-react";

import { AnimatedNumber } from "./kit";
import { Token } from "@/lib/client/token";

/// hidden: nothing shown. confirming: the payment is being confirmed. success: it went through.
export type PaymentStage = "hidden" | "confirming" | "success";

const GREEN = "oklch(0.6 0.17 152)";
const GREEN_DEEP = "oklch(0.5 0.15 155)";
/// The confirming screen stays at least this long, so the hand-off to success never flickers.
const MIN_CONFIRMING_MS = 1100;

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

/// A full-screen payment confirmation, like a food or ride app: "Confirming payment", then a green success screen
/// with a check, confetti, the amount, and a receipt card. Going straight to "success" still plays the short
/// confirming step first.
export function PaymentSuccess({
  stage,
  amount,
  title = "Payment successful",
  subtitle,
  details = [],
  doneLabel = "Done",
  redirectText,
  redirectMs = 4000,
  onDone,
}: {
  stage: PaymentStage;
  /// Decimal USDT.
  amount: number;
  title?: string;
  subtitle?: string;
  details?: { label: string; value: ReactNode }[];
  doneLabel?: string;
  /// When set, there is no button: this text is shown with a progress bar, and `onDone` runs by itself after `redirectMs`.
  redirectText?: string;
  redirectMs?: number;
  onDone: () => void;
}) {
  const [shown, setShown] = useState<PaymentStage>("hidden");
  const since = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Follow the caller's stage, but always show "confirming" for a moment before "success".
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (stage === "hidden") {
      t = setTimeout(() => setShown("hidden"), 0);
    } else if (stage === "confirming") {
      t = setTimeout(() => {
        since.current = Date.now();
        setShown("confirming");
      }, 0);
    } else {
      t = setTimeout(() => {
        setShown((current) => {
          if (current === "success") return current;
          if (current !== "confirming") since.current = Date.now();
          return "confirming";
        });
        const wait = Math.max(0, MIN_CONFIRMING_MS - (Date.now() - since.current));
        t = setTimeout(() => {
          setShown("success");
          navigator.vibrate?.([30, 50, 30]);
        }, wait);
      }, 0);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [stage]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {shown !== "hidden" && (
        <motion.div
          key="payment-overlay"
          className="fixed inset-0 z-[200] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />
          <AnimatePresence mode="wait">
            {shown === "confirming" ? <Confirming key="confirming" /> : <Success key="success" amount={amount} title={title} subtitle={subtitle} details={details} doneLabel={doneLabel} redirectText={redirectText} redirectMs={redirectMs} onDone={onDone} />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/// A spinning ring and a calm message while the payment settles.
function Confirming() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.2 } }}
    >
      <div className="relative size-36">
        <motion.span className="absolute inset-0 rounded-full bg-success/10" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="6" />
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={GREEN}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="70 194"
            style={{ originX: "50%", originY: "50%" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <ShieldCheck className="size-10 text-success" />
        </div>
      </div>
      <p className="mt-8 text-xl font-semibold tracking-tight">
        Confirming payment
        <Dots />
      </p>
      <p className="mt-2 text-sm text-muted-foreground">This takes a few seconds. Please don&apos;t close this page.</p>
    </motion.div>
  );
}

function Dots() {
  return (
    <span className="inline-flex w-6">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}>
          .
        </motion.span>
      ))}
    </span>
  );
}

/// The green screen: a wave from the centre, a drawn check, ripples, confetti, the amount, and a receipt card.
function Success({
  amount,
  title,
  subtitle,
  details,
  doneLabel,
  redirectText,
  redirectMs,
  onDone,
}: {
  amount: number;
  title: string;
  subtitle?: string;
  details: { label: string; value: ReactNode }[];
  doneLabel: string;
  redirectText?: string;
  redirectMs: number;
  onDone: () => void;
}) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!redirectText) return;
    const t = setTimeout(() => done.current(), redirectMs + 1200);
    return () => clearTimeout(t);
  }, [redirectText, redirectMs]);

  return (
    <motion.div className="absolute inset-0 flex flex-col" exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      {/* The green wave that floods the screen from the centre. */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 50% 35%, ${GREEN}, ${GREEN_DEEP})` }}
        initial={{ clipPath: "circle(0% at 50% 38%)" }}
        animate={{ clipPath: "circle(150% at 50% 38%)" }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      />
      <div aria-hidden className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-6 pt-12 text-center text-white">
        <div className="relative grid size-32 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border-2 border-white/40"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 2.2], opacity: [0.8, 0] }}
              transition={{ duration: 1.6, delay: 0.55 + i * 0.35, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="relative grid size-28 place-items-center rounded-full bg-white shadow-[0_20px_50px_-10px_rgb(0_0_0/0.35)]"
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: [0, 1.15, 1], rotate: 0 }}
            transition={{ delay: 0.35, duration: 0.6, times: [0, 0.7, 1], ease: "easeOut" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-14">
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke={GREEN}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.75, duration: 0.45, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
          <Confetti />
        </div>

        <motion.p
          className="mt-10 text-2xl font-semibold tracking-tight md:text-3xl"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.45 }}
        >
          {title}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.45 }} className="mt-3 flex items-baseline gap-2">
          <AnimatedNumber value={amount} format={usd} className="text-5xl font-semibold tracking-tight md:text-6xl" />
          <span className="text-lg font-medium text-white/80"><Token /></span>
        </motion.div>
        {subtitle && (
          <motion.p className="mt-2 text-sm text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* The receipt card that slides up from the bottom. */}
      <motion.div
        className="relative mx-auto w-full max-w-md px-4 pb-6"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.15, type: "spring", stiffness: 220, damping: 24 }}
      >
        <div className="overflow-hidden rounded-3xl bg-card text-card-foreground shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45)]">
          {details.length > 0 && (
            <div className="divide-y divide-dashed px-5">
              {details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="min-w-0 truncate text-right font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 pt-3">
            {redirectText ? (
              <div className="space-y-2.5 py-1.5 text-center">
                <p className="text-sm font-medium text-muted-foreground">{redirectText}</p>
                <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: GREEN }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 1.2, duration: redirectMs / 1000, ease: "linear" }}
                  />
                </div>
              </div>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onDone}
                className="h-12 w-full rounded-2xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_oklch(0.5_0.15_155/0.8)]"
                style={{ background: GREEN }}
              >
                {doneLabel}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/// A one-time burst of confetti out of the check.
function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {pieces.map((i) => {
        const angle = (i / pieces.length) * Math.PI * 2 + (i % 3) * 0.2;
        const distance = 110 + (i % 5) * 28;
        const colors = ["#ffffff", "#fde68a", "#a7f3d0", "#fbcfe8", "#bfdbfe"];
        const round = i % 3 === 0;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: round ? 8 : 6, height: round ? 8 : 12, borderRadius: round ? 999 : 2, background: colors[i % colors.length], marginLeft: -3, marginTop: -6 }}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: [0, Math.sin(angle) * distance, Math.sin(angle) * distance + 70],
              opacity: [0, 1, 0],
              rotate: 240 + i * 25,
              scale: 1,
            }}
            transition={{ delay: 0.8, duration: 1.5, ease: "easeOut", times: [0, 0.45, 1] }}
          />
        );
      })}
    </div>
  );
}
