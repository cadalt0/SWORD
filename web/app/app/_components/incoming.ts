"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { CHAINS } from "sword-sdk";

import { publicRpcFor } from "@/lib/client/wallet";

/// USDT that arrived in an account, shown in the customer's activity as "Received".
export type Incoming = { hash: string; from: string; amount: string; at: string };

type Cache = { scannedTo: string; items: Incoming[] };

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
/// The RPC answers log queries over at most about 5,000 blocks (one block is about one second).
const CHUNK = BigInt(5000);
/// First visit: look back one day. Later visits: scan only new blocks, at most three days back.
const FIRST_LOOKBACK = BigInt(86400);
const MAX_LOOKBACK = BigInt(3) * BigInt(86400);
const PARALLEL = 6;
const KEEP = 50;

const keyOf = (chainId: number, address: string) => `wm-incoming:${chainId}:${address.toLowerCase()}`;

function readCache(key: string): Cache | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cache) : undefined;
  } catch {
    return undefined;
  }
}

/// Finds incoming USDT transfers to an account. Results are kept in the browser so each visit only scans new blocks.
export function useIncomingTransfers(chainId: number, address: string): Incoming[] | undefined {
  const [items, setItems] = useState<Incoming[] | undefined>(() => (typeof window === "undefined" ? undefined : readCache(keyOf(chainId, address))?.items));

  useEffect(() => {
    let live = true;
    const key = keyOf(chainId, address);
    const cached = readCache(key);

    (async () => {
      const client = createPublicClient({ transport: http(publicRpcFor(chainId)) });
      const usdt = CHAINS[chainId].addresses.usdt;
      const latest = await client.getBlockNumber();
      const floor = latest > MAX_LOOKBACK ? latest - MAX_LOOKBACK : BigInt(0);
      let from = cached ? BigInt(cached.scannedTo) + BigInt(1) : latest > FIRST_LOOKBACK ? latest - FIRST_LOOKBACK : BigInt(0);
      if (from < floor) from = floor;

      const ranges: [bigint, bigint][] = [];
      for (let start = from; start <= latest; start += CHUNK) {
        const end = start + CHUNK - BigInt(1) < latest ? start + CHUNK - BigInt(1) : latest;
        ranges.push([start, end]);
      }

      const logs: { hash: string; from: string; value: bigint; block: bigint }[] = [];
      for (let i = 0; i < ranges.length; i += PARALLEL) {
        const batch = await Promise.all(
          ranges.slice(i, i + PARALLEL).map(([fromBlock, toBlock]) =>
            client.getLogs({ address: usdt, event: TRANSFER, args: { to: address as Address }, fromBlock, toBlock }).catch(() => []),
          ),
        );
        for (const list of batch) {
          for (const log of list) {
            logs.push({ hash: log.transactionHash ?? "", from: log.args.from ?? "", value: log.args.value ?? BigInt(0), block: log.blockNumber ?? BigInt(0) });
          }
        }
      }

      const blocks = [...new Set(logs.map((l) => l.block))].slice(-20);
      const times = new Map<bigint, string>();
      await Promise.all(
        blocks.map(async (b) => {
          const block = await client.getBlock({ blockNumber: b }).catch(() => undefined);
          if (block) times.set(b, new Date(Number(block.timestamp) * 1000).toISOString());
        }),
      );

      const fresh: Incoming[] = logs
        .filter((l) => times.has(l.block))
        .map((l) => ({ hash: l.hash, from: l.from, amount: (Number(l.value) / 1e6).toString(), at: times.get(l.block)! }));
      const seen = new Set<string>();
      const merged = [...fresh, ...(cached?.items ?? [])]
        .filter((it) => (seen.has(it.hash) ? false : (seen.add(it.hash), true)))
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))
        .slice(0, KEEP);

      try {
        localStorage.setItem(key, JSON.stringify({ scannedTo: latest.toString(), items: merged } satisfies Cache));
      } catch {
        // storage full or blocked: the list still shows for this visit
      }
      if (live) setItems(merged);
    })().catch(() => {
      if (live) setItems(cached?.items ?? []);
    });

    return () => {
      live = false;
    };
  }, [chainId, address]);

  return items;
}
