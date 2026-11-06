import { RENEWAL_WARNING_DAYS, ZERO_ADDRESS } from "../config/constants.js";
import { orderStatusName, refundStatusName, subscriptionStatusName } from "./status.js";
const SECONDS_PER_DAY = 86400n;
/// Builds the permission view from the book's stored mandate. `now` is chain time, used to judge expiry.
export function toPermissionView(mandate, usage, now) {
    const usageView = { orders: usage.orders, actions: usage.actions, amount: usage.amount };
    if (mandate.relayer === ZERO_ADDRESS) {
        return { state: "none", terms: undefined, daysLeft: 0, renewalDue: true, usage: usageView };
    }
    const terms = {
        relayer: mandate.relayer,
        expiry: mandate.expiry,
        maxOrders: mandate.maxOrders,
        maxActions: mandate.maxActions,
        maxAmount: mandate.maxAmount,
        nonce: mandate.nonce,
    };
    if (now > mandate.expiry) {
        return { state: "expired", terms, daysLeft: 0, renewalDue: true, usage: usageView };
    }
    const daysLeft = Number((mandate.expiry - now) / SECONDS_PER_DAY);
    return {
        state: "active",
        terms,
        daysLeft,
        renewalDue: daysLeft <= RENEWAL_WARNING_DAYS,
        usage: usageView,
    };
}
export function toOrderView(state, collector) {
    return {
        orderId: state.orderId,
        collector,
        epoch: state.epoch,
        status: orderStatusName(state.status),
        amount: state.amount,
        expiresAt: BigInt(state.expiresAt),
        payer: state.payer,
        paidAt: BigInt(state.paidAt),
        paymentTxHash: state.paymentTxHash,
        withdrawn: state.withdrawn,
        settledAt: BigInt(state.settledAt),
        closedAt: BigInt(state.closedAt),
        refundWindow: BigInt(state.refundWindow),
        refundedAmount: state.refundedAmount,
        refundStatus: refundStatusName(state.refundStatus),
        refundRequestedAmount: state.refundRequestedAmount,
        refundApprovedAmount: state.refundApprovedAmount,
    };
}
export function toSubscriptionView(id, sub, status, held) {
    const started = sub.subscriber !== ZERO_ADDRESS;
    const periodLength = BigInt(sub.periodLength);
    const startedAt = BigInt(sub.startedAt);
    const paidEnd = startedAt + BigInt(sub.paidPeriods) * periodLength;
    const more = started && !sub.cancelled && sub.paidPeriods < sub.periods;
    return {
        id,
        merchant: sub.merchant,
        relayer: sub.relayer,
        subscriber: started ? sub.subscriber : undefined,
        vault: sub.vault,
        status: subscriptionStatusName(status),
        amount: sub.amount,
        periodLength,
        periods: Number(sub.periods),
        paidPeriods: Number(sub.paidPeriods),
        createdAt: BigInt(sub.createdAt),
        startedAt,
        cancelledAt: BigInt(sub.cancelledAt),
        collected: sub.collected,
        refunded: sub.refunded,
        withdrawn: sub.withdrawn,
        held,
        refundRequested: sub.refundRequested,
        requestedAmount: sub.requestedAmount,
        nextChargeAt: more ? paidEnd : undefined,
        accessUntil: sub.paidPeriods > 0 ? paidEnd : undefined,
    };
}
//# sourceMappingURL=views.js.map