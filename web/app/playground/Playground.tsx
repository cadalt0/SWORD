"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toHex } from "viem";
import { CHAINS, DEFAULT_CHAIN_ID } from "sword-sdk";

import { explorerOf, explorerTx } from "@/lib/shared/explorer";
import { ArrowLeft, BookOpen, Check, ChevronRight, Eye, EyeOff, ExternalLink, KeyRound, Play, Search, ShieldCheck, Square, Trash2, Wallet, Zap } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectWallet, hasMetaMask, metamask } from "@/lib/client/wallet";
import { cn } from "@/lib/utils";
import { Logo, Spinner } from "../app/_components/kit";
import { CopyButton, short } from "../app/_components/shared";
import { bodyFor, curlSample, ENDPOINTS, GROUPS, missingFields, nodeSample, pathFor, type Endpoint, type Field, type Values } from "./catalog";
import { JsonView } from "./JsonView";

/// The API playground: pick a sword-merchant method, fill in its inputs, see the code, press Try it, and read the
/// real answer from the Sword API on the same page. Calls go through /api/playground, because the API is for servers.

type Result = {
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
  at: string;
  request: { method: string; path: string; body?: unknown };
};

type Saved = { order?: string; subscription?: string; pending?: string };

const KEY_STORAGE = "sword-playground-key";
const PAID = new Set(["paid", "partially_refunded", "refunded"]);
const ENDED = new Set(["expired", "failed", "closed"]);
const METHOD_TONE: Record<string, string> = { GET: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30", POST: "bg-sky-500/15 text-sky-400 ring-sky-500/30" };
const statusTone = (s: number) => (s >= 500 ? "text-red-400" : s >= 400 ? "text-amber-400" : s === 202 ? "text-sky-400" : "text-emerald-400");

/// Calls the Sword API through the playground route.
async function callApi(apiKey: string, method: string, path: string, body?: unknown): Promise<Result> {
  const res = await fetch("/api/playground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, path, apiKey, body }) });
  const data = (await res.json()) as { status?: number; durationMs?: number; headers?: Record<string, string>; body?: unknown; error?: { code: string; message: string } };
  const request = { method, path, body };
  if (!res.ok || data.status === undefined) return { status: res.status, durationMs: 0, headers: {}, body: { error: data.error ?? { code: "PLAYGROUND_ERROR", message: "The playground could not make the call" } }, at: new Date().toISOString(), request };
  return { status: data.status, durationMs: data.durationMs ?? 0, headers: data.headers ?? {}, body: data.body, at: new Date().toISOString(), request };
}

/// The chain an answer belongs to: the merchant's chainId, a pending transaction's chainId, or the chain in a link.
function chainFrom(body: unknown): number | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as { chainId?: number; transaction?: { chainId?: number }; checkoutUrl?: string; data?: { checkoutUrl?: string }[] };
  const direct = b.chainId ?? (typeof b.transaction === "object" ? b.transaction?.chainId : undefined);
  if (direct && CHAINS[direct]) return direct;
  const link = b.checkoutUrl ?? b.data?.[0]?.checkoutUrl;
  const fromLink = link ? Number(new URL(link).searchParams.get("chain")) : NaN;
  return CHAINS[fromLink] ? fromLink : undefined;
}

/// Ids worth remembering from an answer, so the next call can use them.
function idsFrom(body: unknown): Saved {
  if (!body || typeof body !== "object") return {};
  const b = body as { object?: string; id?: string; transaction?: { id?: string } };
  if (b.object === "order" && b.id) return { order: b.id };
  if (b.object === "subscription" && b.id) return { subscription: b.id };
  if (b.object === "pending_transaction" && b.transaction?.id) return { pending: b.transaction.id };
  return {};
}

/// Starting values for every method: the examples. With a suffix (added in the browser after the page loads, so the
/// server and the browser render the same thing first), references are unique for this visit.
function initialValues(suffix = ""): Record<string, Values> {
  const out: Record<string, Values> = {};
  for (const e of ENDPOINTS) {
    out[e.id] = {};
    for (const f of e.fields) if (f.example) out[e.id]![f.name] = f.unique && suffix ? `${f.example}-${suffix}` : f.example;
  }
  return out;
}

export function Playground({ apiBase }: { apiBase: string }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedId, setSelectedId] = useState("orders.create");
  const [values, setValues] = useState<Record<string, Values>>(() => initialValues());
  const [saved, setSaved] = useState<Saved>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [polls, setPolls] = useState<Result[]>([]);
  const [merchant, setMerchant] = useState<{ address: string; signing: string; scopes: string[] } | undefined>();
  /// The chain of the key in use. Explorer links follow it.
  const [chainId, setChainId] = useState<number>(DEFAULT_CHAIN_ID);
  const [search, setSearch] = useState("");
  const [signing, setSigning] = useState<string | undefined>();
  const stopPoll = useRef(false);

  // The key stays in this tab only (sessionStorage), never on our servers.
  useEffect(() => {
    void (async () => {
      setValues(initialValues(Math.random().toString(36).slice(2, 8)));
      const stored = sessionStorage.getItem(KEY_STORAGE);
      if (stored) {
        setApiKey(stored);
        if (/^sk_test_[A-Za-z0-9]{40}$/.test(stored)) void lookup(stored);
      }
      const hash = window.location.hash.slice(1);
      if (ENDPOINTS.some((e) => e.id === hash)) setSelectedId(hash);
    })();
  }, []);

  const endpoint = ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[0]!;
  const v = values[endpoint.id] ?? {};
  const result = results[endpoint.id];
  const keyValid = /^sk_test_[A-Za-z0-9]{40}$/.test(apiKey.trim());

  function saveKey(next: string) {
    setApiKey(next);
    setMerchant(undefined);
    setChainId(DEFAULT_CHAIN_ID);
    if (/^sk_test_[A-Za-z0-9]{40}$/.test(next.trim())) void lookup(next.trim());
    if (next) sessionStorage.setItem(KEY_STORAGE, next);
    else sessionStorage.removeItem(KEY_STORAGE);
  }

  function setValue(name: string, value: string) {
    setValues((all) => ({ ...all, [endpoint.id]: { ...all[endpoint.id], [name]: value } }));
  }

  /// Opens a method, filling its id inputs from what the playground saw last.
  const select = useCallback(
    (id: string) => {
      const e = ENDPOINTS.find((x) => x.id === id);
      if (!e) return;
      setValues((all) => {
        const current = { ...all[id] };
        for (const f of e.fields) if (f.from && !current[f.name] && saved[f.from]) current[f.name] = saved[f.from]!;
        return { ...all, [id]: current };
      });
      setSelectedId(id);
      setPolls([]);
      window.history.replaceState(null, "", `#${id}`);
    },
    [saved],
  );

  function remember(r: Result) {
    const seen = chainFrom(r.body);
    if (seen) setChainId(seen);
    const ids = idsFrom(r.body);
    if (ids.order || ids.subscription || ids.pending) setSaved((s) => ({ ...s, ...ids }));
  }

  /// Asks the API who a key is for, so the chain (and its explorer) is known before the first call.
  async function lookup(key: string): Promise<Result> {
    const r = await callApi(key, "GET", "/v1/merchant");
    const b = r.body as { address?: string; signing?: string; chainId?: number; key?: { scopes: string[] } };
    if (r.status === 200 && b.address) setMerchant({ address: b.address, signing: b.signing ?? "", scopes: b.key?.scopes ?? [] });
    if (r.status === 200 && b.chainId && CHAINS[b.chainId]) setChainId(b.chainId);
    return r;
  }

  async function checkKey() {
    const r = await lookup(apiKey.trim());
    setResults((all) => ({ ...all, merchant: r }));
    if (r.status !== 200) select("merchant");
  }

  async function run() {
    const missing = missingFields(endpoint, v);
    if (missing.length) return;
    setRunning(true);
    try {
      if (endpoint.poll) return await poll();
      const r = await callApi(endpoint.auth === false ? "" : apiKey.trim(), endpoint.method, pathFor(endpoint, v), bodyFor(endpoint, v));
      setResults((all) => ({ ...all, [endpoint.id]: r }));
      remember(r);
    } finally {
      setRunning(false);
    }
  }

  /// waitForPayment, in the page: confirm every few seconds until paid, closed, or stopped.
  async function poll() {
    stopPoll.current = false;
    setPolls([]);
    const path = pathFor(endpoint, v);
    for (let i = 0; i < 400 && !stopPoll.current; i++) {
      const r = await callApi(apiKey.trim(), "POST", path, {});
      setPolls((p) => [r, ...p].slice(0, 30));
      setResults((all) => ({ ...all, [endpoint.id]: r }));
      const status = (r.body as { status?: string })?.status;
      if (r.status !== 200 || PAID.has(status ?? "") || ENDED.has(status ?? "")) return;
      await new Promise((ok) => setTimeout(ok, 4000));
    }
  }

  /// A self-signing merchant's transaction, signed in the browser wallet and submitted, until the action is done.
  async function signWithWallet(pending: { id: string; from: string; to: string; data: string; value: string; chainId: number }) {
    setSigning(pending.id);
    try {
      let current: typeof pending | undefined = pending;
      while (current) {
        const account = await connectWallet(current.chainId);
        if (account.toLowerCase() !== current.from.toLowerCase()) throw new Error(`Connect the merchant wallet ${current.from}; this wallet is ${account}`);
        const txHash = (await metamask()!.request({ method: "eth_sendTransaction", params: [{ from: account, to: current.to, data: current.data, value: toHex(BigInt(current.value)) }] })) as string;
        const r = await callApi(apiKey.trim(), "POST", `/v1/transactions/${current.id}/submit`, { txHash });
        setResults((all) => ({ ...all, [endpoint.id]: r }));
        remember(r);
        const next = (r.body as { object?: string; transaction?: typeof pending })?.object === "pending_transaction" && r.status === 202 ? (r.body as { transaction: typeof pending }).transaction : undefined;
        current = next;
      }
    } catch (error) {
      setResults((all) => ({
        ...all,
        [endpoint.id]: { status: 0, durationMs: 0, headers: {}, body: { error: { code: "WALLET", message: error instanceof Error ? error.message : String(error) } }, at: new Date().toISOString(), request: { method: "POST", path: "wallet" } },
      }));
    } finally {
      setSigning(undefined);
    }
  }

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return ENDPOINTS.filter((e) => !s || [e.title, e.id, e.path].join(" ").toLowerCase().includes(s));
  }, [search]);

  const missing = missingFields(endpoint, v);
  const needsKey = endpoint.auth !== false && !keyValid;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/app" className="grid size-9 place-items-center rounded-full border bg-card shadow-soft transition-colors hover:bg-muted" aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Link>
            <Logo withText />
            <span className="hidden rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">API playground</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://www.npmjs.com/package/sword-merchant" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex">
              <BookOpen className="size-3.5" /> sword-merchant on npm
            </a>
            <ModeToggle />
          </div>
        </div>
        <KeyBar chainId={chainId} apiKey={apiKey} showKey={showKey} keyValid={keyValid} merchant={merchant} onShow={() => setShowKey((s) => !s)} onChange={saveKey} onCheck={() => void checkKey()} apiBase={apiBase} />
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b lg:sticky lg:top-[7.5rem] lg:h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search methods" className="h-9 rounded-lg pl-9" />
            </div>
          </div>
          <nav className="space-y-4 px-3 pb-6">
            {GROUPS.map((g) => {
              const items = visible.filter((e) => e.group === g);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{g}</p>
                  {items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => select(e.id)}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors", e.id === endpoint.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                    >
                      <span className={cn("w-10 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[10px] font-semibold ring-1", METHOD_TONE[e.method])}>{e.method}</span>
                      <span className="truncate">{e.title}</span>
                      {results[e.id] && <span className={cn("ml-auto font-mono text-[10px]", statusTone(results[e.id]!.status))}>{results[e.id]!.status || "!"}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-8 md:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={endpoint.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{endpoint.group}</span>
                  <ChevronRight className="size-3" />
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{endpoint.sdk({}).startsWith("//") ? endpoint.id : `sword.${endpoint.id}()`}</code>
                  {endpoint.scope && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                      <ShieldCheck className="size-3" /> {endpoint.scope}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{endpoint.title}</h1>
                <p className="max-w-3xl text-[15px] text-muted-foreground">{endpoint.summary}</p>
                {endpoint.notes && (
                  <ul className="max-w-3xl space-y-1 text-sm text-muted-foreground">
                    {endpoint.notes.map((n) => (
                      <li key={n} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-soft">
                <span className={cn("rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold ring-1", METHOD_TONE[endpoint.method])}>{endpoint.method}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-sm">
                  <span className="text-muted-foreground">{apiBase}</span>
                  {pathFor(endpoint, v)}
                </code>
                {endpoint.poll && running ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => (stopPoll.current = true)}>
                    <Square className="size-3.5" /> Stop
                  </Button>
                ) : (
                  <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={running || missing.length > 0 || needsKey} onClick={() => void run()}>
                    {running ? <Spinner /> : <Play className="size-3.5 fill-current" />} Try it
                  </Button>
                )}
              </div>
              {(needsKey || missing.length > 0) && (
                <p className="-mt-3 text-xs text-muted-foreground">{needsKey ? "Paste a test API key above to try it." : `Fill in ${missing.join(", ")} to try it.`}</p>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <Parameters endpoint={endpoint} values={v} saved={saved} onChange={setValue} />
                <div className="space-y-6">
                  <CodeSample endpoint={endpoint} values={v} apiBase={apiBase} />
                  <Responses
                    chainId={chainId}
                    endpoint={endpoint}
                    result={result}
                    polls={polls}
                    running={running}
                    signing={signing}
                    onSign={(p) => void signWithWallet(p)}
                    onUse={(id) => select(id)}
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/// The key bar under the header: the test key, a check of who it is for, and where calls go.
function KeyBar({
  chainId,
  apiKey,
  showKey,
  keyValid,
  merchant,
  onShow,
  onChange,
  onCheck,
  apiBase,
}: {
  chainId: number;
  apiKey: string;
  showKey: boolean;
  keyValid: boolean;
  merchant: { address: string; signing: string; scopes: string[] } | undefined;
  onShow: () => void;
  onChange: (v: string) => void;
  onCheck: () => void;
  apiBase: string;
}) {
  const signingText: Record<string, string> = { relayer: "Sword signs", permission: "Sword signs within your permission", self: "your wallet signs" };
  return (
    <div className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <KeyRound className="size-3.5" /> API key
        </div>
        <div className="relative min-w-[280px] flex-1 md:max-w-xl">
          <Input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk_test_… from the Developers page"
            autoComplete="off"
            spellCheck={false}
            className={cn("h-9 rounded-lg pr-20 font-mono text-xs", apiKey && !keyValid && "border-destructive/60")}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
            <button type="button" onClick={onShow} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground" aria-label={showKey ? "Hide key" : "Show key"}>
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            {apiKey && (
              <button type="button" onClick={() => onChange("")} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-destructive" aria-label="Clear key">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={!keyValid} onClick={onCheck}>
          <Zap className="size-3.5" /> Check key
        </Button>
        {merchant ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" />
            <span className="font-mono">{short(merchant.address, 6, 4)}</span> · {CHAINS[chainId]?.chain.name} · {signingText[merchant.signing] ?? merchant.signing} · {merchant.scopes.length} scopes
          </span>
        ) : apiKey && !keyValid ? (
          <span className="text-xs text-destructive">Test keys look like sk_test_ followed by 40 letters and digits.</span>
        ) : (
          <span className="text-xs text-muted-foreground">Test keys only. It stays in this tab and is sent to {apiBase} through our server, never stored.</span>
        )}
      </div>
    </div>
  );
}

function Parameters({ endpoint, values, saved, onChange }: { endpoint: Endpoint; values: Values; saved: Saved; onChange: (name: string, value: string) => void }) {
  const sections: { title: string; place: Field["in"] }[] = [
    { title: "Path parameters", place: "path" },
    { title: "Query parameters", place: "query" },
    { title: "Body", place: "body" },
  ];
  const any = endpoint.fields.length > 0;
  return (
    <section className="space-y-5">
      {endpoint.auth !== false && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Authorization</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <code className="font-mono">Authorization: Bearer sk_test_…</code> · sword-merchant sends it from <code className="font-mono">apiKey</code> or <code className="font-mono">SWORD_API_KEY</code>.
          </p>
        </div>
      )}
      {!any && <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">This call takes no inputs.</p>}
      {sections.map((s) => {
        const fields = endpoint.fields.filter((f) => f.in === s.place);
        if (!fields.length) return null;
        return (
          <div key={s.place} className="rounded-2xl border bg-card">
            <p className="border-b px-4 py-3 text-sm font-semibold">{s.title}</p>
            <div className="divide-y">
              {fields.map((f) => {
                const last = f.from ? saved[f.from] : undefined;
                return (
                  <div key={f.name} className="space-y-2 px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm font-semibold">{f.name}</code>
                      <span className="text-xs text-muted-foreground">{f.type}</span>
                      {f.required ? <span className="text-xs font-medium text-destructive">required</span> : <span className="text-xs text-muted-foreground">optional</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                    <Input
                      value={values[f.name] ?? ""}
                      onChange={(e) => onChange(f.name, e.target.value)}
                      placeholder={f.placeholder ?? f.example ?? ""}
                      inputMode={f.type === "integer" ? "numeric" : undefined}
                      spellCheck={false}
                      className="h-9 rounded-lg font-mono text-xs"
                    />
                    {last && values[f.name] !== last && (
                      <button type="button" onClick={() => onChange(f.name, last)} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                        Use last {f.from}: <span className="font-mono">{short(last, 6, 4)}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function CodeSample({ endpoint, values, apiBase }: { endpoint: Endpoint; values: Values; apiBase: string }) {
  const [lang, setLang] = useState<"node" | "curl">("node");
  const code = lang === "node" ? nodeSample(endpoint, values) : curlSample(endpoint, values, apiBase);
  return (
    <div className="overflow-hidden rounded-2xl border bg-[oklch(0.16_0.02_275)] text-white shadow-soft">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-xs font-medium text-white/70">{endpoint.title}</p>
        <div className="flex items-center gap-1">
          {(["node", "curl"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={cn("rounded-md px-2 py-1 text-xs", lang === l ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80")}>
              {l === "node" ? "Node · sword-merchant" : "cURL"}
            </button>
          ))}
          <CopyButton value={code} label="" className="h-7 px-2 text-white/60 hover:bg-white/10 hover:text-white" />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.65] text-white/85">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type PendingTx = { id: string; from: string; to: string; data: string; value: string; chainId: number; action?: string; step?: string };

function Responses({
  chainId,
  endpoint,
  result,
  polls,
  running,
  signing,
  onSign,
  onUse,
}: {
  chainId: number;
  endpoint: Endpoint;
  result: Result | undefined;
  polls: Result[];
  running: boolean;
  signing: string | undefined;
  onSign: (p: PendingTx) => void;
  onUse: (endpointId: string) => void;
}) {
  const codes = Object.keys(endpoint.responses).map(Number);
  const [tab, setTab] = useState<"live" | number>(result ? "live" : codes[0] ?? 200);
  const shownTab = tab === "live" && !result ? codes[0] ?? 200 : tab;
  const live = shownTab === "live" ? result : undefined;

  // A new answer is shown as soon as it arrives.
  const at = result?.at;
  const [seen, setSeen] = useState(at);
  if (at !== seen) {
    setSeen(at);
    setTab("live");
  }

  const body = live ? live.body : endpoint.responses[shownTab as number]?.body;
  const b = (body ?? {}) as { object?: string; checkoutUrl?: string; subscribeUrl?: string; transaction?: PendingTx | string; status?: string };
  const pending = live && live.status === 202 && b.object === "pending_transaction" && typeof b.transaction === "object" ? b.transaction : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border bg-[oklch(0.16_0.02_275)] text-white shadow-soft">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2">
        {result && (
          <button type="button" onClick={() => setTab("live")} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", shownTab === "live" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80")}>
            <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-sky-400" : "bg-emerald-400")} /> Live · <span className={statusTone(result.status)}>{result.status || "error"}</span>
          </button>
        )}
        {codes.map((c) => (
          <button key={c} type="button" onClick={() => setTab(c)} className={cn("rounded-md px-2.5 py-1 font-mono text-xs", shownTab === c ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80")}>
            {c}
          </button>
        ))}
        <div className="ml-auto">
          <CopyButton value={JSON.stringify(body, null, 2)} label="" className="h-7 px-2 text-white/60 hover:bg-white/10 hover:text-white" />
        </div>
      </div>

      {live ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 px-4 py-2 font-mono text-[11px] text-white/55">
          <span>
            {live.request.method} {live.request.path}
          </span>
          <span className={statusTone(live.status)}>{live.status || "failed"}</span>
          <span>{live.durationMs} ms</span>
          {live.headers["x-ratelimit-remaining"] && (
            <span>
              rate limit {live.headers["x-ratelimit-remaining"]}/{live.headers["x-ratelimit-limit"]} left
            </span>
          )}
          {live.headers["retry-after"] && <span>retry after {live.headers["retry-after"]}s</span>}
        </div>
      ) : (
        <p className="border-b border-white/10 px-4 py-2 text-xs text-white/55">Example · {endpoint.responses[shownTab as number]?.description}</p>
      )}

      {live && (b.checkoutUrl || b.subscribeUrl || pending || (b.object === "order" || b.object === "subscription")) && (
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-2.5">
          {b.checkoutUrl && (
            <a href={b.checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
              <ExternalLink className="size-3.5" /> Open checkout
            </a>
          )}
          {b.subscribeUrl && (
            <a href={b.subscribeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
              <ExternalLink className="size-3.5" /> Open subscribe page
            </a>
          )}
          {b.object === "order" && (
            <>
              <button type="button" onClick={() => onUse("orders.waitForPayment")} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
                Wait for its payment →
              </button>
              <button type="button" onClick={() => onUse("orders.refund")} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
                Refund it →
              </button>
            </>
          )}
          {b.object === "subscription" && (
            <button type="button" onClick={() => onUse("subscriptions.charge")} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
              Charge its next period →
            </button>
          )}
          {typeof b.transaction === "string" && (
            <a href={explorerTx(chainId, b.transaction)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15">
              <ExternalLink className="size-3.5" /> Transaction on the explorer
            </a>
          )}
        </div>
      )}

      {pending && (
        <div className="space-y-2 border-b border-white/10 bg-sky-500/10 px-4 py-3 text-xs">
          <p className="font-medium text-sky-200">Your merchant signs its own transactions.</p>
          <p className="text-white/70">
            Step <span className="font-mono">{pending.step}</span> of <span className="font-mono">{pending.action}</span> must be signed by <span className="font-mono">{short(pending.from, 6, 4)}</span>. On your server, sword-merchant does this with{" "}
            <code className="font-mono">privateKey</code>. Here you can sign it with that wallet in MetaMask.
          </p>
          {hasMetaMask() ? (
            <Button size="sm" className="h-8 rounded-lg bg-sky-500 text-white hover:bg-sky-500/90" disabled={!!signing} onClick={() => onSign(pending)}>
              {signing ? <Spinner /> : <Wallet className="size-3.5" />} {signing ? "Waiting for the wallet…" : "Sign with wallet and submit"}
            </Button>
          ) : (
            <p className="text-white/50">Install MetaMask to sign here, or use sword-merchant with privateKey.</p>
          )}
        </div>
      )}

      {endpoint.poll && polls.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-b border-white/10 px-4 py-2 font-mono text-[11px] text-white/60">
          {polls.map((p) => (
            <div key={p.at}>
              {new Date(p.at).toLocaleTimeString()} · {p.status} · {(p.body as { status?: string })?.status ?? (p.body as { error?: { code: string } })?.error?.code}
            </div>
          ))}
        </div>
      )}

      <div className="max-h-[560px] overflow-auto p-4">
        {running && live === undefined && !result ? (
          <p className="flex items-center gap-2 text-xs text-white/60">
            <Spinner /> Calling the API…
          </p>
        ) : (
          <JsonView value={body} explorer={explorerOf(chainId)} />
        )}
      </div>
    </div>
  );
}
