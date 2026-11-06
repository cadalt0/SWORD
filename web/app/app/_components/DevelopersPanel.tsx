"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { AlertTriangle, Ban, Code2, FlaskConical, Globe, KeyRound, Plus, ShieldCheck, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { Account } from "./Dashboard";
import { EmptyState, IconChip, LoadingRows, PageHeader, Spinner } from "./kit";
import { CopyButton, errorText, notify, short, timeAgo } from "./shared";

type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

/// What each scope allows, in words. Moving money out is marked so the merchant thinks before granting it.
const SCOPE_INFO: Record<string, { label: string; detail: string; money?: boolean }> = {
  "orders:read": { label: "Read orders", detail: "See orders and whether they are paid" },
  "orders:write": { label: "Create orders", detail: "Create orders and checkout links, confirm wallet transfers" },
  "subscriptions:read": { label: "Read subscriptions", detail: "See subscriptions and their payments" },
  "subscriptions:write": { label: "Manage subscriptions", detail: "Create, charge and cancel subscriptions" },
  "refunds:write": { label: "Refunds", detail: "Refund customers, approve or decline requests", money: true },
  "withdrawals:write": { label: "Withdrawals", detail: "Move paid order and subscription money to your account", money: true },
};

type Signing = "relayer" | "permission" | "self";

/// How the API signs for this merchant, in words.
function signingText(signing: Signing | undefined): { title: string; detail: string } {
  if (signing === undefined) return { title: "Checking how the API signs…", detail: "" };
  if (signing === "relayer") return { title: "Signed for you", detail: "Your account is custodial, so the API signs every action. Your backend only needs the API key." };
  if (signing === "permission") return { title: "Signed within your permission", detail: "The API signs within the permission you gave. Your backend only needs the API key." };
  return { title: "Signed by your wallet", detail: "You haven't given the relayer a permission, so your backend also passes your wallet's private key. The SDK signs locally; the key never leaves your server." };
}

/// The Developers page: API keys, approved checkout domains, and how to start.
export function DevelopersPanel({ chainId, account }: { chainId: number; account: Account }) {
  const [keys, setKeys] = useState<ApiKey[] | undefined>();
  const [scopes, setScopes] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | undefined>();
  const [signingMode, setSigningMode] = useState<Signing | undefined>();

  const load = useCallback(async () => {
    try {
      const r = await api<{ keys: ApiKey[]; scopes: string[]; defaultScopes: string[]; signing: Signing }>(`/api/developers/keys?chainId=${chainId}`);
      setKeys(r.keys);
      setSigningMode(r.signing);
      setScopes(r.scopes);
      setDefaults(r.defaultScopes);
    } catch (err) {
      notify("error", errorText(err, "Could not load your API keys"));
      setKeys([]);
    }
  }, [chainId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const signing = signingText(signingMode);
  const active = (keys ?? []).filter((k) => !k.revokedAt);
  const revoked = (keys ?? []).filter((k) => k.revokedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developers"
        description="Add Sword payments to your own product. Your backend creates orders with an API key; your page shows the pay button."
        actions={
          <>
            <Link href="/playground" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium shadow-soft transition-colors hover:bg-muted">
              <FlaskConical className="size-4" /> API playground
            </Link>
            <Button className="rounded-full" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Create API key
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <IconChip icon={KeyRound} tone="brand" size="sm" />
            <div>
              <p className="text-sm font-semibold">API keys</p>
              <p className="text-xs text-muted-foreground">Test keys for Whitechain testnet. Each key acts for this merchant account only.</p>
            </div>
          </div>
          {keys === undefined ? (
            <LoadingRows count={3} className="p-3" />
          ) : keys.length === 0 ? (
            <EmptyState icon={KeyRound} title="No API keys yet" description="Create one to call the Sword API from your backend." action={<Button className="rounded-full" onClick={() => setCreating(true)}><Plus className="size-4" /> Create API key</Button>} />
          ) : (
            <ul className="divide-y">
              {[...active, ...revoked].map((k) => (
                <li key={k.id} className={cn("flex items-start gap-3 px-5 py-4", k.revokedAt && "opacity-55")}>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{k.name}</p>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{k.prefix}…</span>
                      {k.revokedAt ? <span className="text-[11px] font-medium text-destructive">Revoked</span> : <span className="text-[11px] font-medium text-success">Active</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <span key={s} className={cn("rounded-full px-2 py-0.5 text-[11px]", SCOPE_INFO[s]?.money ? "bg-warning/12 text-warning" : "bg-muted text-muted-foreground")}>
                          {SCOPE_INFO[s]?.label ?? s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {timeAgo(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setRevoking(k)}>
                      <Trash2 className="size-4" /> Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="surface-card space-y-3 p-5">
            <div className="flex items-center gap-3">
              <IconChip icon={ShieldCheck} tone="success" size="sm" />
              <p className="text-sm font-semibold">{signing.title}</p>
            </div>
            <p className="text-sm text-muted-foreground">{signing.detail}</p>
            <p className="font-mono text-xs text-muted-foreground">Merchant {short(account.address, 8, 6)}</p>
          </section>
          <Domains chainId={chainId} />
        </div>
      </div>

      <Quickstart selfSigned={signingMode === "self"} />

      <CreateKeyDialog open={creating} onOpenChange={setCreating} chainId={chainId} scopes={scopes} defaults={defaults} onCreated={load} />
      <RevokeDialog apiKey={revoking} onOpenChange={(o) => !o && setRevoking(undefined)} onRevoked={load} />
    </div>
  );
}

/// The domains a checkout may hand its result back to.
function Domains({ chainId }: { chainId: number }) {
  const [origins, setOrigins] = useState<string[] | undefined>();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setOrigins((await api<{ allowedOrigins: string[] }>(`/api/developers/settings?chainId=${chainId}`)).allowedOrigins);
      } catch {
        setOrigins([]);
      }
    })();
  }, [chainId]);

  async function save(next: string[]) {
    setSaving(true);
    try {
      setOrigins((await api<{ allowedOrigins: string[] }>("/api/developers/settings", { chainId, allowedOrigins: next })).allowedOrigins);
      setDraft("");
    } catch (err) {
      notify("error", errorText(err, "Could not save the domains"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <IconChip icon={Globe} tone="info" size="sm" />
        <div>
          <p className="text-sm font-semibold">Checkout domains</p>
          <p className="text-xs text-muted-foreground">The pay button only reports back to these sites. Localhost works while in test mode.</p>
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && origins) void save([...origins, draft.trim()]);
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://shop.example.com" className="h-9 rounded-lg" />
        <Button type="submit" variant="outline" className="h-9 rounded-lg" disabled={saving || !draft.trim()}>
          {saving ? <Spinner /> : <Plus className="size-4" />} Add
        </Button>
      </form>
      {origins === undefined ? (
        <LoadingRows count={1} />
      ) : origins.length === 0 ? (
        <p className="text-xs text-muted-foreground">No domains yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {origins.map((o) => (
            <li key={o} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm">
              <span className="truncate font-mono text-xs">{o}</span>
              <button type="button" aria-label={`Remove ${o}`} disabled={saving} onClick={() => void save(origins.filter((x) => x !== o))} className="text-muted-foreground hover:text-destructive">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/// The few lines a developer needs, ready to copy.
function Quickstart({ selfSigned }: { selfSigned: boolean }) {
  const backend = [
    `import { Sword } from "sword-merchant";`,
    selfSigned
      ? `const sword = new Sword({ apiKey: process.env.SWORD_API_KEY, privateKey: process.env.MERCHANT_PRIVATE_KEY });`
      : `const sword = new Sword({ apiKey: process.env.SWORD_API_KEY });`,
    `const order = await sword.orders.create({ amount: "1.00", reference: "order-42" });`,
    `// send order.checkoutUrl to your page`,
  ].join("\n");
  const frontend = [`<script src="https://unpkg.com/sword-checkout"></script>`, `<button data-sword-checkout="CHECKOUT_URL">Pay with Sword</button>`].join("\n");
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <IconChip icon={Code2} tone="neutral" size="sm" />
        <div>
          <p className="text-sm font-semibold">Quickstart</p>
          <p className="text-xs text-muted-foreground">npm install sword-merchant on your server, sword-checkout on your page.</p>
        </div>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {[
          { title: "Your backend", code: backend },
          { title: "Your page", code: frontend },
        ].map((b) => (
          <div key={b.title} className="bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{b.title}</p>
              <CopyButton value={b.code} label="Copy" />
            </div>
            <pre className="overflow-x-auto rounded-xl bg-[oklch(0.17_0.03_275)] p-4 text-[12px] leading-relaxed text-white/85">
              <code>{b.code}</code>
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateKeyDialog({ open, onOpenChange, chainId, scopes, defaults, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; chainId: number; scopes: string[]; defaults: string[]; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | undefined>();
  const picked = chosen ?? defaults;

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setName("");
      setChosen(undefined);
      setCreated(undefined);
    }
  }

  async function create() {
    setBusy(true);
    try {
      const r = await api<{ key: string }>("/api/developers/keys", { chainId, name, scopes: picked });
      setCreated(r.key);
      await onCreated();
    } catch (err) {
      notify("error", errorText(err, "Could not create the key"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-lg">
        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Your new API key</DialogTitle>
                <DialogDescription>Copy it now. For your safety it is shown only once; we keep only a fingerprint of it.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{created}</code>
                <CopyButton value={created} label="Copy" className="shrink-0" />
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> Keep it on your server, for example in an environment variable. Never put it in a web page or an app.
              </p>
              <Button className="w-full rounded-xl" onClick={() => close(false)}>Done</Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Create an API key</DialogTitle>
                <DialogDescription>Name it after where it will run, so you know which one to revoke.</DialogDescription>
              </DialogHeader>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" className="h-11 rounded-xl" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">What it may do</p>
                {scopes.map((s) => {
                  const on = picked.includes(s);
                  const info = SCOPE_INFO[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setChosen(on ? picked.filter((x) => x !== s) : [...picked, s])}
                      className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30")}
                    >
                      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]", on && "border-foreground bg-foreground text-background")}>{on ? "✓" : ""}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {info?.label ?? s} {info?.money && <span className="rounded-full bg-warning/12 px-1.5 text-[10px] text-warning">moves money</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{info?.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button className="h-11 w-full rounded-xl" disabled={busy || !name.trim() || picked.length === 0} onClick={() => void create()}>
                {busy ? <Spinner /> : <KeyRound className="size-4" />} Create key
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({ apiKey, onOpenChange, onRevoked }: { apiKey: ApiKey | undefined; onOpenChange: (o: boolean) => void; onRevoked: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function revoke() {
    if (!apiKey) return;
    setBusy(true);
    try {
      await api("/api/developers/keys/revoke", { id: apiKey.id });
      notify("success", `Revoked ${apiKey.name}`);
      onOpenChange(false);
      await onRevoked();
    } catch (err) {
      notify("error", errorText(err, "Could not revoke the key"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={apiKey !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revoke {apiKey?.name}?</DialogTitle>
          <DialogDescription>Every call with this key fails from now on. This can&apos;t be undone; create a new key if you need one.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button variant="destructive" className="rounded-xl" disabled={busy} onClick={() => void revoke()}>
            {busy ? <Spinner /> : <Ban className="size-4" />} Revoke
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
