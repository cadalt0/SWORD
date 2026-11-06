import type { Hex } from "viem";

import { accountOfUser, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { recordEvent, subscriptionOrderById } from "@/lib/server/repo";
import { relayerSdk } from "@/lib/server/sdk";
import { recordStart } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

/// A signed-in customer acting on a subscription from their Sword account. The relayer sends the transaction: for a
/// custodial account always, and for a self-custody account within the permission the owner signed.
///   subscribe {id}: takes an open subscription and pays its first period.
///   cancel {id}
///   refund {id, amount, reason}: asks the merchant for a refund.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers act on their subscriptions");
    const account = accountOfUser(accounts, user);
    const row = await subscriptionOrderById(typeof body.id === "string" ? body.id : "");
    if (!row) throw new HttpError(404, "NOT_FOUND", "This subscription does not exist");
    const sdk = relayerSdk(chainId);
    const id = row.id as Hex;
    const details = { chainId, subscriptionId: row.id, name: row.name };

    if (body.action === "subscribe") {
      const tx = await sdk.accounts.customer.subscribe({ account: account.address, id });
      await recordStart(row, account.address, tx.hash);
      await recordEvent({ userId: user.id, type: "subscription.subscribed", details: { ...details, amount: Number(row.amount).toString() }, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    if (body.action === "cancel") {
      const tx = await sdk.accounts.customer.cancelSubscription({ account: account.address, id });
      await recordEvent({ userId: user.id, type: "subscription.cancelled", details, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    if (body.action === "refund") {
      if (typeof body.amount !== "string" || typeof body.reason !== "string") throw new HttpError(400, "INVALID_INPUT", "amount and reason are required");
      const tx = await sdk.accounts.customer.requestSubscriptionRefund({ account: account.address, id, amount: body.amount, reason: body.reason });
      await recordEvent({ userId: user.id, type: "refund.requested", details: { ...details, amount: body.amount }, txHash: tx.hash });
      return Response.json({ hash: tx.hash });
    }
    throw new HttpError(400, "INVALID_ACTION", "Unknown action");
  } catch (error) {
    return errorResponse(error);
  }
}
