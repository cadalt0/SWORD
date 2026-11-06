"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { motion } from "motion/react";
import { ArrowDownLeft, Check, RotateCcw, ShieldCheck, Store, User, Zap } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { api, DEFAULT_GOOGLE_CLIENT_ID } from "@/lib/client/api";
import { Aurora, FadeIn, Logo, Segmented, Shimmer } from "./kit";
import { errorText, notify } from "./shared";
import { TestLogin } from "./TestLogin";
import { Token } from "@/lib/client/token";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

type Role = "customer" | "merchant";

const FEATURES = [
  { icon: Zap, title: "Settles on chain", body: "Stablecoin payments, confirmed in seconds." },
  { icon: RotateCcw, title: "Refunds built in", body: "Request, approve, and pay refunds in a click." },
  { icon: ShieldCheck, title: "Your keys or ours", body: "Choose custodial, or keep full control with your wallet." },
];

/// Sign-in. Google sign-in with the client ID only; no Google account access is requested.
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [role, setRole] = useState<Role>("customer");
  const [ready, setReady] = useState(false);
  const roleRef = useRef(role);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  function start() {
    if (!window.google || !buttonRef.current || !DEFAULT_GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: DEFAULT_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await api("/api/auth/google", { credential: response.credential, role: roleRef.current });
          onSignedIn();
        } catch (err) {
          notify("error", errorText(err, "Sign-in failed"));
        }
      },
    });
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 352, text: "continue_with", shape: "pill" });
    setReady(true);
  }

  useEffect(() => {
    if (window.google) start();
    // The button is drawn once the Google script is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6">
          <Logo withText className="lg:invisible" />
          <ModeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-[380px]">
            <FadeIn>
              <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to accept payments or pay with stablecoins.</p>
            </FadeIn>

            <FadeIn delay={0.08} className="mt-8 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">I am a</p>
              <Segmented
                id="role"
                value={role}
                onChange={setRole}
                className="grid w-full grid-cols-2"
                options={[
                  { value: "customer", label: "Customer", icon: User },
                  { value: "merchant", label: "Merchant", icon: Store },
                ]}
              />
            </FadeIn>

            <FadeIn delay={0.14} className="mt-6 space-y-3">
              {!DEFAULT_GOOGLE_CLIENT_ID && <p className="text-sm text-destructive">NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.</p>}
              <div ref={buttonRef} className="flex min-h-11 justify-center" />
              {!ready && <Shimmer className="h-11" rounded="rounded-full" />}
            </FadeIn>

            <FadeIn delay={0.2} className="mt-6 space-y-6">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <TestLogin role={role} onSignedIn={onSignedIn} />
            </FadeIn>

            <p className="mt-8 text-center text-xs text-muted-foreground">We only read your name and email from Google.</p>
          </div>
        </div>
      </div>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={start} />
    </div>
  );
}

/// The left half on large screens: brand, a few product points, and floating example cards.
function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[oklch(0.16_0.03_275)] p-10 text-white lg:flex lg:flex-col">
      <Aurora />
      <div aria-hidden className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,black,transparent)]" />

      <div className="relative">
        <Logo withText size={34} />
      </div>

      <div className="relative mt-auto max-w-md space-y-8">
        <FadeIn>
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Payments that
            <br />
            <span className="bg-[linear-gradient(90deg,oklch(0.82_0.12_290),oklch(0.85_0.1_210))] bg-clip-text text-transparent">settle on chain.</span>
          </h2>
          <p className="mt-4 text-base text-white/65">Accept stablecoins, share a pay link, and handle refunds, without running any blockchain code yourself.</p>
        </FadeIn>
        <ul className="space-y-4">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={0.1 + i * 0.08} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
                <f.icon className="size-4 text-white/85" />
              </span>
              <div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-sm text-white/55">{f.body}</p>
              </div>
            </FadeIn>
          ))}
        </ul>
      </div>

      <FloatingCards />

      <p className="relative mt-10 text-xs text-white/40">Testnet · Whitechain and Arc</p>
    </div>
  );
}

function FloatingCards() {
  return (
    <div aria-hidden className="pointer-events-none absolute right-8 top-24 w-64 xl:right-14">
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={{ opacity: 1, y: [0, -8, 0], rotate: -4 }}
        transition={{ opacity: { duration: 0.6, delay: 0.3 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl"
      >
        <p className="text-[11px] text-white/50">Available balance</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">1,284.50 <span className="text-xs font-normal text-white/50"><Token /></span></p>
        <div className="mt-3 flex h-10 items-end gap-1">
          {[30, 45, 35, 60, 50, 75, 65, 90, 70, 100].map((h, i) => (
            <motion.span key={i} className="flex-1 rounded-sm bg-[linear-gradient(to_top,oklch(0.6_0.2_285/0.5),oklch(0.8_0.12_290))]" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }} />
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: [0, 6, 0] }}
        transition={{ opacity: { duration: 0.6, delay: 0.7 }, x: { duration: 0.6, delay: 0.7 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 } }}
        className="-ml-10 mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-2xl backdrop-blur-xl"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <ArrowDownLeft className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-medium">Payment received</p>
          <p className="text-[11px] text-white/50">invoice-1042 · just now</p>
        </div>
        <p className="text-sm font-semibold text-emerald-300">+25.00</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="ml-8 mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] backdrop-blur-xl"
      >
        <Check className="size-3.5 text-emerald-300" /> Refund paid on chain
      </motion.div>
    </div>
  );
}
