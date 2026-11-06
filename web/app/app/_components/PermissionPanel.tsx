"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { grantFromJson, mandateFromJson, ownerSdk } from "@/lib/client/wallet";
import { toJson } from "@/lib/shared/json";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { FadeIn, IconChip, PageHeader, Shimmer, Spinner } from "./kit";
import { errorText, notify, usdt } from "./shared";
import { Token } from "@/lib/client/token";

type Status = {
  grantActive: boolean;
  grant?: { maxAmount: string; expiry: string };
  grantUsed: string;
};

/// The relayer's permission for a self-custody account. The owner signs once, in the wallet.
/// `onChanged` runs after a permission is signed or removed, so the dashboard picks up how the account signs now.
export function PermissionPanel({ chainId, account, wallet, onChanged }: { chainId: number; account: Account; wallet: Address | undefined; onChanged?: () => Promise<void> | void }) {
  const [status, setStatus] = useState<Status | undefined>();
  const [maxAmount, setMaxAmount] = useState("100");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [now] = useState(() => Date.now());

  async function refresh() {
    try {
      setStatus(await api<Status>(`/api/permission?chainId=${chainId}`));
    } catch (err) {
      notify("error", errorText(err, "Could not read the permission"));
    }
  }

  useEffect(() => {
    if (account.custody === "self") void refresh();
    // refresh when the account or chain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.address, chainId]);

  async function grant() {
    setBusy(true);
    try {
      if (!wallet) throw new Error("Connect your wallet first");
      const request = await api<Record<string, unknown>>("/api/permission", { action: "prepare", chainId, maxAmount, validForDays: Number(days) });
      const sdk = ownerSdk(chainId, wallet);
      // A wallet merchant signs a permission on its order book; a smart account signs a grant on itself.
      const signed = account.eoa
        ? await sdk.permission.sign(mandateFromJson(request))
        : await sdk.accounts.signGrant(grantFromJson(request as Parameters<typeof grantFromJson>[0]));
      await api("/api/permission", { action: "submit", chainId, signed: toJson(signed) });
      notify("success", "Permission granted");
      await refresh();
      await onChanged?.();
    } catch (err) {
      notify("error", errorText(err, "Could not grant the permission"));
    } finally {
      setBusy(false);
    }
  }

  /// The owner's wallet removes the permission on chain; then the server switches the account to wallet signing.
  async function remove() {
    setRemoving(true);
    try {
      if (!wallet) throw new Error("Connect your wallet first");
      const sdk = ownerSdk(chainId, wallet);
      const tx = account.eoa ? await sdk.permission.revoke() : await sdk.accounts.revokeGrant(account.address);
      await api("/api/permission", { action: "revoked", chainId, txHash: tx.hash });
      notify("success", "Permission removed. Your wallet now signs every action.");
      setConfirmRemove(false);
      await refresh();
      await onChanged?.();
    } catch (err) {
      notify("error", errorText(err, "Could not remove the permission"));
    } finally {
      setRemoving(false);
    }
  }

  const active = status?.grantActive ?? false;
  const limit = status?.grant ? Number(status.grant.maxAmount) : 0;
  const used = status ? Number(status.grantUsed) : 0;
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const expiry = status?.grant ? new Date(Number(status.grant.expiry) * 1000) : undefined;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - now) / 86_400_000)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Relayer permission" description="Let Sword's relayer act for you, only within a limit and a period you sign. You can sign a new one at any time." />

      <div className="grid gap-4 lg:grid-cols-5">
        <FadeIn delay={0.05} className="surface-card p-5 md:p-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconChip icon={active ? ShieldCheck : ShieldOff} tone={active ? "success" : "neutral"} />
              <div>
                <p className="text-sm font-semibold">Current permission</p>
                <p className="text-xs text-muted-foreground">Read from your account on chain</p>
              </div>
            </div>
            {status ? (
              <span className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset", active ? "bg-success/10 text-success ring-success/20" : "bg-muted text-muted-foreground ring-border")}>
                {active ? "Active" : "Not active"}
              </span>
            ) : (
              <Shimmer className="h-6 w-20" rounded="rounded-full" />
            )}
          </div>

          {status?.grant ? (
            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
              <Gauge percent={percent} />
              <div className="w-full flex-1 space-y-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Used</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {usdt(status.grantUsed)} <span className="text-sm font-normal text-muted-foreground">of {usdt(status.grant.maxAmount)} <Token /></span>
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="text-sm font-medium">
                      {expiry?.toLocaleDateString(undefined, { dateStyle: "medium" })} <span className="font-normal text-muted-foreground">· {daysLeft} days left</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No permission yet. Set a limit and sign it in your wallet.</p>
          )}

          {active && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Removing it stops the relayer at once. Your wallet then signs every action.</p>
              <Button variant="destructive" className="h-10 shrink-0 rounded-xl" onClick={() => setConfirmRemove(true)} disabled={!wallet || removing}>
                <Trash2 className="size-4" />
                {wallet ? "Remove permission" : "Connect wallet to remove"}
              </Button>
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.1} className="surface-card flex flex-col lg:col-span-2">
          <div className="border-b p-5 md:px-6">
            <p className="text-sm font-semibold">New permission</p>
            <p className="text-xs text-muted-foreground">Your wallet asks you to sign. Nothing is spent by signing.</p>
          </div>
          <div className="flex-1 space-y-4 p-5 md:px-6">
            <div className="space-y-2">
              <Label htmlFor="limit">Spending limit</Label>
              <div className="relative">
                <Input id="limit" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"><Token /></span>
              </div>
              <Presets values={["50", "100", "250", "500"]} value={maxAmount} onPick={setMaxAmount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Period</Label>
              <div className="relative">
                <Input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="h-11 rounded-xl pr-16 tabular-nums" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span>
              </div>
              <Presets values={["7", "14", "30"]} value={days} onPick={setDays} suffix="d" />
            </div>
          </div>
          <div className="p-5 pt-0 md:px-6">
            <Button className="h-11 w-full rounded-xl" onClick={grant} disabled={busy || !wallet}>
              {busy && <Spinner />}
              {busy ? "Waiting for wallet…" : wallet ? "Sign permission" : "Connect wallet to sign"}
            </Button>
          </div>
        </FadeIn>
      </div>

      <Dialog open={confirmRemove} onOpenChange={(open) => !removing && setConfirmRemove(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove the relayer permission?</DialogTitle>
            <DialogDescription>
              Sword&apos;s relayer will no longer act for this account. From now on your wallet signs every action, and pays its gas.
              You can sign a new permission at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setConfirmRemove(false)} disabled={removing}>
              Keep it
            </Button>
            <Button variant="destructive" className="h-10 rounded-xl" onClick={remove} disabled={removing}>
              {removing && <Spinner />}
              {removing ? "Confirm in your wallet…" : "Remove permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Presets({ values, value, onPick, suffix = "" }: { values: string[]; value: string; onPick: (v: string) => void; suffix?: string }) {
  return (
    <div className="flex gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors", value === v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")}
        >
          {v}
          {suffix}
        </button>
      ))}
    </div>
  );
}

/// A ring that fills with how much of the limit has been used.
function Gauge({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(percent)}%</p>
          <p className="text-[11px] text-muted-foreground">used</p>
        </div>
      </div>
    </div>
  );
}
