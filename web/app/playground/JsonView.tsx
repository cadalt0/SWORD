"use client";

import type { ReactNode } from "react";

/// Pretty JSON with colours, where web links open, transaction hashes and addresses link to the explorer.

const URL_RE = /^https?:\/\/\S+$/;
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
/// Keys whose 64-hex values are ids, not transactions, so they are not linked to the explorer.
const ID_KEYS = new Set(["id", "orderId", "subscriptionId"]);

function link(href: string, children: ReactNode) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:decoration-solid">
      {children}
    </a>
  );
}

function StringValue({ value, keyName, explorer }: { value: string; keyName?: string; explorer: string }) {
  const text = JSON.stringify(value);
  if (URL_RE.test(value)) return <span className="text-sky-300">{link(value, text)}</span>;
  if (TX_RE.test(value) && !ID_KEYS.has(keyName ?? "")) return <span className="text-amber-200">{link(`${explorer}/tx/${value}`, text)}</span>;
  if (ADDRESS_RE.test(value)) return <span className="text-amber-200">{link(`${explorer}/address/${value}`, text)}</span>;
  return <span className="text-emerald-300">{text}</span>;
}

function Node({ value, keyName, depth, explorer, last }: { value: unknown; keyName?: string; depth: number; explorer: string; last: boolean }) {
  const pad = "  ".repeat(depth);
  const comma = last ? "" : ",";
  const label = keyName !== undefined ? <span className="text-violet-300">{JSON.stringify(keyName)}</span> : null;
  const prefix = (
    <>
      {pad}
      {label}
      {label && <span className="text-white/50">: </span>}
    </>
  );

  if (Array.isArray(value)) {
    if (value.length === 0)
      return (
        <div>
          {prefix}
          <span className="text-white/60">[]</span>
          {comma}
        </div>
      );
    return (
      <>
        <div>
          {prefix}
          <span className="text-white/60">[</span>
        </div>
        {value.map((v, i) => (
          <Node key={i} value={v} depth={depth + 1} explorer={explorer} last={i === value.length - 1} />
        ))}
        <div>
          {pad}
          <span className="text-white/60">]</span>
          {comma}
        </div>
      </>
    );
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0)
      return (
        <div>
          {prefix}
          <span className="text-white/60">{"{}"}</span>
          {comma}
        </div>
      );
    return (
      <>
        <div>
          {prefix}
          <span className="text-white/60">{"{"}</span>
        </div>
        {entries.map(([k, v], i) => (
          <Node key={k} keyName={k} value={v} depth={depth + 1} explorer={explorer} last={i === entries.length - 1} />
        ))}
        <div>
          {pad}
          <span className="text-white/60">{"}"}</span>
          {comma}
        </div>
      </>
    );
  }
  let shown: ReactNode;
  if (typeof value === "string") shown = <StringValue value={value} keyName={keyName} explorer={explorer} />;
  else if (typeof value === "number") shown = <span className="text-orange-300">{value}</span>;
  else if (typeof value === "boolean") shown = <span className="text-pink-300">{String(value)}</span>;
  else shown = <span className="text-white/40">null</span>;
  return (
    <div>
      {prefix}
      {shown}
      {comma}
    </div>
  );
}

export function JsonView({ value, explorer }: { value: unknown; explorer: string }) {
  if (typeof value === "string") return <pre className="whitespace-pre-wrap break-all text-white/80">{value}</pre>;
  return (
    <div className="whitespace-pre font-mono text-[12.5px] leading-[1.65] text-white/85">
      <Node value={value} depth={0} explorer={explorer} last />
    </div>
  );
}
