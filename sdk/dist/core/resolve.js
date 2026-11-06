import { ZERO_ADDRESS } from "../config/constants.js";
import { bookCall, collectorCall, registryCall } from "./calls.js";
import { SwordError } from "./errors.js";
import { readCall } from "./transactions.js";
/// Returns the merchant's order book, or throws if the merchant has not registered.
export async function resolveBook(ctx, merchant) {
    const book = await readCall(ctx, registryCall(ctx, "bookOf", [merchant]));
    if (book === ZERO_ADDRESS) {
        throw new SwordError("MERCHANT_NOT_REGISTERED", `Merchant ${merchant} has not registered`);
    }
    return book;
}
/// Returns the collector assigned to an order id in a merchant's book, or throws if the order does not exist.
export async function resolveCollector(ctx, book, orderId) {
    const record = await readCall(ctx, bookCall(book, "getOrder", [orderId]));
    if (!record.exists) {
        throw new SwordError("ORDER_NOT_FOUND", `Order ${orderId} does not exist for this merchant`);
    }
    return record.collector;
}
/// Merchant address and order id to collector address, in one step.
export async function collectorFor(ctx, merchant, orderId) {
    const book = await resolveBook(ctx, merchant);
    return resolveCollector(ctx, book, orderId);
}
/// Builds a call to the collector that holds a merchant's order, ready to send or read.
export async function orderCall(ctx, merchant, orderId, functionName, args = []) {
    return collectorCall(await collectorFor(ctx, merchant, orderId), functionName, args);
}
/// Whether an order has been withdrawn. Withdrawn orders are refunded from the merchant's wallet, not the order balance.
export async function isWithdrawn(ctx, collector) {
    const [withdrawn] = await readCall(ctx, collectorCall(collector, "pullInfo"));
    return withdrawn;
}
//# sourceMappingURL=resolve.js.map