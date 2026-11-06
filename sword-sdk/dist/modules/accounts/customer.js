import { accountCall } from "../../core/calls.js";
import { reasonHash } from "../../core/ids.js";
import { collectorFor } from "../../core/resolve.js";
import { parseUsdt } from "../../core/units.js";
import { sendTransaction } from "../../core/transactions.js";
import { assertAddress } from "../../core/validate.js";
/// Input for starting a subscription from a customer account.
/// Actions a customer account takes. The owner runs them directly; the relayer runs them within the owner's grant.
/// Paying and subscribing count against the grant. Refund requests and cancellations count nothing.
export class CustomerAccountActions {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Pays an open order from the account. The exact order amount moves from the account.
    async payOrder(input) {
        const collector = await collectorFor(this.ctx, assertAddress(input.merchant, "merchant"), input.orderId);
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "payOrder", [collector]));
    }
    /// Asks for a refund on an order the account paid. The merchant decides. Moves no money.
    async requestOrderRefund(input) {
        const collector = await collectorFor(this.ctx, assertAddress(input.merchant, "merchant"), input.orderId);
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "requestOrderRefund", [
            collector,
            reasonHash(input.reason),
            parseUsdt(input.amount),
        ]));
    }
    /// Takes an open subscription as its customer, and pays the first period. The full subscription total counts
    /// against the grant.
    async subscribe(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "subscribe", [input.id]));
    }
    /// Cancels a subscription owned by the account. Moves no money.
    async cancelSubscription(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "cancelSubscription", [input.id]));
    }
    /// Asks for a refund on a subscription owned by the account. The merchant decides. Moves no money.
    async requestSubscriptionRefund(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "requestSubscriptionRefund", [
            input.id,
            reasonHash(input.reason),
            parseUsdt(input.amount),
        ]));
    }
}
//# sourceMappingURL=customer.js.map