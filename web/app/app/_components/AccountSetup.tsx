"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Server, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import { errorText, notify } from "./shared";
import { Spinner } from "./kit";

type Custody = "custodial" | "self";

const OPTIONS: { value: Custody; title: string; body: string; icon: typeof Server }[] = [
  { value: "custodial", title: "Custodial", body: "We run the account for you. No wallet needed.", icon: Server },
  { value: "self", title: "Self-custody", body: "Your own wallet owns the account. You approve permissions in it.", icon: Shield },
];

/// Creates the account. Custodial: the relayer manages it. Self-custody: the connected wallet owns it.
export function AccountSetup({
  role,
  chainId,
  wallet,
  onDone,
}: {
  role: "customer" | "merchant";
  chainId: number;
  wallet: Address | undefined;
  onDone: () => void;
}) {
  const [custody, setCustody] = useState<Custody>("custodial");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      if (custody === "self" && !wallet) throw new Error("Connect your wallet first");
      await api("/api/accounts", { chainId, custody, signing: custody === "custodial" ? "relayer" : "manual", ownerAddress: wallet });
      notify("success", "Account created");
      onDone();
    } catch (err) {
      notify("error", errorText(err, "Could not create the account"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card mx-auto max-w-2xl overflow-hidden">
      <div className="border-b p-5 md:p-6">
        <p className="text-base font-semibold">Create your {role} account</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Choose who controls the account. This choice is fixed once the account exists.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 md:p-6">
        {OPTIONS.map((o) => {
          const selected = custody === o.value;
          return (
            <motion.button
              key={o.value}
              type="button"
              aria-pressed={selected}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setCustody(o.value)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left transition-[box-shadow,border-color] hover:shadow-soft",
                selected && "border-brand shadow-[0_0_0_1px_var(--brand)]",
              )}
            >
              <span className={cn("grid size-10 place-items-center rounded-xl", selected ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                <o.icon className="size-5" />
              </span>
              <span className="font-semibold">{o.title}</span>
              <span className="text-sm text-muted-foreground">{o.body}</span>
              {selected && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-4 md:px-6">
        <span className="text-sm text-muted-foreground">
          {custody === "self" && !wallet ? "Connect your wallet to continue." : "You can view the account at any time."}
        </span>
        <Button className="rounded-full" onClick={create} disabled={busy || (custody === "self" && !wallet)}>
          {busy && <Spinner />}
          {busy ? "Creating…" : "Create account"}
        </Button>
      </div>
    </div>
  );
}
