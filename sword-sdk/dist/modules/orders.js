import { DEFAULT_REFUND_DAYS, MAX_REFUND_DAYS, MIN_REFUND_DAYS } from "../config/constants.js";
import { bookCall } from "../core/calls.js";
import { SwordError } from "../core/errors.js";
import { orderIdFromReference } from "../core/ids.js";
import { orderCall, resolveBook, resolveCollector } from "../core/resolve.js";
import { parseUsdt } from "../core/units.js";
import { readCall, sendTransaction } from "../core/transactions.js";
import { toOrderView } from "../core/views.js";
import { assertAddress, assertIntegerInRange } from "../core/validate.js";
import { readPermission, requirePermission } from "./permission.js";
/// Order creation, lookup, and the order lifecycle.
/// Actions that use the merchant's permission check it first when the instance is in relayer mode.
export class OrdersModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Creates an order and gives it a new collector. Merchant or relayer.
    async create(input) {
        const merchant = assertAddress(input.merchant, "merchant");
        const orderId = orderIdFromReference(input.reference);
        const amount = parseUsdt(input.amount);
        const refundDays = refundDaysOf(input.refundDays);
        await requirePermission(this.ctx, merchant);
        const book = await resolveBook(this.ctx, merchant);
        const relayer = await this.relayerFor(merchant, input.relayer);
        await this.assertOrderIsFree(book, orderId);
        const transaction = await sendTransaction(this.ctx, bookCall(book, "createOrder", [orderId, amount, BigInt(refundDays), relayer]));
        const collector = await resolveCollector(this.ctx, book, orderId);
        return { orderId, collector, transaction };
    }
    /// Gives a closed collector a new order. The contract archives the previous order in the same transaction.
    async reuse(input) {
        const merchant = assertAddress(input.merchant, "merchant");
        const collector = assertAddress(input.collector, "collector");
        const orderId = orderIdFromReference(input.reference);
        const amount = parseUsdt(input.amount);
        const refundDays = refundDaysOf(input.refundDays);
        await requirePermission(this.ctx, merchant);
        const book = await resolveBook(this.ctx, merchant);
        await this.assertOrderIsFree(book, orderId);
        const transaction = await sendTransaction(this.ctx, bookCall(book, "reuseCollector", [collector, orderId, amount, BigInt(refundDays)]));
        return { orderId, collector, transaction };
    }
    /// Returns the current state of an order.
    async get(merchant, orderId) {
        const call = await orderCall(this.ctx, assertAddress(merchant, "merchant"), orderId, "getState");
        const state = await readCall(this.ctx, call);
        return toOrderView(state, call.address);
    }
    /// Confirms a plain USDT transfer as the payment. Merchant or relayer, inside the payment window.
    async confirmTransfer(input) {
        return this.permissioned(input.merchant, input.orderId, "markPaid", [
            assertAddress(input.payer, "payer"),
            input.transferTime,
            input.txHash,
        ]);
    }
    /// Marks an open order as failed, before withdrawal. Merchant or relayer.
    async fail(merchant, orderId) {
        return this.permissioned(merchant, orderId, "failOrder");
    }
    /// Changes the refund window of an order not yet withdrawn. Merchant or relayer. Allowed range is 1 to 365 days.
    async setRefundWindow(input) {
        const days = assertIntegerInRange(input.refundDays, MIN_REFUND_DAYS, MAX_REFUND_DAYS, "refundDays");
        return this.permissioned(input.merchant, input.orderId, "setRefundWindow", [BigInt(days)]);
    }
    /// Marks an order as expired once its payment window has passed. Anyone can call it, so no permission is checked.
    async expire(merchant, orderId) {
        return this.open(merchant, orderId, "expire");
    }
    /// Refunds a failed order to its payer. Anyone can call it, so no permission is checked.
    async refundFailed(merchant, orderId) {
        return this.open(merchant, orderId, "refundFailedOrder");
    }
    /// Withdraws a paid order's balance to the merchant. Anyone can call it, so no permission is checked.
    async withdraw(merchant, orderId) {
        return this.open(merchant, orderId, "withdraw");
    }
    /// Closes a finished order so its collector can be reused. Anyone can call it, so no permission is checked.
    async close(merchant, orderId) {
        return this.open(merchant, orderId, "close");
    }
    /// An action that needs the merchant's permission in relayer mode.
    async permissioned(merchant, orderId, functionName, args = []) {
        const merchantAddress = assertAddress(merchant, "merchant");
        await requirePermission(this.ctx, merchantAddress);
        return sendTransaction(this.ctx, await orderCall(this.ctx, merchantAddress, orderId, functionName, args));
    }
    /// An action anyone may take, so no permission is checked.
    async open(merchant, orderId, functionName, args = []) {
        const call = await orderCall(this.ctx, assertAddress(merchant, "merchant"), orderId, functionName, args);
        return sendTransaction(this.ctx, call);
    }
    /// Uses the relayer given, or the one named in the merchant's permission.
    async relayerFor(merchant, relayer) {
        if (relayer !== undefined)
            return assertAddress(relayer, "relayer");
        const view = await readPermission(this.ctx, merchant);
        if (!view.terms) {
            throw new SwordError("RELAYER_REQUIRED", "No relayer given and the merchant has no permission");
        }
        return view.terms.relayer;
    }
    /// Throws early if an order with this id already exists, instead of spending gas on a revert.
    async assertOrderIsFree(book, orderId) {
        const record = await readCall(this.ctx, bookCall(book, "getOrder", [orderId]));
        if (record.exists) {
            throw new SwordError("ORDER_EXISTS", `An order with this reference already exists (${orderId})`);
        }
    }
}
/// Refund window in days, using the default when none is given.
function refundDaysOf(days) {
    if (days === undefined)
        return DEFAULT_REFUND_DAYS;
    return assertIntegerInRange(days, MIN_REFUND_DAYS, MAX_REFUND_DAYS, "refundDays");
}
//# sourceMappingURL=orders.js.map