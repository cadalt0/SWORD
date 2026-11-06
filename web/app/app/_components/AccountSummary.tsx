"use client";

import { CHAINS } from "sword-sdk";
import { Fingerprint, Globe, KeyRound, Server, ShieldCheck, Wallet } from "lucide-react";

import type { Account } from "./Dashboard";
import { FadeIn, IconChip, Logo, PageHeader } from "./kit";
import { CopyButton, short } from "./shared";

/// The account at a glance: its address, who owns it, the network, and how actions are signed.
export function AccountSummary({ role, account }: { role: "customer" | "merchant"; account: Account }) {
  const selfCustody = account.custody === "self";
  const signing = account.signing === "signless" ? "Relayer, within your permission" : account.signing === "manual" ? "Your wallet, every action" : "Sword relayer";

  const facts = [
    { label: "Owner", value: short(account.owner, 8, 6), sub: selfCustody ? "Your wallet" : "Sword relayer", icon: KeyRound, copy: account.owner },
    { label: "Network", value: CHAINS[account.chainId]?.chain.name ?? String(account.chainId), sub: `Chain ${account.chainId}`, icon: Globe },
    { label: "Custody", value: selfCustody ? "Self-custody" : "Custodial", sub: selfCustody ? "You control the funds" : "Managed by Sword", icon: selfCustody ? Wallet : Server },
    { label: "Signing", value: signing, sub: role === "merchant" && account.eoa ? "Your wallet is the merchant" : "Smart account", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description={role === "merchant" ? "Your merchant identity on Whitechain." : "Your Sword account on Whitechain."} />

      <FadeIn delay={0.05} className="surface-card overflow-hidden">
        <div className="relative h-28 overflow-hidden bg-[linear-gradient(120deg,oklch(0.45_0.19_280),oklch(0.32_0.12_250))]">
          <div aria-hidden className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgb(255_255_255)_1px,transparent_1px)] [background-size:16px_16px]" />
          <div aria-hidden className="absolute -right-10 -top-16 size-56 rounded-full bg-[radial-gradient(circle,oklch(0.78_0.15_300/0.5),transparent_65%)] blur-2xl" />
        </div>
        <div className="relative px-5 pb-6 md:px-6">
          <div className="-mt-9 flex flex-wrap items-end justify-between gap-4">
            <div className="rounded-[22px] bg-card p-1.5 shadow-lift">
              <Logo size={60} />
            </div>
            <span className={selfCustody ? "rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20" : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border"}>
              {selfCustody ? "Self-custody" : "Custodial"}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{role === "merchant" ? "Merchant ID" : "Account address"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Fingerprint className="size-4 text-muted-foreground" />
              <p className="break-all font-mono text-sm md:text-base">{account.address}</p>
              <CopyButton value={account.address} label="Copy" />
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2">
        {facts.map((f, i) => (
          <FadeIn key={f.label} delay={0.08 + i * 0.04} className="surface-card flex items-start gap-3 p-4">
            <IconChip icon={f.icon} tone={i === 0 ? "brand" : "neutral"} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="mt-0.5 truncate text-sm font-medium">{f.value}</p>
              <p className="text-xs text-muted-foreground">{f.sub}</p>
            </div>
            {f.copy && <CopyButton value={f.copy} label="" />}
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
