import { relayerSdk } from "@/lib/server/sdk";
import { addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError, accountOfUser, requireUser } from "@/lib/server/api";
import { recordEvent } from "@/lib/server/repo";

export const runtime = "nodejs";

/// Refund actions. Customers request. Merchants approve, deny, or pay the approved refund from the order balance.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, accounts } = await requireUser();
    const account = accountOfUser(accounts, user);
    if (typeof body.orderId !== "string") throw new HttpError(400, "INVALID_INPUT", "orderId is required");
    const orderId = body.orderId as `0x${string}`;
    const sdk = relayerSdk(chainId);

    if (body.action === "request") {
      if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers request refunds");
      const merchant = addressFrom(body.merchantAddress, "Merchant address");
      if (typeof body.amount !== "string" || typeof body.reason !== "string") {
        throw new HttpError(400, "INVALID_INPUT", "amount and reason are required");
      }
      const result = await sdk.accounts.customer.requestOrderRefund({ account: account.address, merchant, orderId, amount: body.amount, reason: body.reason });
      await recordEvent({ userId: user.id, type: "refund.requested", details: { chainId, orderId, amount: body.amount }, txHash: result.hash });
      return Response.json({ hash: result.hash });
    }

    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants decide refunds");

    if (body.action === "refund") {
      if (typeof body.amount !== "string") throw new HttpError(400, "INVALID_INPUT", "amount is required");
      const note = typeof body.note === "string" ? body.note : "";
      const result = account.is_eoa
        ? await sdk.refunds.refund({ merchant: account.address as `0x${string}`, orderId, amount: body.amount, note })
        : await sdk.accounts.merchant.refund({ account: account.address, orderId, amount: body.amount, note });
      await recordEvent({ userId: user.id, type: "refund.paid", details: { chainId, orderId, initiated: true }, txHash: result.payment.hash });
      return Response.json({ hash: result.payment.hash, approvalHash: result.approval.hash });
    }

    if (account.is_eoa) {
      if (body.action === "approve") {
        if (typeof body.amount !== "string") throw new HttpError(400, "INVALID_INPUT", "amount is required");
        const result = await sdk.refunds.approve({ merchant: account.address as `0x${string}`, orderId, amount: body.amount });
        await recordEvent({ userId: user.id, type: "refund.approved", details: { chainId, orderId }, txHash: result.hash });
        return Response.json({ hash: result.hash });
      }
      if (body.action === "deny") {
        const result = await sdk.refunds.deny({ merchant: account.address as `0x${string}`, orderId, note: typeof body.note === "string" ? body.note : "" });
        await recordEvent({ userId: user.id, type: "refund.denied", details: { chainId, orderId }, txHash: result.hash });
        return Response.json({ hash: result.hash });
      }
      if (body.action === "execute") {
        const result = await sdk.refunds.executeFromBalance(account.address as `0x${string}`, orderId);
        await recordEvent({ userId: user.id, type: "refund.paid", details: { chainId, orderId }, txHash: result.hash });
        return Response.json({ hash: result.hash });
      }
      throw new HttpError(400, "INVALID_ACTION", "Unknown refund action");
    }

    if (body.action === "approve") {
      if (typeof body.amount !== "string") throw new HttpError(400, "INVALID_INPUT", "amount is required");
      const result = await sdk.accounts.merchant.approveRefund({ account: account.address, orderId, amount: body.amount });
      await recordEvent({ userId: user.id, type: "refund.approved", details: { chainId, orderId }, txHash: result.hash });
      return Response.json({ hash: result.hash });
    }
    if (body.action === "deny") {
      const result = await sdk.accounts.merchant.denyRefund({ account: account.address, orderId, note: typeof body.note === "string" ? body.note : "" });
      await recordEvent({ userId: user.id, type: "refund.denied", details: { chainId, orderId }, txHash: result.hash });
      return Response.json({ hash: result.hash });
    }
    if (body.action === "execute") {
      const result = await sdk.accounts.merchant.executeRefundFromBalance({ account: account.address, orderId });
      await recordEvent({ userId: user.id, type: "refund.paid", details: { chainId, orderId }, txHash: result.hash });
      return Response.json({ hash: result.hash });
    }
    throw new HttpError(400, "INVALID_ACTION", "Unknown refund action");
  } catch (error) {
    return errorResponse(error);
  }
}
