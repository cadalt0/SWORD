"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { api } from "@/lib/client/api";
import type { Me } from "./Dashboard";
import { EmptyState, LoadingState, Logo } from "./kit";
import { ChainToken } from "@/lib/client/token";

/// Signs-in check and layout for pages outside the dashboard (/plans, /activity): a back button, the logo, and
/// the theme switch. Renders its children with the signed-in user once known.
export function PageShell({ role, children }: { role?: "merchant" | "customer"; children: (me: Me) => ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>();

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const allowed = me && (!role || me.user.role === role) && me.accounts.some((a) => a.kind === me.user.role);

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent)]" />
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/app" className="grid size-9 place-items-center rounded-full border bg-card shadow-soft transition-colors hover:bg-muted" aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Link>
            <Logo withText />
          </div>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-6">
        {me === undefined ? (
          <LoadingState label="Loading your workspace" />
        ) : !allowed ? (
          <EmptyState
            icon={LogIn}
            title={me ? "This page is for another kind of account" : "Sign in to continue"}
            description={role === "merchant" ? "Sign in with your merchant account." : "Sign in to Sword."}
            action={
              <Link href="/app" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                Go to Sword
              </Link>
            }
          />
        ) : (
          <ChainToken chainId={me.accounts.find((x) => x.kind === me.user.role)?.chainId}>{children(me)}</ChainToken>
        )}
      </main>
    </div>
  );
}
