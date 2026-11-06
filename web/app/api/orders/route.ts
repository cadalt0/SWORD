import { relayerSdk } from "@/lib/server/sdk";
import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { ownAccount } from "@/lib/server/owned";
import { ordersOf, recordEvent, saveOrder, updateOrderStatus } from "@/lib/server/repo";
import { fiatPaymentsOf, paidWithOf } from "@/lib/server/fiat";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";

/// GET: the merchant's orders, with each status read from the chain.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants list orders");

    const sdk = relayerSdk(chainId);
    const [rows, fiat] = await Promise.all([ordersOf(account.address, chainId), fiatPaymentsOf("order", chainId, account.address)]);
    const orders = await Promise.all(
      rows.map(async (row) => {
        try {
          const onChain = await sdk.orders.get(account.address, row.order_id as `0x${string}`);
          const payer = onChain.payer === ZERO ? null : onChain.payer;
          // Paid in local money: paid, whatever the chain still says.
          const paidWith = paidWithOf(fiat.get(row.order_id.toLowerCase()));
          const status = paidWith && onChain.status === "open" ? "paid" : onChain.status;
          await updateOrderStatus({ chainId, merchantAddress: account.address, orderId: row.order_id, status, payer });
          return {
            orderId: row.order_id,
            reference: row.reference,
            amount: row.amount,
            status,
            paidWith,
            payer,
            collector: row.collector,
            createdAt: row.created_at,
            expiresAt: onChain.expiresAt.toString(),
            refundStatus: onChain.refundStatus,
            refundRequestedAmount: onChain.refundRequestedAmount.toString(),
            refundedAmount: onChain.refundedAmount.toString(),
            refundApprovedAmount: onChain.refundApprovedAmount.toString(),
          };
        } catch {
          return {
            orderId: row.order_id,
            reference: row.reference,
            amount: row.amount,
            status: row.status,
            payer: null,
            collector: row.collector,
            createdAt: row.created_at,
            expiresAt: "0",
            refundStatus: "none",
            refundRequestedAmount: "0",
            refundedAmount: "0",
            refundApprovedAmount: "0",
          };
        }
      }),
    );
    return Response.json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {reference, amount, refundDays?}: creates an order on the merchant's account, through the relayer.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants create orders");
    if (typeof body.reference !== "string" || typeof body.amount !== "string") {
      throw new HttpError(400, "INVALID_INPUT", "reference and amount are required");
    }

    const sdk = relayerSdk(chainId);
    const refundDays = body.refundDays === undefined ? undefined : Number(body.refundDays);
    const created = account.is_eoa
      ? await sdk.orders.create({ merchant: account.address as `0x${string}`, reference: body.reference, amount: body.amount, refundDays, relayer: sdk.address }).then((r) => ({ orderId: r.orderId, collector: r.collector, transaction: r.transaction }))
      : await sdk.accounts.merchant.createOrder({ account: account.address, reference: body.reference, amount: body.amount, refundDays });
    await saveOrder({
      chainId,
      merchantAddress: account.address,
      orderId: created.orderId,
      reference: body.reference,
      collector: created.collector,
      amount: body.amount,
    });
    await recordEvent({ userId: user.id, type: "order.created", details: { chainId, orderId: created.orderId }, txHash: created.transaction.hash });
    return Response.json({ orderId: created.orderId, collector: created.collector, hash: created.transaction.hash, amount: body.amount });
  } catch (error) {
    return errorResponse(error);
  }
}
