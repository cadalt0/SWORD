"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Circle, Info, RotateCcw, Server, ShieldCheck, Wallet, XCircle } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { connectWallet, grantFromJson, hasMetaMask, mandateFromJson, ownerSdk } from "@/lib/client/wallet";
import { toJson } from "@/lib/shared/json";
import { cn } from "@/lib/utils";
import { CHAINS, supportedChainIds } from "sword-sdk";

import { Aurora, Logo, Spinner, SuccessMark } from "./kit";
import { errorText, notify, short } from "./shared";
import { Token } from "@/lib/client/token";

/// custodial: we run a smart account. manual: your wallet signs every action. signless: your wallet signs one permission.
type Mode = "custodial" | "manual" | "signless";
type Branch = "custodial" | "nonCustodial";
type Status = {
  ready: boolean;
  hasAccount: boolean;
  accountAddress?: string;
  signing?: "relayer" | "manual" | "signless" | null;
  registered: boolean;
  grantActive: boolean;
  /// The chain the account is on, once there is one.
  chainId?: number;
  /// For a self-custody account: the wallet that signs for it.
  ownerAddress?: string | null;
};
type StepId = "wallet" | "account" | "register" | "grant";
type StepState = "todo" | "active" | "done" | "failed";
type Step = { id: StepId; label: string; hint: string; state: StepState; message?: string };
type Phase = "choose" | "how" | "review" | "run" | "done";

const INFO = {
  custodial: {
    title: "Custodial",
    line: "We run your account. You don’t sign anything.",
    details: [
      "We create and run a smart account for your merchant business.",
      "No wallet is needed for each action. Our relayer sends every transaction.",
      "Setup: we create the account and register your merchant for you.",
    ],
    trade: "Your funds are managed by Sword. Choose this only if you trust us to run the account.",
    icon: Server,
  },
  nonCustodial: {
    title: "Non-custodial",
    line: "Your own wallet owns the account. You keep control of your funds.",
    details: [
      "Your wallet owns the account and keeps control of your funds.",
      "Next you choose how the relayer may help you.",
    ],
    trade: "You stay in control of your funds at all times.",
    icon: Wallet,
  },
  signless: {
    title: "Give permission to the relayer",
    line: "Sign one permission. The relayer then runs orders and refunds for you.",
    details: [
      "Your wallet signs one permission: a spending limit and a period.",
      "The relayer then creates orders, confirms payments, and handles refunds within that limit.",
      "You can revoke the permission at any time.",
    ],
    trade: "The relayer can move funds only up to the limit you set, and only until the period ends.",
    icon: ShieldCheck,
  },
  manual: {
    title: "Do everything myself",
    line: "Your wallet signs every action.",
    details: [
      "Your wallet is the merchant and signs each action: orders, withdrawals, and refunds.",
      "The relayer never acts for you.",
    ],
    trade: "Maximum control. Expect a wallet confirmation for every action.",
    icon: Wallet,
  },
} as const;

const PHASES: { id: Phase; label: string }[] = [
  { id: "choose", label: "Management" },
  { id: "run", label: "Setup" },
  { id: "done", label: "Ready" },
];

/// Mode a stored account was created with, read back for resuming setup.
function modeOf(signing: Status["signing"]): Mode {
  if (signing === "signless") return "signless";
  if (signing === "manual") return "manual";
  return "custodial";
}

/// The steps still needed for this mode, given what is already done.
function planFor(mode: Mode, status: Status, role: "customer" | "merchant"): Step[] {
  const custodial = mode === "custodial";
  const needsWallet = !custodial && (!status.hasAccount || !status.registered || (mode === "signless" && !status.grantActive));
  const plan: Step[] = [];
  if (needsWallet) plan.push({ id: "wallet", label: "Connect your wallet", hint: "The wallet that is your merchant", state: "todo" });
  if (!status.hasAccount) {
    plan.push({
      id: "account",
      label: custodial ? "Create your smart account" : role === "merchant" ? "Set up your merchant wallet" : "Create your account",
      hint: custodial ? "Your account, run by us" : "Your wallet owns the account",
      state: "todo",
    });
  }
  if (role === "merchant" && !status.registered) plan.push({ id: "register", label: "Register your merchant", hint: "Creates your order book on chain, once", state: "todo" });
  if (mode === "signless" && !status.grantActive) plan.push({ id: "grant", label: "Sign your permission", hint: "One signature in your wallet", state: "todo" });
  return plan;
}

/// Merchant setup. Shown until the merchant is ready. Asks each detail, then runs the steps in order.
export function AccountOnboarding({
  role,
  chainId,
  onChainChange,
  status,
  onReady,
  onSignOut,
}: {
  role: "customer" | "merchant";
  chainId: number;
  /// Picks the network for a new account. Not offered once the account exists: an account lives on one chain.
  onChainChange: (chainId: number) => void;
  status: Status;
  onReady: (wallet: Address | undefined) => Promise<void>;
  onSignOut: () => void;
}) {
  const resuming = status.hasAccount;
  const [phase, setPhase] = useState<Phase>(resuming ? "run" : "choose");
  const [branch, setBranch] = useState<Branch | undefined>(resuming ? (modeOf(status.signing) === "custodial" ? "custodial" : "nonCustodial") : undefined);
  const [mode, setMode] = useState<Mode | undefined>(resuming ? modeOf(status.signing) : undefined);
  const [info, setInfo] = useState<keyof typeof INFO | undefined>();
  const [limit, setLimit] = useState("100");
  const [days, setDays] = useState("30");
  const [wallet, setWallet] = useState<Address | undefined>();
  const [stalled, setStalled] = useState(false);
  const [steps, setSteps] = useState<Step[]>(() => (resuming ? planFor(modeOf(status.signing), status, role) : []));
  const [running, setRunning] = useState(false);
  const [account, setAccount] = useState<Address | undefined>(status.accountAddress as Address | undefined);

  const phaseIndex = phase === "how" ? 0 : PHASES.findIndex((p) => p.id === phase);

  function setStepState(id: StepId, state: StepState, message?: string) {
    setSteps((list) => list.map((s) => (s.id === id ? { ...s, state, message } : s)));
  }

  /// Runs the steps one after another. A failed step stops the run and can be retried.
  /// The mode is passed in, so a run can start in the same click that chose it.
  async function run(m: Mode | undefined = mode) {
    if (!m) return;
    setMode(m);
    const todo = planFor(m, status, role);
    setSteps(todo);
    setPhase("run");
    setRunning(true);

    const custodial = m === "custodial";
    let owner: Address | undefined = wallet;
    let created: Address | undefined = account;
    let current: StepId = todo[0]?.id ?? "account";
    try {
      for (const step of todo) {
        current = step.id;
        setStepState(step.id, "active");

        if (step.id === "wallet") {
          // With a saved account, ask the wallet again each time, so switching accounts in the wallet is picked up.
          owner = status.ownerAddress ? await connectWallet(chainId) : (wallet ?? (await connectWallet(chainId)));
          // A saved self-custody account can only be signed for by its own wallet.
          if (status.ownerAddress && owner.toLowerCase() !== status.ownerAddress.toLowerCase()) {
            throw new Error(`This account belongs to the wallet ${short(status.ownerAddress, 6, 4)}, but your wallet is on ${short(owner, 6, 4)}. Switch your wallet to ${short(status.ownerAddress, 6, 4)}, then press Try again.`);
          }
          setWallet(owner);
        }

        if (step.id === "account") {
          const res = await api<{ account: string }>("/api/accounts", {
            chainId,
            signing: custodial ? "relayer" : m,
            custody: custodial ? "custodial" : "self",
            ownerAddress: owner,
          });
          created = res.account as Address;
          setAccount(created);
        }

        if (step.id === "register") {
          if (!created) throw new Error("The account was not created");
          try {
            if (custodial) {
              await api("/api/merchant/register", { chainId });
            } else {
              if (!owner) throw new Error("Connect your wallet first");
              await ownerSdk(chainId, owner).merchant.register();
            }
          } catch (err) {
            // Already registered means this step is done, so setup carries on and the dashboard opens.
            if (!/already\s*registered|ALREADY_REGISTERED/i.test(errorText(err, ""))) throw err;
          }
        }

        if (step.id === "grant") {
          if (!owner || !created) throw new Error("Connect your wallet first");
          const request = await api<Record<string, unknown>>("/api/permission", { action: "prepare", chainId, maxAmount: limit, validForDays: Number(days) });
          const sdk = ownerSdk(chainId, owner);
          if (role === "merchant") {
            // Wallet merchant: the wallet signs a mandate for the book.
            const signed = await sdk.permission.sign(mandateFromJson(request));
            await api("/api/permission", { action: "submit", chainId, signed: toJson(signed) });
          } else {
            // Customer: the wallet signs a grant for the smart account.
            const signed = await sdk.accounts.signGrant(grantFromJson(request as Parameters<typeof grantFromJson>[0]));
            await api("/api/permission", { action: "submit", chainId, signed: toJson(signed) });
          }
        }

        setStepState(step.id, "done");
      }
      setRunning(false);
      setPhase("done");
    } catch (err) {
      const message = errorText(err, "Something went wrong");
      notify("error", message);
      setStepState(current, "failed", message);
      setRunning(false);
    }
  }

  const stepIndex = phaseIndex;

  // A returning user with an unfinished setup continues straight away.
  useEffect(() => {
    if (!resuming) return;
    const t = setTimeout(() => void run(modeOf(status.signing)), 300);
    return () => clearTimeout(t);
    // only once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once ready, show the success for a moment, then open the dashboard. No extra click.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => {
      // If the dashboard doesn't open (the readiness check still says setup is unfinished), say so and offer a retry.
      void onReady(wallet).then(() => setTimeout(() => setStalled(true), 2500));
    }, 1600);
    return () => clearTimeout(t);
    // only when the phase becomes done
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress = steps.length ? (doneCount / steps.length) * 100 : 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-[340px_1fr]">
      <aside className="relative flex flex-col gap-10 overflow-hidden border-b bg-[oklch(0.16_0.03_275)] p-6 text-white lg:border-b-0 lg:p-8">
        <Aurora />
        <div className="relative">
          <Logo withText size={32} />
        </div>
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/50">{role === "merchant" ? "Merchant setup" : "Account setup"}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight">{role === "merchant" ? "Get ready to accept payments" : "Get ready to pay with stablecoins"}</p>
        </div>
        <ol className="relative hidden space-y-0 lg:block">
          {PHASES.map((p, i) => {
            const done = i < stepIndex || phase === "done";
            const current = i === stepIndex && phase !== "done";
            return (
              <li key={p.id} className="relative flex gap-4 pb-8 last:pb-0">
                {i < PHASES.length - 1 && (
                  <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-white/10">
                    <motion.span className="absolute inset-x-0 top-0 bg-white/70" initial={false} animate={{ height: done ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
                  </span>
                )}
                <motion.span
                  initial={false}
                  animate={{ scale: current ? 1.08 : 1 }}
                  className={cn(
                    "relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                    done && "border-white bg-white text-[oklch(0.16_0.03_275)]",
                    current && "border-white text-white shadow-[0_0_0_4px_rgb(255_255_255/0.12)]",
                    !done && !current && "border-white/20 text-white/40",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </motion.span>
                <div className="pt-1">
                  <p className={cn("text-sm font-medium", !done && !current && "text-white/45")}>{p.label}</p>
                  <p className="text-xs text-white/45">{PHASE_HINTS[p.id]}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="relative mt-auto flex items-center justify-between text-xs text-white/60">
          <ModeToggle className="text-white/70 hover:bg-white/10 hover:text-white" />
          <button type="button" className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="relative flex items-start justify-center overflow-hidden p-6 md:p-12">
        <div aria-hidden className="absolute inset-x-0 top-0 h-80 bg-dots" />
        <div className="relative w-full max-w-2xl">
          <div className="mb-8 h-1 overflow-hidden rounded-full bg-muted lg:hidden">
            <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: `${((phase === "done" ? PHASES.length : stepIndex + 1) / PHASES.length) * 100}%` }} />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={phase} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="space-y-6">
              {phase === "choose" && (
                <>
                  <Heading title="How will you manage your account?" subtitle="Pick one. Open Details to see exactly what it means." />
                  <NetworkChoice chainId={chainId} onChange={onChainChange} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["custodial", "nonCustodial"] as Branch[]).map((b, idx) => {
                      const i = b === "custodial" ? INFO.custodial : INFO.nonCustodial;
                      return (
                        <Choice key={b} index={idx} icon={i.icon} title={i.title} line={i.line} badge={b === "custodial" ? "Easiest" : "Most control"} selected={branch === b} onSelect={() => { setBranch(b); setMode(b === "custodial" ? "custodial" : undefined); }} onDetails={() => setInfo(b === "custodial" ? "custodial" : "nonCustodial")} />
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button size="lg" className="h-11 rounded-full px-6" disabled={!branch} onClick={() => (branch === "custodial" ? void run("custodial") : setPhase("how"))}>
                      Continue <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </>
              )}

              {phase === "how" && (
                <>
                  <Heading title="How should the relayer work with you?" subtitle="Your wallet stays in control either way." />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["signless", "manual"] as const).map((m, idx) => {
                      const i = INFO[m];
                      return <Choice key={m} index={idx} icon={i.icon} title={i.title} line={i.line} badge={m === "signless" ? "Recommended" : undefined} selected={mode === m} onSelect={() => setMode(m)} onDetails={() => setInfo(m)} />;
                    })}
                  </div>
                  <AnimatePresence initial={false}>
                    {mode === "signless" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="surface-card p-5 md:p-6">
                          <p className="text-sm font-semibold">Your permission</p>
                          <p className="text-xs text-muted-foreground">The relayer can move at most this much, for this long. You sign it in your wallet.</p>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="limit">Limit</Label>
                              <div className="relative">
                                <Input id="limit" inputMode="decimal" className="h-11 rounded-xl pr-16 tabular-nums" value={limit} onChange={(e) => setLimit(e.target.value)} />
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="days">Period (1 to 31)</Label>
                              <div className="relative">
                                <Input id="days" inputMode="numeric" className="h-11 rounded-xl pr-16 tabular-nums" value={days} onChange={(e) => setDays(e.target.value)} />
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!hasMetaMask() && (
                    <p className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm">Install the MetaMask extension first. Your wallet signs during setup.</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" className="rounded-full" onClick={() => setPhase("choose")}>
                      <ArrowLeft className="size-4" /> Back
                    </Button>
                    <Button size="lg" className="h-11 rounded-full px-6" disabled={!mode || running} onClick={() => void run(mode)}>
                      {mode === "signless" ? "Connect wallet and sign" : "Connect wallet and start"} <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </>
              )}

              {phase === "run" && (
                <>
                  <Heading title="Setting things up" subtitle="Keep this page open. Approve each wallet request as it appears." />
                  <div className="surface-card overflow-hidden">
                    <div className="h-1 bg-muted">
                      <motion.div className="h-full bg-brand" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                    </div>
                    <ol className="space-y-1 p-3 md:p-4">
                      {steps.map((s) => (
                        <motion.li
                          key={s.id}
                          layout
                          className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors", s.state === "active" && "bg-brand/6", s.state === "failed" && "bg-destructive/6")}
                        >
                          <span className="mt-0.5 grid size-6 place-items-center">
                            {s.state === "done" ? (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-6 place-items-center rounded-full bg-success text-white">
                                <Check className="size-3.5" />
                              </motion.span>
                            ) : s.state === "active" ? (
                              <Spinner className="size-5 text-brand" />
                            ) : s.state === "failed" ? (
                              <XCircle className="size-5 text-destructive" />
                            ) : (
                              <Circle className="size-5 text-muted-foreground/40" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium", s.state === "todo" && "text-muted-foreground")}>{s.label}</p>
                            <p className="text-xs text-muted-foreground">{s.state === "active" ? <span className="shimmer-text">{s.hint}</span> : s.hint}</p>
                            {s.message && <p className="mt-1 text-xs text-destructive">{s.message}</p>}
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                    {steps.some((s) => s.state === "failed") && (
                      <div className="flex justify-end border-t bg-muted/30 p-3">
                        <Button className="rounded-full" onClick={() => void run()} disabled={running}>
                          <RotateCcw className="size-4" /> Try again
                        </Button>
                      </div>
                    )}
                  </div>
                  {account && <p className="font-mono text-xs text-muted-foreground">{role === "merchant" ? "Merchant ID" : "Account"} {short(account, 10, 6)}</p>}
                </>
              )}

              {phase === "done" && (
                <div className="surface-card relative overflow-hidden px-6 py-12 text-center">
                  <Confetti />
                  <SuccessMark size={72} />
                  <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your {role === "merchant" ? "merchant " : ""}account is ready</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "custodial" ? "We run it for you." : mode === "signless" ? "The relayer acts within your permission." : "Your wallet signs each action."}
                  </p>
                  {account && (
                    <div className="mt-5 flex justify-center">
                      <p className="rounded-full border bg-muted/40 px-3 py-1.5 font-mono text-xs">{short(account, 10, 6)}</p>
                    </div>
                  )}
                  {stalled ? (
                    <div className="mt-8 space-y-3">
                      <p className="text-sm text-muted-foreground">Setup isn&apos;t finished yet. Let&apos;s run it once more.</p>
                      <Button
                        className="rounded-full"
                        onClick={() => {
                          setStalled(false);
                          void run();
                        }}
                      >
                        <RotateCcw className="size-4" /> Try again
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-8 flex items-center justify-center gap-2 text-sm">
                      <Spinner className="text-muted-foreground" />
                      <span className="shimmer-text font-medium">Opening your {role === "merchant" ? "dashboard" : "wallet"}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <InfoDialog info={info} onClose={() => setInfo(undefined)} />
    </div>
  );
}

const PHASE_HINTS: Record<Phase, string> = {
  choose: "Custodial or your own wallet",
  how: "How the relayer helps",
  review: "Check before anything runs",
  run: "Create, register, sign",
  done: "Open your workspace",
};

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/// A short burst of coloured pieces behind the success message.
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {pieces.map((i) => {
        const left = 10 + ((i * 47) % 80);
        const hue = [277, 158, 70, 240, 320][i % 5];
        return (
          <motion.span
            key={i}
            className="absolute top-1/3 size-2 rounded-[2px]"
            style={{ left: `${left}%`, background: `oklch(0.72 0.17 ${hue})` }}
            initial={{ y: 0, opacity: 0, rotate: 0 }}
            animate={{ y: [0, -90 - (i % 4) * 20, 160], opacity: [0, 1, 0], rotate: 180 + i * 30 }}
            transition={{ duration: 1.8, delay: 0.2 + (i % 6) * 0.05, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

/// Turns the prepared mandate JSON from the server back into the values the wallet signs.
function Choice({ icon: Icon, title, line, badge, index, selected, onSelect, onDetails }: { icon: typeof Server; title: string; line: string; badge?: string; index: number; selected: boolean; onSelect: () => void; onDetails: () => void }) {
  return (
    <motion.div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-soft outline-none transition-[box-shadow,border-color] hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-brand shadow-[0_0_0_1px_var(--brand),0_16px_40px_-16px_color-mix(in_oklab,var(--brand)_45%,transparent)]",
      )}
    >
      {selected && <motion.div layoutId="choice-glow" aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent)]" />}
      <div className="relative flex items-start justify-between">
        <span className={cn("grid size-11 place-items-center rounded-2xl transition-colors", selected ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
          <Icon className="size-5" />
        </span>
        <span className={cn("grid size-6 place-items-center rounded-full border-2 transition-colors", selected ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/30")} aria-hidden>
          <AnimatePresence>
            {selected && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <div className="relative mt-5 flex items-center gap-2">
        <p className="text-base font-semibold">{title}</p>
        {badge && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{badge}</span>}
      </div>
      <p className="relative mt-1 text-sm text-muted-foreground">{line}</p>
      <div className="relative mt-auto pt-5">
        <Button variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onDetails(); }}>
          <Info className="size-3.5" /> Details
        </Button>
      </div>
    </motion.div>
  );
}

function InfoDialog({ info, onClose }: { info: keyof typeof INFO | undefined; onClose: () => void }) {
  const item = info ? INFO[info] : undefined;
  return (
    <Dialog open={item !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {item && (
          <>
            <DialogHeader>
              <span className="mb-2 grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
                <item.icon className="size-5" />
              </span>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>{item.line}</DialogDescription>
            </DialogHeader>
            <ul className="space-y-2.5 text-sm">
              {item.details.map((d) => (
                <li key={d} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{item.trade}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/// Which network the new account is created on. Each network uses its own stablecoin (USDT on Whitechain, USDC on Arc).
function NetworkChoice({ chainId, onChange }: { chainId: number; onChange: (id: number) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Network</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {supportedChainIds().map((id) => {
          const entry = CHAINS[id]!;
          const on = id === chainId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn("flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors", on ? "border-foreground/40 bg-muted/50" : "hover:bg-muted/30")}
            >
              <span>
                <span className="block text-sm font-medium">{entry.chain.name}</span>
                <span className="block text-xs text-muted-foreground">Payments in {entry.token.symbol}</span>
              </span>
              <span className={cn("grid size-5 place-items-center rounded-full border", on && "border-foreground bg-foreground text-background")}>{on && <Check className="size-3" />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
