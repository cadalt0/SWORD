import { spenderCall } from "../core/calls.js";
import { reasonHash } from "../core/ids.js";
import { assertMerchantMode } from "../core/mode.js";
import { collectorFor, isWithdrawn, orderCall } from "../core/resolve.js";
import { parseUsdt } from "../core/units.js";
import { sendTransaction } from "../core/transactions.js";
import { assertAddress } from "../core/validate.js";
import { requirePermission } from "./permission.js";
/// Refunds on single orders. The merchant or relayer decides; the customer's request is recorded on chain by the
/// customer's own wallet, outside this SDK.
export class RefundsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Refunds a paid order without a customer request: approves `amount` and pays it in one call. Before withdrawal it
    /// is paid from the order's balance. After withdrawal it is paid from the merchant's wallet through the spender, so
    /// the merchant must have approved the spender first. Merchant or relayer.
    async refund(input) {
        const merchant = assertAddress(input.merchant, "merchant");
        const approval = await this.permissioned(merchant, input.orderId, "initiateRefund", [
            parseUsdt(input.amount),
            reasonHash(input.note ?? ""),
        ]);
        const withdrawn = await isWithdrawn(this.ctx, await collectorFor(this.ctx, merchant, input.orderId));
        const payment = withdrawn
            ? await this.payFromMerchantWallet(merchant, input.orderId)
            : await this.executeFromBalance(merchant, input.orderId);
        return { approval, payment };
    }
    /// Approves a refund amount on an open customer request. Up to what is still refundable. Merchant or relayer.
    async approve(input) {
        return this.permissioned(input.merchant, input.orderId, "approveRefund", [parseUsdt(input.amount)]);
    }
    /// Denies an open customer request. `note` is hashed on chain. Merchant or relayer.
    async deny(input) {
        return this.permissioned(input.merchant, input.orderId, "denyRefund", [reasonHash(input.note)]);
    }
    /// Pays an approved refund from the order's own balance. Use this before the order is withdrawn. Merchant or relayer.
    async executeFromBalance(merchant, orderId) {
        return this.permissioned(merchant, orderId, "executeRefund");
    }
    /// Pays an approved refund from the merchant's wallet, through the spender. Use this after withdrawal.
    /// The merchant must have approved the spender for the amount. Merchant or relayer.
    async payFromMerchantWallet(merchant, orderId) {
        const merchantAddress = assertAddress(merchant, "merchant");
        await requirePermission(this.ctx, merchantAddress);
        const collector = await collectorFor(this.ctx, merchantAddress, orderId);
        return sendTransaction(this.ctx, spenderCall(this.ctx, "pullRefund", [collector]));
    }
    /// Records a refund the merchant sent from its own wallet, after withdrawal. Merchant wallet only.
    async recordManual(input) {
        assertMerchantMode(this.ctx, "Recording a manual refund");
        return this.collectorAction(input.merchant, input.orderId, "recordRefund", [parseUsdt(input.amount)]);
    }
    /// Sends extra or stray funds in an order's balance to an address. Merchant or relayer.
    async refundExtra(input) {
        const to = assertAddress(input.to, "to");
        return this.permissioned(input.merchant, input.orderId, "refundTo", [to, parseUsdt(input.amount)]);
    }
    /// A collector action that needs the merchant's permission in relayer mode.
    async permissioned(merchant, orderId, functionName, args = []) {
        const merchantAddress = assertAddress(merchant, "merchant");
        await requirePermission(this.ctx, merchantAddress);
        return this.collectorAction(merchant, orderId, functionName, args);
    }
    /// Sends a call to the order's collector.
    async collectorAction(merchant, orderId, functionName, args = []) {
        const call = await orderCall(this.ctx, assertAddress(merchant, "merchant"), orderId, functionName, args);
        return sendTransaction(this.ctx, call);
    }
}
//# sourceMappingURL=refunds.js.map