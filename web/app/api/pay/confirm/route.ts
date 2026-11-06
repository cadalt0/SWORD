import { addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { confirmTransferPayment } from "@/lib/server/confirm";
import { fiatPaymentFor } from "@/lib/server/fiat";

export const runtime = "nodejs";

/// Public: checks whether an order was paid by a plain wallet transfer (a scanned QR) and, if so, has the relayer
/// mark it paid. No login, so the pay page and the merchant's quick-payment screen can both poll it.
/// The relayer only sends a transaction when the full amount is already in the order's collector.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const merchant = addressFrom(body.merchant, "Merchant ID");
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) throw new HttpError(400, "INVALID_ORDER", "Order ID is not valid");
    if (await fiatPaymentFor("order", chainId, merchant, orderId)) return Response.json({ status: "paid", paid: true, via: "bank" });
    return Response.json(await confirmTransferPayment(chainId, merchant, orderId as `0x${string}`));
  } catch (error) {
    return errorResponse(error);
  }
}
