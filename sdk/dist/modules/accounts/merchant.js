import { accountCall, spenderCall } from "../../core/calls.js";
import { assertAccountOwner } from "../../core/accounts.js";
import { orderIdFromReference, reasonHash, subscriptionIdOf } from "../../core/ids.js";
import { collectorFor, isWithdrawn, resolveBook, resolveCollector } from "../../core/resolve.js";
import { parseUsdt } from "../../core/units.js";
import { chainTime, readCall, sendTransaction } from "../../core/transactions.js";
import { assertAddress, assertIntegerInRange } from "../../core/validate.js";
import { DEFAULT_REFUND_DAYS, MAX_PERIOD_SECONDS, MAX_PERIODS, MAX_REFUND_DAYS, MIN_PERIOD_SECONDS, MIN_REFUND_DAYS } from "../../config/constants.js";
/// Actions a merchant account takes. The owner runs them directly; the relayer runs them within the owner's grant.
/// Refund approvals, refund payouts, extra-funds refunds, and subscription refunds count against the grant.
/// Creating orders and subscriptions, confirming payments, charging periods, withdrawing, and cancelling move no money out of the merchant's wallet,
/// so they count nothing.
export class MerchantAccountActions {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Registers the account as a merchant and deploys its order book. Owner only, once.
    async register(account) {
        const address = assertAddress(account, "account");
        await assertAccountOwner(this.ctx, address);
        return sendTransaction(this.ctx, accountCall(address, "register"));
    }
    /// Creates an order in the account's book. The order is operated by the account's relayer.
    async createOrder(input) {
        const account = assertAddress(input.account, "account");
        const orderId = orderIdFromReference(input.reference);
        const refundDays = refundDaysOf(input.refundDays);
        const amount = parseUsdt(input.amount);
        const transaction = await sendTransaction(this.ctx, accountCall(account, "createOrder", [orderId, amount, BigInt(refundDays)]));
        const book = await resolveBook(this.ctx, account);
        const collector = await resolveCollector(this.ctx, book, orderId);
        return { orderId, collector, transaction };
    }
    /// Gives a closed collector of the account's book a new order.
    async reuseOrder(input) {
        const account = assertAddress(input.account, "account");
        const collector = assertAddress(input.collector, "collector");
        const orderId = orderIdFromReference(input.reference);
        const transaction = await sendTransaction(this.ctx, accountCall(account, "reuseOrder", [
            collector,
            orderId,
            parseUsdt(input.amount),
            BigInt(refundDaysOf(input.refundDays)),
        ]));
        return { orderId, collector, transaction };
    }
    /// Confirms a plain USDT transfer as the payment for an order of this account.
    async confirmTransfer(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        const transferTime = input.transferTime ?? (await chainTime(this.ctx));
        return sendTransaction(this.ctx, accountCall(account, "confirmTransfer", [collector, assertAddress(input.payer, "payer"), transferTime, input.txHash]));
    }
    /// Marks an open order as failed, before withdrawal.
    async failOrder(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "failOrder", [collector]));
    }
    /// Changes an order's refund window, until withdrawal. Allowed range is 1 to 365 days.
    async setRefundWindow(input) {
        const account = assertAddress(input.account, "account");
        const days = assertIntegerInRange(input.refundDays, MIN_REFUND_DAYS, MAX_REFUND_DAYS, "refundDays");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "setRefundWindow", [collector, BigInt(days)]));
    }
    /// Refunds a paid order without a customer request: approves `amount` and pays it in one call. Before withdrawal it
    /// is paid from the order's balance. After withdrawal it is paid from the account's wallet through the spender.
    /// Counts the amount against the grant, once for the approval and once for the payment.
    async refund(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        const approval = await sendTransaction(this.ctx, accountCall(account, "initiateRefund", [collector, parseUsdt(input.amount), reasonHash(input.note ?? "")]));
        const withdrawn = await isWithdrawn(this.ctx, collector);
        const payment = withdrawn
            ? await this.payRefundFromWallet({ account, orderId: input.orderId })
            : await this.executeRefundFromBalance({ account, orderId: input.orderId });
        return { approval, payment };
    }
    /// Approves a refund amount on an open customer request. Counts the amount against the grant.
    async approveRefund(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "approveRefund", [collector, parseUsdt(input.amount)]));
    }
    /// Denies an open customer request. The note is hashed on chain.
    async denyRefund(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "denyRefund", [collector, reasonHash(input.note)]));
    }
    /// Pays an approved refund from the order's own balance, before withdrawal. Counts the approved amount.
    async executeRefundFromBalance(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "executeRefundFromBalance", [collector]));
    }
    /// Pays an approved refund from the account's wallet, through the spender, after withdrawal. Counts the approved amount.
    async payRefundFromWallet(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "payRefundFromWallet", [collector]));
    }
    /// Records a refund the account sent from its own wallet, after withdrawal. Moves no money. Send the USDT with
    /// the account's send action first, which counts against the grant.
    async recordManualRefund(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "recordManualRefund", [collector, parseUsdt(input.amount)]));
    }
    /// Sends extra or stray funds in an order's balance to an address. Counts the amount against the grant.
    async refundExtra(input) {
        const account = assertAddress(input.account, "account");
        const collector = await collectorFor(this.ctx, account, input.orderId);
        return sendTransaction(this.ctx, accountCall(account, "refundExtra", [collector, assertAddress(input.to, "to"), parseUsdt(input.amount)]));
    }
    /// Creates a subscription the account sells, with its own deposit address. One customer takes it later.
    async createSubscription(input) {
        const account = assertAddress(input.account, "account");
        const periodSeconds = assertIntegerInRange(input.periodSeconds, MIN_PERIOD_SECONDS, MAX_PERIOD_SECONDS, "periodSeconds");
        const periods = assertIntegerInRange(input.periods, 1, MAX_PERIODS, "periods");
        const transaction = await sendTransaction(this.ctx, accountCall(account, "createSubscription", [orderIdFromReference(input.reference), parseUsdt(input.amount), BigInt(periodSeconds), BigInt(periods)]));
        const id = subscriptionIdOf(account, input.reference);
        const vault = await readCall(this.ctx, spenderCall(this.ctx, "vaultOf", [id]));
        return { id, vault, transaction };
    }
    /// Pulls the next due period of a subscription the account sells into its vault. Counts nothing.
    async chargeSubscription(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "chargeSubscription", [input.id]));
    }
    /// Cancels a subscription the account sells. Moves no money.
    async cancelSubscription(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "cancelSubscription", [input.id]));
    }
    /// Refunds any amount on a subscription the account sells, at any time. Paid from the vault first, then from the
    /// account. Counts the amount against the grant.
    async refundSubscription(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "refundSubscription", [input.id, parseUsdt(input.amount), reasonHash(input.note ?? "")]));
    }
    /// Denies the customer's open refund request. Moves no money.
    async denySubscriptionRefund(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "denySubscriptionRefund", [input.id, reasonHash(input.note ?? "")]));
    }
    /// Moves a subscription's held funds into the account. Counts nothing.
    async withdrawSubscription(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "withdrawSubscription", [input.id]));
    }
}
/// Refund window in days, using the default when none is given.
function refundDaysOf(days) {
    if (days === undefined)
        return DEFAULT_REFUND_DAYS;
    return assertIntegerInRange(days, MIN_REFUND_DAYS, MAX_REFUND_DAYS, "refundDays");
}
//# sourceMappingURL=merchant.js.map