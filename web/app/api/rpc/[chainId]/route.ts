import { CHAINS } from "sword-sdk";

import { rpcUrlFor } from "@/lib/server/rpc";

export const runtime = "nodejs";

/// The browser's way to read a chain. Browser shields and ad blockers often block public blockchain RPC addresses
/// (net::ERR_BLOCKED_BY_CLIENT), so the page asks this site instead, and this route asks the chain's RPC.
/// Only reading is allowed: transactions are signed and sent by the user's own wallet, never through here.
///
/// POST /api/rpc/<chainId> with a JSON-RPC request (or a batch of them).

const READ_METHODS = new Set([
  "eth_chainId",
  "net_version",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionCount",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getLogs",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
]);
const MAX_BATCH = 20;
const MAX_BODY = 64 * 1024;

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown };

const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function POST(request: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const chainId = Number((await params).chainId);
  if (!CHAINS[chainId]) return Response.json(fail(null, -32602, `Sword does not run on chain ${(await params).chainId}`), { status: 404 });

  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json(fail(null, -32600, "Request too large"), { status: 413 });
  let body: RpcRequest | RpcRequest[];
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json(fail(null, -32700, "Parse error"), { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH) return Response.json(fail(null, -32600, `Send 1 to ${MAX_BATCH} calls`), { status: 400 });
  for (const c of calls) {
    if (typeof c?.method !== "string" || !READ_METHODS.has(c.method)) {
      return Response.json(fail(c?.id, -32601, `Only reading is allowed here; ${String(c?.method)} is not`), { status: 400 });
    }
  }

  try {
    const res = await fetch(rpcUrlFor(chainId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  } catch (error) {
    return Response.json(fail(Array.isArray(body) ? null : body.id, -32603, `The chain's RPC did not answer: ${error instanceof Error ? error.message : String(error)}`), { status: 502 });
  }
}
