import { addressFrom, bodyOf, chainIdFrom, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { fiatPaymentFor, saveFiatPayment } from "@/lib/server/fiat";
import { rateFor } from "@/lib/server/fx";
import { merchantAccountByAddress, recordEvent, subscriptionOrderById, updateOrderStatus } from "@/lib/server/repo";
import { relayerSdk } from "@/lib/server/sdk";
import { readState } from "@/lib/server/subscriptions";
import { countryOf } from "@/lib/shared/fiat";

export const runtime = "nodejs";

/// POST: pays an order or a subscription in local money. No login needed (the payer may be anyone); a signed-in
/// customer is remembered as the payer.
///   {kind: "order", chainId, merchant, orderId, country, reference}
///   {kind: "subscription", id, country, reference}
/// `reference` is the id the payer's bank or app showed for the transfer.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const country = countryOf(typeof body.country === "string" ? body.country : undefined);
    if (!country) throw new HttpError(400, "INVALID_INPUT", "Choose a country");
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (reference.length < 4 || reference.length > 64) throw new HttpError(400, "INVALID_INPUT", `Enter the ${country.referenceLabel} from your payment`);
    const rate = await rateFor(country.currency);
    const viewer = await requireUser().catch(() => undefined);
    const customer = viewer?.user.role === "customer" ? viewer.user : undefined;

    if (body.kind === "order") {
      const chainId = chainIdFrom(body.chainId);
      const merchant = addressFrom(body.merchant, "Merchant ID");
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) throw new HttpError(400, "INVALID_ORDER", "Order ID is not valid");
      if (await fiatPaymentFor("order", chainId, merchant, orderId)) return Response.json({ paid: true });

      const order = await relayerSdk(chainId).orders.get(merchant, orderId as `0x${string}`);
      if (order.status !== "open") throw new HttpError(409, "NOT_OPEN", "This order was already paid or closed");
      if (Date.now() / 1000 > Number(order.expiresAt)) throw new HttpError(409, "EXPIRED", "This order is no longer accepting payments");
      const amount = (Number(order.amount) / 1e6).toString();
      const saved = await saveFiatPayment({ kind: "order", chainId, merchantAddress: merchant, targetId: orderId, amount, currency: country.currency, fiatAmount: Number(amount) * rate, rate, country: country.code, payerReference: reference, userId: customer?.id });
      if (saved) {
        await updateOrderStatus({ chainId, merchantAddress: merchant, orderId, status: "paid", payer: null });
        const details = { chainId, orderId, merchant, via: "bank", currency: country.currency, fiatAmount: (Number(amount) * rate).toFixed(2) };
        // Recorded as the paying customer when signed in (both sides are told), otherwise as the merchant.
        const merchantUser = customer ? undefined : (await merchantAccountByAddress(chainId, merchant))?.user_id;
        const actor = customer?.id ?? merchantUser;
        if (actor) await recordEvent({ userId: actor, type: "order.paid", details });
      }
      return Response.json({ paid: true, currency: country.currency, fiatAmount: (Number(amount) * rate).toFixed(2) });
    }

    if (body.kind === "subscription") {
      const row = await subscriptionOrderById(typeof body.id === "string" ? body.id : "");
      if (!row) throw new HttpError(404, "NOT_FOUND", "This subscription does not exist");
      if (await fiatPaymentFor("subscription", row.chain_id, row.merchant_address, row.id)) return Response.json({ paid: true });
      const state = await readState(row);
      if (state.status !== "open" || state.subscriber) throw new HttpError(409, "TAKEN", "This subscription has already been taken");
      const fiatAmount = Number(state.amount) * rate;
      const saved = await saveFiatPayment({ kind: "subscription", chainId: row.chain_id, merchantAddress: row.merchant_address, targetId: row.id, amount: state.amount, currency: country.currency, fiatAmount, rate, country: country.code, payerReference: reference, userId: customer?.id });
      if (saved) {
        const base = { chainId: row.chain_id, subscriptionId: row.id, name: row.name, via: "bank", currency: country.currency, fiatAmount: fiatAmount.toFixed(2) };
        const account = await merchantAccountByAddress(row.chain_id, row.merchant_address);
        if (account) {
          await recordEvent({ userId: account.user_id, type: "subscription.started", details: base });
          await recordEvent({ userId: account.user_id, type: "subscription.charged", details: { ...base, period: 1, periods: row.periods, amount: state.amount } });
        }
        if (customer) await recordEvent({ userId: customer.id, type: "subscription.subscribed", details: { ...base, amount: state.amount } });
      }
      return Response.json({ paid: true, currency: country.currency, fiatAmount: fiatAmount.toFixed(2) });
    }

    throw new HttpError(400, "INVALID_INPUT", "kind must be order or subscription");
  } catch (error) {
    return errorResponse(error);
  }
}
