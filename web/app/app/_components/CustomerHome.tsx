"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { createPublicClient, erc20Abi, http } from "viem";
import { CHAINS } from "sword-sdk";
import { ArrowDownLeft, QrCode, Receipt, RefreshCw, RotateCcw, ScanLine, Send, ShieldCheck } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client/api";
import { publicRpcFor } from "@/lib/client/wallet";
import { cn } from "@/lib/utils";
import type { Section } from "./AppSidebar";
import type { Account } from "./Dashboard";
import { AnimatedNumber, FadeIn, IconChip, Logo, Shimmer, Stagger, StaggerItem } from "./kit";
import { useIncomingTransfers } from "./incoming";
import { useMySubscriptions, UpcomingPayments } from "./MySubscriptions";
import { ActivityTimeline, ViewAllActivity } from "./Overview";
import { QrScanner, type ScanTarget } from "./QrScanner";
import { CopyButton, errorText, notify, short } from "./shared";
import { Token } from "@/lib/client/token";

type Activity = { type: string; details: Record<string, unknown>; txHash: string | null; createdAt: string };

/// Reads the account's USDT balance straight from the chain, in base units.
async function readBalance(chainId: number, address: string): Promise<bigint> {
  const client = createPublicClient({ transport: http(publicRpcFor(chainId)) });
  return client.readContract({ address: CHAINS[chainId].addresses.usdt, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] });
}

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

/// The customer's wallet home: balance card, quick actions, and recent activity.
export function CustomerHome({ chainId, account, onSection, onPay }: { chainId: number; account: Account; onSection: (s: Section) => void; onPay: (target?: ScanTarget) => void }) {
  const [balance, setBalance] = useState<number | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [activity, setActivity] = useState<Activity[] | undefined>();
  const [receive, setReceive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const incoming = useIncomingTransfers(chainId, account.address);
  const { subs } = useMySubscriptions();

  const loadBalance = useCallback(async () => {
    setRefreshing(true);
    try {
      setBalance(Number(await readBalance(chainId, account.address)) / 1e6);
    } catch (err) {
      notify("error", errorText(err, "Could not read the balance"));
    } finally {
      setRefreshing(false);
    }
  }, [chainId, account.address]);

  useEffect(() => {
    let live = true;
    readBalance(chainId, account.address)
      .then((b) => live && setBalance(Number(b) / 1e6))
      .catch((err) => notify("error", errorText(err, "Could not read the balance")));
    api<{ activity: Activity[] }>("/api/activity")
      .then((r) => live && setActivity(r.activity))
      .catch((err) => notify("error", errorText(err, "Could not load activity")));
    return () => {
      live = false;
    };
  }, [chainId, account.address]);

  const count = (type: string) => (activity ?? []).filter((a) => a.type === type).length;
  // Platform actions plus USDT that arrived on chain, newest first.
  const feed: Activity[] | undefined = activity
    ? [
        ...activity,
        ...(incoming ?? []).map((t) => ({ type: "funds.received", details: { from: t.from, amount: t.amount }, txHash: t.hash, createdAt: t.at })),
      ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    : undefined;
  const selfCustody = account.custody === "self";

  const actions = [
    { label: "Pay", icon: Send, onClick: () => onPay(), primary: true },
    { label: "Scan", icon: ScanLine, onClick: () => setScanning(true) },
    { label: "Receive", icon: QrCode, onClick: () => setReceive(true) },
    { label: "Purchases", icon: Receipt, onClick: () => onSection("purchases") },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="grid items-start gap-6 md:grid-cols-[1.15fr_1fr]">
        <FadeIn>
          <BalanceCard balance={balance} account={account} chainId={chainId} refreshing={refreshing} onRefresh={() => void loadBalance()} />
        </FadeIn>

        <div className="space-y-5">
          <FadeIn delay={0.08}>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Quick actions</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {actions.map((a) => (
                <motion.button
                  key={a.label}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={a.onClick}
                  className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "grid size-12 place-items-center rounded-2xl border shadow-soft transition-all group-hover:shadow-lift",
                      a.primary ? "border-transparent bg-foreground text-background" : "bg-card text-foreground",
                    )}
                  >
                    <a.icon className="size-5" />
                  </span>
                  {a.label}
                </motion.button>
              ))}
            </div>
          </FadeIn>

          <Stagger className="grid grid-cols-3 gap-2" delay={0.12}>
            {[
              { label: "Payments", value: count("order.paid"), icon: Send, tone: "success" as const },
              { label: "Requests", value: count("refund.requested"), icon: RotateCcw, tone: "warning" as const },
              { label: "Received", value: incoming?.length ?? 0, icon: ArrowDownLeft, tone: "brand" as const },
            ].map((s) => (
              <StaggerItem key={s.label} className="surface-card p-3.5">
                <IconChip icon={s.icon} tone={s.tone} size="sm" />
                <div className="mt-3 text-xl font-semibold leading-none tracking-tight">
                  {activity ? <AnimatedNumber value={s.value} /> : <Shimmer className="inline-block h-5 w-8" rounded="rounded" />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
              </StaggerItem>
            ))}
          </Stagger>

          {selfCustody && (
            <FadeIn delay={0.16}>
              <button
                type="button"
                onClick={() => onSection("permission")}
                className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-soft transition-all hover:shadow-lift"
              >
                <IconChip icon={ShieldCheck} tone="brand" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Relayer permission</p>
                  <p className="text-xs text-muted-foreground">Let Sword pay for you, within a limit you set</p>
                </div>
                <span className="text-xs font-medium text-brand">Manage</span>
              </button>
            </FadeIn>
          )}
        </div>
      </div>

      <UpcomingPayments subs={subs} balance={balance} address={account.address} onViewAll={() => onSection("subscriptions")} />

      <FadeIn delay={0.2} className="surface-card">
        <div className="flex items-center justify-between p-5 pb-3 md:px-6">
          <div>
            <h3 className="text-sm font-semibold">Activity</h3>
            <p className="text-xs text-muted-foreground">Payments, refunds, and money you received</p>
          </div>
          <ViewAllActivity />
        </div>
        <ActivityTimeline activity={feed} limit={12} />
      </FadeIn>

      <ReceiveDialog open={receive} onOpenChange={setReceive} address={account.address} chainId={chainId} />
      <QrScanner open={scanning} onOpenChange={setScanning} onResult={(t) => onPay(t)} />
    </div>
  );
}

/// The balance as a card that tilts toward the pointer.
function BalanceCard({ balance, account, chainId, refreshing, onRefresh }: { balance: number | undefined; account: Account; chainId: number; refreshing: boolean; onRefresh: () => void }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 200, damping: 20 });
  const glowX = useTransform(mx, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(my, [0, 1], ["0%", "100%"]);
  const glow = useMotionTemplate`radial-gradient(420px circle at ${glowX} ${glowY}, rgb(255 255 255 / 0.18), transparent 45%)`;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        onMouseMove={onMove}
        onMouseLeave={() => {
          mx.set(0.5);
          my.set(0.5);
        }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative aspect-[1.586/1] w-full overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,oklch(0.42_0.2_280)_0%,oklch(0.32_0.16_270)_45%,oklch(0.22_0.08_260)_100%)] p-6 text-white shadow-[0_30px_60px_-20px_oklch(0.35_0.18_277/0.55),inset_0_1px_0_rgb(255_255_255/0.15)] md:p-7"
      >
        {/* Decorative light and texture. */}
        <div aria-hidden className="absolute -right-16 -top-24 size-72 rounded-full bg-[radial-gradient(circle,oklch(0.75_0.17_300/0.55),transparent_65%)] blur-2xl" />
        <div aria-hidden className="absolute -bottom-28 -left-10 size-72 rounded-full bg-[radial-gradient(circle,oklch(0.7_0.14_210/0.45),transparent_65%)] blur-2xl" />
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:26px_26px]" />
        <motion.div aria-hidden className="absolute inset-0" style={{ background: glow }} />

        <div className="relative flex h-full flex-col justify-between" style={{ transform: "translateZ(30px)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <div className="leading-tight">
                <p className="text-sm font-semibold">Sword</p>
                <p className="text-[11px] text-white/60">{account.custody === "self" ? "Self-custody" : "Custodial"} wallet</p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
              {CHAINS[chainId]?.chain.name ?? chainId}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-white/60">Available balance</p>
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh balance"
                className="grid size-6 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {balance === undefined ? (
                <span className="h-11 w-44 animate-pulse rounded-xl bg-white/15" />
              ) : (
                <AnimatedNumber value={balance} format={usd} className="text-[40px] font-semibold leading-none tracking-tight md:text-5xl" />
              )}
              <span className="text-sm font-medium text-white/70"><Token /></span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Account</p>
              <p className="truncate font-mono text-sm tracking-wide text-white/90">{short(account.address, 8, 6)}</p>
            </div>
            <CopyButton value={account.address} label="" className="h-8 rounded-full bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/// The account address as text and a QR code, for receiving USDT.
function ReceiveDialog({ open, onOpenChange, address, chainId }: { open: boolean; onOpenChange: (v: boolean) => void; address: string; chainId: number }) {
  const [qr, setQr] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(address, { margin: 1, width: 240, color: { dark: "#0b0b12", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, [open, address]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receive <Token /></DialogTitle>
          <DialogDescription>Send <Token /> on {CHAINS[chainId]?.chain.name ?? "Whitechain"} to this address only.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl border bg-white p-3 shadow-soft">
            {qr ? <Image src={qr} alt="Account address QR code" width={200} height={200} unoptimized className="rounded-xl" /> : <Shimmer className="size-[200px]" rounded="rounded-xl" />}
          </motion.div>
          <div className="w-full rounded-xl border bg-muted/40 p-3">
            <p className="break-all text-center font-mono text-xs leading-relaxed">{address}</p>
          </div>
          <CopyButton value={address} label="Copy address" className="h-9 w-full justify-center rounded-xl border bg-card" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
