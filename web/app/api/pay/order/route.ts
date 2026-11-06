import { checkoutOriginAllowed } from "@/lib/server/developers";
import { relayerSdk } from "@/lib/server/sdk";
import { addressFrom, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { orderReference } from "@/lib/server/repo";
import { fiatPaymentFor, paidWithOf } from "@/lib/server/fiat";

export const runtime = "nodejs";

/// Public: the details a payer needs to pay an order. No login. Contains nothing secret.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const chainId = chainIdFrom(params.get("chain"));
    const merchant = addressFrom(params.get("merchant"), "Merchant ID");
    const orderId = params.get("order") ?? "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) throw new HttpError(400, "INVALID_ORDER", "Order ID is not valid");

    const [order, reference, fiat] = await Promise.all([
      relayerSdk(chainId).orders.get(merchant, orderId as `0x${string}`),
      orderReference(chainId, merchant, orderId),
      fiatPaymentFor("order", chainId, merchant, orderId),
    ]);
    // Paid in local money: paid, whatever the chain still says.
    const status = fiat && order.status === "open" ? "paid" : order.status;
    const open = status === "open" && Date.now() / 1000 <= Number(order.expiresAt);
    // Opened by the checkout widget: may this page report the result back to the site that opened it?
    const origin = params.get("origin");
    const originAllowed = origin ? await checkoutOriginAllowed(merchant, chainId, origin) : undefined;
    return Response.json({
      chainId,
      merchant,
      orderId,
      reference,
      amount: order.amount.toString(),
      collector: order.collector,
      status: open ? "pending" : status === "open" ? "expired" : status,
      paidWith: paidWithOf(fiat),
      open,
      expiresAt: order.expiresAt.toString(),
      originAllowed,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
