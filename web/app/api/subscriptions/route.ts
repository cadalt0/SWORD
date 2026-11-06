import type { Hex } from "viem";

import { periodSecondsOf } from "@/lib/shared/billing";
import { accountOfUser, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { recordEvent, saveSubscriptionOrder, subscriptionOrderById, subscriptionOrdersOf } from "@/lib/server/repo";
import { relayerSdk } from "@/lib/server/sdk";
import { collectDue, readState } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

async function merchant() {
  const { user, accounts } = await requireUser();
  if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants manage subscriptions");
  return { user, account: accountOfUser(accounts, user) };
}

/// Validates the fields of a new subscription.
function termsFrom(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  // The length of one period: exact seconds, or days (which may be a fraction for periods shorter than a day).
  const periodSeconds = body.periodSeconds !== undefined ? Number(body.periodSeconds) : periodSecondsOf(Number(body.periodDays));
  const periods = Number(body.periods);
  if (!name || name.length > 80) throw new HttpError(400, "INVALID_INPUT", "Give the subscription a name of up to 80 characters");
  if (!reference) throw new HttpError(400, "INVALID_INPUT", "reference is required");
  if (!/^\d+(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) throw new HttpError(400, "INVALID_INPUT", "Enter a price above zero");
  if (!Number.isInteger(periodSeconds) || periodSeconds < 10 || periodSeconds > 365 * 86_400) throw new HttpError(400, "INVALID_INPUT", "Billing period must be 10 seconds to 365 days");
  if (!Number.isInteger(periods) || periods < 1 || periods > 120) throw new HttpError(400, "INVALID_INPUT", "Number of payments must be 1 to 120");
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 280) : null;
  return { name, reference, amount, periodSeconds, periods, description };
}

/// GET ?chainId: every subscription the merchant created, with its state read from the chain.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { account } = await merchant();
    const rows = await subscriptionOrdersOf(account.address, chainId);
    const states = await Promise.all(rows.map((r) => readState(r).catch(() => null)));
    return Response.json({ subscriptions: states.filter((s) => s !== null) });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST actions, sent by the relayer:
///   create {name, reference, amount, periodSeconds | periodDays, periods, description?}: a new subscription with its own deposit address.
///   collect: pulls every period that is due.
///   cancel | withdraw {id}
///   refund {id, amount, note?}: any amount, at any time.
///   deny {id}: closes the customer's refund request.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await merchant();
    const sdk = relayerSdk(chainId);
    const smart = !account.is_eoa;

    if (body.action === "create") {
      const t = termsFrom(body);
      const created = smart
        ? await sdk.accounts.merchant.createSubscription({ account: account.address, reference: t.reference, amount: t.amount, periodSeconds: t.periodSeconds, periods: t.periods })
        : await sdk.subscriptions.create({ merchant: account.address, reference: t.reference, amount: t.amount, periodSeconds: t.periodSeconds, periods: t.periods });
      await saveSubscriptionOrder({ id: created.id, chainId, merchantAddress: account.address, vault: created.vault, ...t });
      await recordEvent({ userId: user.id, type: "subscription.created", details: { chainId, subscriptionId: created.id.toLowerCase(), name: t.name, amount: t.amount }, txHash: created.transaction.hash });
      return Response.json({ id: created.id.toLowerCase(), vault: created.vault, hash: created.transaction.hash });
    }

    if (body.action === "collect") {
      const outcomes = await collectDue(await subscriptionOrdersOf(account.address, chainId));
      return Response.json({ charged: outcomes.reduce((n, o) => n + o.charged, 0), failed: outcomes.filter((o) => o.error).map((o) => ({ id: o.id, reason: o.error })) });
    }

    const row = await subscriptionOrderById(typeof body.id === "string" ? body.id : "");
    if (!row || row.merchant_address.toLowerCase() !== account.address.toLowerCase()) throw new HttpError(404, "NOT_FOUND", "No such subscription");
    const id = row.id as Hex;
    const details = { chainId, subscriptionId: row.id, name: row.name };

    if (body.action === "cancel") {
      const tx = await sdk.subscriptions.cancel(id);
      await recordEvent({ userId: user.id, type: "subscription.cancelled", details, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    if (body.action === "withdraw") {
      const held = (await sdk.subscriptions.get(id)).held;
      const tx = await sdk.subscriptions.withdraw(id);
      await recordEvent({ userId: user.id, type: "subscription.withdrawn", details: { ...details, amount: (Number(held) / 1e6).toString() }, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    if (body.action === "refund") {
      if (typeof body.amount !== "string") throw new HttpError(400, "INVALID_INPUT", "amount is required");
      const note = typeof body.note === "string" ? body.note : "";
      const tx = smart
        ? await sdk.accounts.merchant.refundSubscription({ account: account.address, id, amount: body.amount, note })
        : await sdk.subscriptions.refund({ id, amount: body.amount, note });
      await recordEvent({ userId: user.id, type: "subscription.refunded", details: { ...details, amount: body.amount }, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    if (body.action === "deny") {
      const tx = smart ? await sdk.accounts.merchant.denySubscriptionRefund({ account: account.address, id }) : await sdk.subscriptions.deny({ id });
      await recordEvent({ userId: user.id, type: "subscription.refund_denied", details, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    throw new HttpError(400, "INVALID_ACTION", "Unknown action");
  } catch (error) {
    return errorResponse(error);
  }
}
