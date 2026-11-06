"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Check,
  CircleDot,
  Copy,
  FilePlus2,
  Landmark,
  Repeat,
  RotateCcw,
  Sparkles,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/// Shortens an address or hash for display: 0x1234…abcd.
export function short(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 2 ? `${value.slice(0, head + 2)}…${value.slice(-tail)}` : value;
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/// Shows a success or error message as a toast.
export function notify(kind: "success" | "error", message: string) {
  if (kind === "success") toast.success(message);
  else toast.error(message);
}

/// Formats a base-unit USDT amount (6 decimals) for display.
export function usdt(baseUnits: string | bigint): string {
  const value = Number(baseUnits) / 1e6;
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/// A number as a plain decimal USDT string for inputs: up to 6 decimals, no trailing zeros ("0.001", "10.5").
export function decimal(n: number): string {
  return Number(n.toFixed(6)).toString();
}

/// Formats a decimal USDT amount (as stored with orders, e.g. "10.000000") for display.
export function money(decimal: string | number): string {
  return Number(decimal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/// "2m ago", "3h ago", "Yesterday", or a date.
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172_800) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type StatusStyle = { label: string; dot: string; pill: string; pulse?: boolean };

const STATUS: Record<string, StatusStyle> = {
  pending: { label: "Pending", dot: "bg-info", pill: "bg-info/10 text-info ring-info/20", pulse: true },
  open: { label: "Pending", dot: "bg-info", pill: "bg-info/10 text-info ring-info/20", pulse: true },
  expired: { label: "Expired", dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground ring-border" },
  paid: { label: "Paid", dot: "bg-success", pill: "bg-success/10 text-success ring-success/20" },
  partially_refunded: { label: "Partly refunded", dot: "bg-warning", pill: "bg-warning/12 text-warning ring-warning/25" },
  refunded: { label: "Refunded", dot: "bg-brand", pill: "bg-brand/10 text-brand ring-brand/20" },
  failed: { label: "Failed", dot: "bg-destructive", pill: "bg-destructive/10 text-destructive ring-destructive/20" },
  closed: { label: "Closed", dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground ring-border" },
  awaiting: { label: "Awaiting customer", dot: "bg-info", pill: "bg-info/10 text-info ring-info/20", pulse: true },
  active: { label: "Active", dot: "bg-success", pill: "bg-success/10 text-success ring-success/20", pulse: true },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground ring-border" },
  completed: { label: "Completed", dot: "bg-brand", pill: "bg-brand/10 text-brand ring-brand/20" },
};

/// An order status as a pill with a coloured dot. Pending orders pulse.
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS[status] ?? { label: status, dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground ring-border" };
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", style.pill, className)}>
      <span className="relative flex size-1.5">
        {style.pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", style.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", style.dot)} />
      </span>
      {style.label}
    </span>
  );
}

/// Copies a value, with an animated check once it is copied.
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground", className)}
      aria-label={label || "Copy"}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "y" : "n"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {label && (copied ? "Copied" : label)}
    </Button>
  );
}

/// How each kind of recorded activity is shown: its label, icon, and tone.
export const ACTIVITY: Record<string, { label: string; icon: LucideIcon; tone: "brand" | "success" | "warning" | "info" | "neutral" | "destructive" }> = {
  "account.created": { label: "Account created", icon: Sparkles, tone: "brand" },
  "merchant.registered": { label: "Merchant registered", icon: BadgeCheck, tone: "brand" },
  "permission.revoked": { label: "Permission removed", icon: Ban, tone: "neutral" },
  "order.created": { label: "Order created", icon: FilePlus2, tone: "info" },
  "order.paid": { label: "Payment sent", icon: ArrowUpRight, tone: "success" },
  "order.withdrawn": { label: "Funds withdrawn", icon: Landmark, tone: "neutral" },
  "refund.requested": { label: "Refund requested", icon: RotateCcw, tone: "warning" },
  "refund.approved": { label: "Refund approved", icon: ThumbsUp, tone: "info" },
  "refund.denied": { label: "Refund denied", icon: Ban, tone: "destructive" },
  "refund.paid": { label: "Refund paid", icon: ArrowDownLeft, tone: "success" },
  "funds.sent": { label: "Sent funds", icon: ArrowUpRight, tone: "neutral" },
  "fiat.withdrawn": { label: "Cashed out", icon: Landmark, tone: "success" },
  "funds.received": { label: "Received funds", icon: ArrowDownLeft, tone: "success" },
  "plan.created": { label: "Plan created", icon: Repeat, tone: "brand" },
  "subscription.created": { label: "Subscription created", icon: Repeat, tone: "info" },
  "subscription.subscribed": { label: "Subscribed", icon: Repeat, tone: "brand" },
  "subscription.refunded": { label: "Subscription refunded", icon: ArrowDownLeft, tone: "warning" },
  "subscription.withdrawn": { label: "Subscription withdrawn", icon: Landmark, tone: "neutral" },
  "subscription.refund_denied": { label: "Subscription refund denied", icon: Ban, tone: "destructive" },
  "subscription.started": { label: "New subscriber", icon: Repeat, tone: "success" },
  "subscription.charged": { label: "Subscription payment", icon: ArrowDownLeft, tone: "success" },
  "subscription.cancelled": { label: "Subscription cancelled", icon: Ban, tone: "neutral" },
};

/// The one-line context under an activity entry: the plan, the payment number, the other party, or the order.
export function activitySubtitle(a: { type: string; details: Record<string, unknown>; txHash: string | null }): string {
  const d = a.details;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const title = s(d.plan) ?? (a.type.startsWith("subscription.") ? s(d.name) : undefined);
  if (a.type === "subscription.charged" && typeof d.period === "number") {
    return `${title ? `${title} · ` : ""}Payment ${d.period}${typeof d.periods === "number" ? ` of ${d.periods}` : ""}`;
  }
  if (title) return `${title}${s(d.subscriber) ? ` · ${short(String(d.subscriber), 6, 4)}` : ""}`;
  if (a.type === "fiat.withdrawn" && s(d.label)) return `${d.label} to ${s(d.bank) ?? "bank"}${s(d.last4) ? ` ••${d.last4}` : ""}`;
  if (d.via === "bank" && s(d.currency)) return `Bank transfer${s(d.orderId) ? ` · Order ${short(String(d.orderId), 6, 4)}` : ""}`;
  if (s(d.from)) return `From ${short(String(d.from), 6, 4)}`;
  if (s(d.to)) return `To ${short(String(d.to), 6, 4)}`;
  if (s(d.orderId)) return `Order ${short(String(d.orderId), 6, 4)}`;
  if (s(d.subscriptionId)) return `Subscription ${short(String(d.subscriptionId), 6, 4)}`;
  if (s(d.name)) return String(d.name);
  return a.txHash ? `Tx ${short(a.txHash, 6, 4)}` : "";
}

export function activityMeta(type: string) {
  return ACTIVITY[type] ?? { label: type, icon: CircleDot, tone: "neutral" as const };
}
