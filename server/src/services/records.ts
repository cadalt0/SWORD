import { config } from "../config.js";

/// Records what the API did through the website, so orders, subscriptions, activity and notifications are kept in one
/// place. The chain is the source of truth, so a failed record never fails the action: it is logged and skipped.
export type RecordInput = {
  userId: string;
  type: string;
  details: Record<string, unknown>;
  txHash?: string;
  order?: { chainId: number; merchantAddress: string; orderId: string; reference: string; collector: string; amount: string };
  subscription?: { id: string; chainId: number; merchantAddress: string; reference: string; name: string; description?: string | null; amount: string; periodSeconds: number; periods: number; vault: string | null };
};

export async function record(input: RecordInput): Promise<void> {
  try {
    const res = await fetch(`${config.webUrl}/api/internal/record`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sword-internal": config.internalSecret },
      body: JSON.stringify({ ...input, details: { ...input.details, via: "api" } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`record ${input.type} answered ${res.status}: ${await res.text()}`);
  } catch (error) {
    console.warn(`record ${input.type} failed:`, error instanceof Error ? error.message : error);
  }
}
