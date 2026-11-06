/// Readable status names for the numeric enums used by the contracts.
/// The order of each array matches the Solidity enum, so the index is the on-chain value.
export const ORDER_STATUSES = [
    "open",
    "paid",
    "partially_refunded",
    "refunded",
    "failed",
    "closed",
];
export const REFUND_STATUSES = ["none", "requested", "approved", "denied"];
/// open: created, waiting for its customer. active: taken, more periods to pay. cancelled. completed: all paid.
export const SUBSCRIPTION_STATUSES = ["open", "active", "cancelled", "completed"];
export function orderStatusName(value) {
    return lookup(ORDER_STATUSES, value, "order");
}
export function refundStatusName(value) {
    return lookup(REFUND_STATUSES, value, "refund");
}
export function subscriptionStatusName(value) {
    return lookup(SUBSCRIPTION_STATUSES, value, "subscription");
}
function lookup(names, value, kind) {
    const name = names[value];
    if (name === undefined)
        throw new Error(`Unknown ${kind} status value ${value}`);
    return name;
}
//# sourceMappingURL=status.js.map