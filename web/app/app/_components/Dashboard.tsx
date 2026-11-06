"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CHAINS, DEFAULT_CHAIN_ID, supportedChainIds } from "sword-sdk";
import { Banknote, Home, LogOut, Repeat, Send, Settings, ShieldCheck, ShoppingBag, Wallet as WalletIcon } from "lucide-react";

import { AccountSummary } from "./AccountSummary";
import { AccountSetup } from "./AccountSetup";
import { DevelopersPanel } from "./DevelopersPanel";
import { NotificationBell } from "./NotificationBell";
import { RefundRequests } from "./RefundRequests";
import { AppSidebar, type Section } from "./AppSidebar";
import { CustomerHome } from "./CustomerHome";
import { CustomerPanel } from "./CustomerPanel";
import { MerchantPanel } from "./MerchantPanel";
import { AccountOnboarding } from "./AccountOnboarding";
import { Overview } from "./Overview";
import { PermissionPanel } from "./PermissionPanel";
import { CashOutPanel } from "./CashOutPanel";
import type { ScanTarget } from "./QrScanner";
import { MyPurchases } from "./MyPurchases";
import { MySubscriptions } from "./MySubscriptions";
import { SubscriptionsPanel } from "./SubscriptionsPanel";
import { SignIn } from "./SignIn";
import { WalletButton } from "./WalletButton";
import { LoadingState, Logo, Segmented } from "./kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/client/api";
import type { Address } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import { ChainToken } from "@/lib/client/token";

export type Account = { kind: "customer" | "merchant"; custody: "custodial" | "self"; signing?: string; eoa?: boolean; address: string; owner: string; chainId: number };
export type OnboardingStatus = {
  ready: boolean;
  hasAccount: boolean;
  accountAddress?: string;
  signing?: "relayer" | "manual" | "signless" | null;
  registered: boolean;
  grantActive: boolean;
  /// The chain the account is on, once there is one.
  chainId?: number;
};
export type Me = { user: { id: string; email: string; name: string | null; role: "customer" | "merchant" }; accounts: Account[] };

const TITLES: Record<Section, string> = {
  overview: "Overview",
  orders: "Orders",
  subscriptions: "Subscriptions",
  pay: "Pay",
  refunds: "Refunds",
  purchases: "Purchases",
  cashout: "Cash out",
  permission: "Permission",
  developers: "Developers",
  account: "Account",
};

/// The /app page. Signed out: sign-in. Signed in: the merchant dashboard or the customer wallet.
export function Dashboard() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [chainId, setChainId] = useState<number>(DEFAULT_CHAIN_ID);
  const [wallet, setWallet] = useState<Address | undefined>(undefined);
  const [section, setSectionState] = useState<Section>("overview");
  // Set when the merchant asks for a new order from elsewhere, so the orders page opens with the form already open.
  const [newOrder, setNewOrder] = useState(false);
  // A QR scanned on the customer home, handed to the Pay section.
  const [payTarget, setPayTarget] = useState<ScanTarget | undefined>();
  const setSection = useCallback((s: Section) => {
    setNewOrder(false);
    setPayTarget(undefined);
    setSectionState(s);
  }, []);
  const openPay = useCallback((target?: ScanTarget) => {
    setPayTarget(target);
    setSectionState("pay");
  }, []);
  const openNewOrder = useCallback(() => {
    setNewOrder(true);
    setSectionState("orders");
  }, []);
  // Pay links live at /pay. Older links that pointed at /app are sent there, with the same details.
  const [prefill] = useState<{ merchant?: string; order?: string }>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("merchant") && q.get("order")) window.location.replace(`/pay${window.location.search}`);
  }, []);

  // The dashboard shows only once the account is ready (created, registered, permission active if signless).
  const [onboarding, setOnboarding] = useState<OnboardingStatus | undefined>(undefined);
  // Who the page last showed, so a different person signing in never inherits the previous person's setup state.
  const lastUser = useRef<string | undefined>(undefined);
  const load = useCallback(async () => {
    try {
      const next = await api<Me>("/api/me");
      if (lastUser.current !== next.user.id) {
        lastUser.current = next.user.id;
        setOnboarding(undefined);
      }
      setMe(next);
    } catch {
      lastUser.current = undefined;
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The dashboard shows only once the account is ready (created, registered, permission active if signless).
  const loadOnboarding = useCallback(async () => {
    try {
      const status = await api<OnboardingStatus>("/api/onboarding");
      setOnboarding(status);
      // An existing account decides the chain: everything after this uses it.
      if (status.hasAccount && status.chainId) setChainId(status.chainId);
    } catch {
      setOnboarding({ ready: false, hasAccount: false, registered: false, grantActive: false, signing: null });
    }
  }, []);
  useEffect(() => {
    if (me) void loadOnboarding();
  }, [me, loadOnboarding]);

  const reloadAll = useCallback(async () => {
    await Promise.all([load(), loadOnboarding()]);
  }, [load, loadOnboarding]);

  async function signOut() {
    await api("/api/auth/logout", {});
    setWallet(undefined);
    setSection("overview");
    // Forget the setup state too, or the next person to sign in would see the previous account's setup.
    setOnboarding(undefined);
    setMe(null);
  }

  if (me && onboarding !== undefined && !onboarding.ready) {
    return (
      <ChainToken chainId={chainId}>
      <AccountOnboarding
        key={me.user.id}
        role={me.user.role}
        chainId={chainId}
        onChainChange={setChainId}
        status={onboarding}
        onSignOut={signOut}
        onReady={async (connected) => {
          if (connected) setWallet(connected);
          await Promise.all([load(), loadOnboarding()]);
        }}
      />
      </ChainToken>
    );
  }

  if (me === undefined || (me && onboarding === undefined)) return <Splash />;

  if (me === null) return <SignIn onSignedIn={load} />;

  const role = me.user.role;
  const account = me.accounts.find((a) => a.kind === role);
  const activeChain = account?.chainId ?? chainId;
  // With an active relayer permission the relayer signs every action, so the wallet is only needed to change the
  // permission itself. "Manual" accounts always sign with the wallet, so they are always asked.
  const permissionActive = account?.custody === "self" && account.signing === "signless" && onboarding?.grantActive === true;
  const walletNeeded = account?.custody === "self" && (!permissionActive || section === "permission");

  const topActions = (
    <>
      <NetworkPill chainId={activeChain} locked={account !== undefined} onChange={setChainId} />
      {(walletNeeded || wallet) && <WalletButton chainId={activeChain} wallet={wallet} onConnected={setWallet} />}
      <NotificationBell onNavigate={setSection} />
      <ModeToggle />
      <UserMenu me={me} onAccount={() => setSection("account")} onSignOut={signOut} />
    </>
  );

  const walletBanner = walletNeeded && !wallet && (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
          <WalletIcon className="size-4" />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Connect your wallet to continue</p>
          <p className="text-sm text-muted-foreground">Your account is self-custody, so your wallet signs each action unless the relayer has your permission.</p>
        </div>
      </div>
      <WalletButton chainId={activeChain} wallet={wallet} onConnected={setWallet} />
    </motion.div>
  );

  if (role === "customer") {
    return (
      <ChainToken chainId={activeChain}>
      <CustomerShell section={section} onSection={setSection} custodial={account?.custody === "custodial"} actions={topActions}>
        {!account ? (
          <AccountSetup role={role} chainId={chainId} wallet={wallet} onDone={load} />
        ) : (
          <div className="space-y-6">
            {walletBanner && <div className="mx-auto max-w-4xl">{walletBanner}</div>}
            <CustomerContent section={section} account={account} wallet={wallet} onChanged={reloadAll} prefill={prefill} onSection={setSection} onPay={openPay} payTarget={payTarget} />
          </div>
        )}
      </CustomerShell>
      </ChainToken>
    );
  }

  return (
    <ChainToken chainId={activeChain}>
    <SidebarProvider>
      <AppSidebar role={role} custodial={account?.custody === "custodial"} email={me.user.email} name={me.user.name} section={section} onSection={setSection} onSignOut={signOut} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/75 px-4 backdrop-blur-xl md:px-6">
          <SidebarTrigger aria-label="Toggle navigation" className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Merchant</span>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={section} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="truncate font-medium">
                {TITLES[section]}
              </motion.span>
            </AnimatePresence>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">{topActions}</div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">
          {!account ? (
            <AccountSetup role={role} chainId={chainId} wallet={wallet} onDone={load} />
          ) : (
            <>
              {walletBanner}
              <AnimatePresence mode="wait">
                <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                  <MerchantContent section={section} account={account} wallet={wallet} onChanged={reloadAll} onSection={setSection} onNewOrder={openNewOrder} newOrder={newOrder} />
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </ChainToken>
  );
}

/// Merchant sections.
function MerchantContent({
  section,
  account,
  wallet,
  onChanged,
  onSection,
  onNewOrder,
  newOrder,
}: {
  section: Section;
  account: Account;
  wallet: Address | undefined;
  onChanged: () => Promise<void>;
  onSection: (s: Section) => void;
  onNewOrder: () => void;
  newOrder: boolean;
}) {
  const chainId = account.chainId;
  if (section === "overview") return <Overview chainId={chainId} account={account} onSection={onSection} onNewOrder={onNewOrder} />;
  if (section === "permission" && account.custody === "self") return <PermissionPanel chainId={chainId} account={account} wallet={wallet} onChanged={onChanged} />;
  if (section === "subscriptions") return <SubscriptionsPanel chainId={chainId} account={account} wallet={wallet} />;
  if (section === "developers") return <DevelopersPanel chainId={chainId} account={account} />;
  if (section === "cashout") return <CashOutPanel chainId={chainId} account={account} />;
  if (section === "refunds") return <RefundRequests chainId={chainId} account={account} wallet={wallet} />;
  if (section === "account") {
    return (
      <div className="space-y-6">
        <AccountSummary role="merchant" account={account} />
        <MerchantPanel chainId={chainId} account={account} wallet={wallet} section="account" />
      </div>
    );
  }
  return <MerchantPanel chainId={chainId} account={account} wallet={wallet} section="orders" openCreate={newOrder} />;
}

/// Customer sections.
function CustomerContent({
  section,
  account,
  wallet,
  onChanged,
  prefill,
  onSection,
  onPay,
  payTarget,
}: {
  section: Section;
  account: Account;
  wallet: Address | undefined;
  onChanged: () => Promise<void>;
  prefill: { merchant?: string; order?: string };
  onSection: (s: Section) => void;
  onPay: (target?: ScanTarget) => void;
  payTarget: ScanTarget | undefined;
}) {
  const chainId = account.chainId;
  if (section === "overview") return <CustomerHome chainId={chainId} account={account} onSection={onSection} onPay={onPay} />;
  if (section === "permission" && account.custody === "self") return <PermissionPanel chainId={chainId} account={account} wallet={wallet} onChanged={onChanged} />;
  if (section === "account") return <AccountSummary role="customer" account={account} />;
  if (section === "subscriptions") return <MySubscriptions chainId={chainId} account={account} />;
  if (section === "purchases") return <MyPurchases chainId={chainId} account={account} />;
  if (section === "cashout") return <CashOutPanel chainId={chainId} account={account} />;
  const customerSection = section === "pay" || section === "refunds" ? section : "pay";
  return <CustomerPanel chainId={chainId} account={account} wallet={wallet} section={customerSection} prefill={prefill} target={payTarget} />;
}

const CUSTOMER_NAV: { id: Section; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Home", icon: Home },
  { id: "pay", label: "Pay", icon: Send },
  { id: "subscriptions", label: "Subscriptions", icon: Repeat },
  { id: "purchases", label: "Purchases", icon: ShoppingBag },
  { id: "cashout", label: "Cash out", icon: Banknote },
  { id: "permission", label: "Permission", icon: ShieldCheck },
  { id: "account", label: "Account", icon: Settings },
];

/// The customer wallet layout: a centered column, a segmented nav on desktop, and a tab bar on phones.
function CustomerShell({
  section,
  onSection,
  custodial,
  actions,
  children,
}: {
  section: Section;
  onSection: (s: Section) => void;
  custodial: boolean;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav = CUSTOMER_NAV.filter((n) => !(custodial && n.id === "permission"));
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--brand)_12%,transparent),transparent)]" />
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Logo withText />
          <div className="mx-auto hidden md:block">
            <Segmented id="customer-nav" value={section} onChange={onSection} options={nav.map((n) => ({ value: n.id, label: n.label, icon: n.icon }))} />
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-0">{actions}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 md:pb-16 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav aria-label="Sections" className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border bg-card p-1.5 shadow-lift md:hidden">
        <ul className="flex items-stretch justify-between">
          {nav.map((n) => {
            const active = section === n.id;
            return (
              <li key={n.id} className="flex-1">
                <button type="button" onClick={() => onSection(n.id)} className={cn("relative flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                  {active && <motion.span layoutId="customer-tab" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <n.icon className="relative size-[18px]" />
                  <span className="relative">{n.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/// The network the account lives on. Fixed once the account exists.
function NetworkPill({ chainId, locked, onChange }: { chainId: number; locked: boolean; onChange: (id: number) => void }) {
  return (
    <Select value={String(chainId)} onValueChange={(v) => v && onChange(Number(v))} disabled={locked}>
      <SelectTrigger size="sm" aria-label="Network" className="hidden gap-2 rounded-full data-[size=sm]:h-9 data-[size=sm]:rounded-full border-border/80 bg-card px-3 text-xs font-medium shadow-soft disabled:opacity-100 sm:flex">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <span>{CHAINS[chainId]?.chain.name ?? chainId}</span>
      </SelectTrigger>
      <SelectContent>
        {supportedChainIds().map((id) => (
          <SelectItem key={id} value={String(id)}>
            {CHAINS[id]?.chain.name ?? id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserMenu({ me, onAccount, onSignOut }: { me: Me; onAccount: () => void; onSignOut: () => void }) {
  const initial = (me.user.name ?? me.user.email).slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}>
        <Avatar className="size-8 ring-2 ring-border">
          <AvatarFallback className="bg-[linear-gradient(135deg,oklch(0.6_0.2_285),oklch(0.55_0.15_220))] text-xs font-semibold text-white">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium">{me.user.name ?? me.user.email}</div>
            <div className="truncate text-xs text-muted-foreground">{me.user.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAccount}>
          <Settings className="size-4" /> Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/// Shown while the session and account load.
function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoadingState label="Loading your workspace" />
    </div>
  );
}
