"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Address } from "@/lib/client/types";
import { connectWallet, hasMetaMask } from "@/lib/client/wallet";
import { errorText, notify, short } from "./shared";
import { Spinner } from "./kit";

/// A small gradient avatar derived from an address, so each wallet looks distinct.
function addressGradient(address: string): string {
  const h1 = parseInt(address.slice(2, 6), 16) % 360;
  const h2 = (h1 + 80) % 360;
  return `linear-gradient(135deg, oklch(0.7 0.16 ${h1}), oklch(0.55 0.18 ${h2}))`;
}

/// Connects the user's MetaMask. Only self-custody accounts sign with it.
export function WalletButton({
  chainId,
  wallet,
  onConnected,
}: {
  chainId: number;
  wallet: Address | undefined;
  onConnected: (address: Address) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!hasMetaMask()) {
    return (
      <span className="hidden h-9 items-center gap-1.5 rounded-full border px-3 text-xs text-muted-foreground sm:inline-flex">
        <Wallet className="size-3.5" /> No wallet
      </span>
    );
  }

  if (wallet) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex h-9 items-center gap-2 rounded-full border bg-card pl-1.5 pr-3 text-xs font-medium shadow-soft"
      >
        <span className="relative size-6 rounded-full" style={{ background: addressGradient(wallet) }}>
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-success" />
        </span>
        <span className="font-mono">{short(wallet, 4, 4)}</span>
      </motion.span>
    );
  }

  async function connect() {
    setBusy(true);
    try {
      onConnected(await connectWallet(chainId));
    } catch (err) {
      notify("error", errorText(err, "Could not connect the wallet"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="h-9 rounded-full px-3.5 shadow-soft" onClick={connect} disabled={busy}>
      {busy ? <Spinner /> : <Wallet className="size-4" />}
      <span className="hidden sm:inline">{busy ? "Connecting…" : "Connect wallet"}</span>
    </Button>
  );
}
