"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowDownLeft, Ban, Bell, BellOff, CheckCheck, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { Section } from "./AppSidebar";
import { timeAgo } from "./shared";

type Tone = "info" | "success" | "warning" | "destructive";
type Notification = { id: string; tone: Tone; title: string; body: string; link: string | null; read: boolean; createdAt: string };

const TONES: Record<Tone, { icon: typeof Bell; chip: string }> = {
  info: { icon: Sparkles, chip: "bg-info/12 text-info" },
  success: { icon: ArrowDownLeft, chip: "bg-success/12 text-success" },
  warning: { icon: RotateCcw, chip: "bg-warning/15 text-warning" },
  destructive: { icon: Ban, chip: "bg-destructive/12 text-destructive" },
};

const POLL_MS = 30_000;

/// The bell in the header, for customers and merchants. It shows what happened to your money and your requests:
/// refunds asked, approved, declined or paid, payments, and subscription changes. Clicking one opens the page it is about.
export function NotificationBell({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const [items, setItems] = useState<Notification[] | undefined>();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Ids already seen, so only a notification that arrives while the page is open pops up as a toast.
  const seen = useRef<Set<string> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const r = await api<{ unread: number; notifications: Notification[] }>("/api/notifications");
      if (seen.current) {
        for (const n of r.notifications) {
          if (!seen.current.has(n.id) && !n.read) toast(n.title, { description: n.body });
        }
      }
      seen.current = new Set(r.notifications.map((n) => n.id));
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      // The bell stays as it was. The next check tries again.
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
    const timer = setInterval(() => void load(), POLL_MS);
    const visible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  async function read(ids: string[] | "all") {
    setItems((list) => list?.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids === "all" ? 0 : Math.max(0, u - ids.length)));
    try {
      await api("/api/notifications", ids === "all" ? { all: true } : { ids });
    } catch {
      void load();
    }
  }

  function openOne(n: Notification) {
    if (!n.read) void read([n.id]);
    setOpen(false);
    if (n.link) onNavigate(n.link as Section);
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} />}>
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-background"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button type="button" disabled={unread === 0} onClick={() => void read("all")} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {items === undefined ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-6 py-12 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="size-5" />
              </span>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">Refunds, payments and subscription changes show up here.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const tone = TONES[n.tone] ?? TONES.info;
                const Icon = tone.icon;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => openOne(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60", !n.read && "bg-brand/5")}>
                      <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", tone.chip)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                      </span>
                      {!n.read && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
