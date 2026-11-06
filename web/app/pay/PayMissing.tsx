"use client";

import Link from "next/link";
import { Link2Off } from "lucide-react";

import { EmptyState, Logo } from "../app/_components/kit";

/// Shown when /pay is opened without an order in the link.
export function PayMissing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center px-4 md:px-8">
        <Logo withText />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <EmptyState
          icon={Link2Off}
          title="This pay link is incomplete"
          description="Ask the merchant for the full link, or scan their QR code."
          action={
            <Link href="/app" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
              Go to Sword
            </Link>
          }
        />
      </main>
    </div>
  );
}
