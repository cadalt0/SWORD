"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPublicClient, erc20Abi, http } from "viem";
import { CHAINS, type SwordSDK } from "sword-sdk";
import { ArrowLeft, LogIn, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { runAction, type ActionResult } from "@/lib/client/actions";
import type { Address } from "@/lib/client/types";
import { connectWallet, hasMetaMask, publicRpcFor } from "@/lib/client/wallet";
import { cn } from "@/lib/utils";
import { AccountSetup } from "./AccountSetup";
import type { Account, Me } from "./Dashboard";
import { Spinner } from "./kit";
import { SignIn } from "./SignIn";
import { errorText, money, notify, short } from "./shared";
import { Token } from "@/lib/client/token";

/// "Pay with Sword", as one reusable element. Drop it next to anything a customer can pay for or confirm.
///
/// It takes care of everything around the action:
///   - signed out: a button that opens sign-in, then comes straight back to pay.
///   - signed in as a merchant: says so.
///   - no customer account yet: lets them create one.
///   - custodial account: pays at once, no wallet.
///   - self-custody account with the relayer's permission: pays at once, no wallet.
///   - self-custody account without it: asks them to connect their wallet, which signs the payment.
/// You give it the action twice: how the server does it (`relayer`), and how the customer's own wallet does it (`owner`).

export type SwordAction = {
  /// The server does it: the relayer sends it for the signed-in customer.
  relayer: () => Promise<Record<string, unknown> & { hash?: string }>;
  /// The customer's own wallet does it, through their smart account.
  owner: (sdk: SwordSDK, account: Account) => Promise<ActionResult>;
  /// What to remember about it when the wallet sent it. The server records relayer actions itself.
  record: (result: ActionResult) => { type: string; details: Record<string, unknown>; txHash?: string };
};

/// The state of the signed-in customer's Sword access, for the element and for anything built around it.
export function useSword(chainId: number) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [wallet, setWallet] = useState<Address | undefined>();
  const [permitted, setPermitted] = useState<boolean | undefined>();
  const [balance, setBalance] = useState<number | undefined>();

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  const found = me && me.user.role === "customer" ? me.accounts.find((a) => a.kind === "customer") : undefined;
  /// The account on another chain is not usable here: an account lives on one chain.
  const otherChain = found !== undefined && found.chainId !== chainId ? found : undefined;
  const account = otherChain ? undefined : found;
  const address = account?.address;
  const custody = account?.custody;

  // Whether the relayer may act for a self-custody account right now.
  useEffect(() => {
    let live = true;
    void (async () => {
      if (!address || custody !== "self") {
        if (live) setPermitted(custody === "custodial" ? true : undefined);
        return;
      }
      try {
        const s = await api<{ grantActive: boolean }>(`/api/permission?chainId=${chainId}`);
        if (live) setPermitted(s.grantActive);
      } catch {
        if (live) setPermitted(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [chainId, address, custody]);

  // The account's USDT, so a payment that can't be afforded says so before it is tried.
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const client = createPublicClient({ transport: http(publicRpcFor(chainId)) });
      const value = await client.readContract({ address: CHAINS[chainId].addresses.usdt, abi: erc20Abi, functionName: "balanceOf", args: [address as Address] });
      setBalance(Number(value) / 1e6);
    } catch {
      setBalance(undefined);
    }
  }, [chainId, address]);

  useEffect(() => {
    void (async () => {
      await refreshBalance();
    })();
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    setWallet(await connectWallet(chainId));
  }, [chainId]);

  return { me, account, otherChain, wallet, setWallet, connect, reload, permitted, balance, refreshBalance };
}

/// Opens sign-in over the page, and closes it once signed in.
function SignInOverlay({ onSignedIn, onClose }: { onSignedIn: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-background">
      <button type="button" onClick={onClose} className="fixed right-16 top-[18px] z-10 inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm shadow-soft transition-colors hover:bg-muted">
        <ArrowLeft className="size-4" /> Back
      </button>
      <SignIn onSignedIn={onSignedIn} />
    </div>
  );
}

/// A button that opens sign-in over the page. For places that only need the customer to be signed in.
export function SignInButton({ label = "Sign in", onSignedIn, className }: { label?: string; onSignedIn: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className={cn("h-11 w-full rounded-xl", className)} onClick={() => setOpen(true)}>
        <LogIn className="size-4" /> {label}
      </Button>
      {open && (
        <SignInOverlay
          onClose={() => setOpen(false)}
          onSignedIn={() => {
            setOpen(false);
            onSignedIn();
          }}
        />
      )}
    </>
  );
}

export function SwordPay({
  chainId,
  label,
  busyLabel = "Paying…",
  action,
  amount,
  variant = "default",
  className,
  disabled,
  signInLabel = "Sign in to pay",
  caption = true,
  onStart,
  onDone,
  onError,
  state: shared,
}: {
  chainId: number;
  /// The button text once everything is ready, such as "Pay 9.99 USDT".
  label: ReactNode;
  busyLabel?: string;
  action: SwordAction;
  /// What it costs, in decimal USDT. Used to warn when the account can't afford it.
  amount?: number;
  variant?: "default" | "outline" | "destructive";
  className?: string;
  disabled?: boolean;
  signInLabel?: string;
  /// Show the one-line note about how it will be paid.
  caption?: boolean;
  onStart?: () => void;
  onDone?: (result: ActionResult) => void;
  onError?: (error: unknown) => void;
  /// Share one `useSword` between several elements on a page, so they sign in and connect once.
  state?: ReturnType<typeof useSword>;
}) {
  const own = useSword(chainId);
  const wm = shared ?? own;
  const { me, account, wallet, permitted, balance } = wm;
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState<"connect" | "pay" | undefined>();

  const big = "h-11 w-full rounded-xl";

  async function connect() {
    setBusy("connect");
    try {
      await wm.connect();
    } catch (err) {
      notify("error", errorText(err, "Could not connect the wallet"));
    } finally {
      setBusy(undefined);
    }
  }

  async function pay() {
    if (!account) return;
    setBusy("pay");
    onStart?.();
    try {
      const result = await runAction({
        account: { address: account.address, owner: account.owner, custody: account.custody },
        chainId,
        wallet,
        relayer: action.relayer,
        owner: (sdk) => action.owner(sdk, account),
        record: action.record,
      });
      void wm.refreshBalance();
      onDone?.(result);
    } catch (err) {
      if (onError) onError(err);
      else notify("error", errorText(err, "That didn't go through"));
    } finally {
      setBusy(undefined);
    }
  }

  if (me === undefined) {
    return (
      <Button size="lg" variant={variant} className={cn(big, className)} disabled>
        <Spinner /> Loading
      </Button>
    );
  }

  if (me === null) {
    return (
      <>
        <Button size="lg" variant="outline" className={cn(big, className)} disabled={disabled} onClick={() => setSigningIn(true)}>
          <LogIn className="size-4" /> {signInLabel}
        </Button>
        {signingIn && (
          <SignInOverlay
            onClose={() => setSigningIn(false)}
            onSignedIn={() => {
              setSigningIn(false);
              void wm.reload();
            }}
          />
        )}
      </>
    );
  }

  if (me.user.role !== "customer") {
    return <p className="text-sm text-muted-foreground">You&apos;re signed in as a merchant. Sign in with a customer account to pay from Sword.</p>;
  }

  if (wm.otherChain) {
    const theirs = CHAINS[wm.otherChain.chainId]?.chain.name ?? `chain ${wm.otherChain.chainId}`;
    const here = CHAINS[chainId]?.chain.name ?? `chain ${chainId}`;
    return (
      <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
        Your Sword account is on {theirs}, and this payment is on {here}. Pay with a wallet instead, or sign in with an account on {here}.
      </p>
    );
  }

  if (!account) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Create your Sword account to pay from it.</p>
        <AccountSetup role="customer" chainId={chainId} wallet={wallet} onDone={wm.reload} />
      </div>
    );
  }

  // Self-custody without the relayer's permission: their wallet has to sign this one.
  const needsWallet = account.custody === "self" && permitted === false && !wallet;
  const short_ = amount !== undefined && balance !== undefined && balance < amount;
  const note =
    account.custody === "custodial"
      ? "Paid from your Sword balance"
      : permitted
        ? "Paid from your account, within the permission you gave"
        : wallet
          ? `Your wallet ${short(wallet, 4, 4)} confirms this`
          : "Your wallet confirms this payment";

  return (
    <div className="space-y-2">
      {needsWallet ? (
        hasMetaMask() ? (
          <Button size="lg" variant="outline" className={cn(big, className)} disabled={busy === "connect" || disabled} onClick={() => void connect()}>
            {busy === "connect" ? <Spinner /> : <Wallet className="size-4" />}
            {busy === "connect" ? "Connecting…" : "Connect your wallet to pay"}
          </Button>
        ) : (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">Install the MetaMask extension to confirm this with your wallet.</p>
        )
      ) : (
        <Button size="lg" variant={variant} className={cn(big, className)} disabled={busy === "pay" || disabled || short_ || (permitted === undefined && account.custody === "self")} onClick={() => void pay()}>
          {busy === "pay" ? <Spinner /> : null}
          {busy === "pay" ? busyLabel : label}
        </Button>
      )}
      {caption && (
        <p className={cn("flex items-center justify-center gap-1.5 text-center text-xs", short_ ? "text-warning" : "text-muted-foreground")}>
          {short_ ? (
            <>You have {money(balance ?? 0)} <Token />. Add funds to your account to pay.</>
          ) : (
            <>
              <ShieldCheck className="size-3.5" /> {note}
            </>
          )}
        </p>
      )}
    </div>
  );
}
