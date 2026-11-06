export declare const ORDER_STATUSES: readonly ["open", "paid", "partially_refunded", "refunded", "failed", "closed"];
export declare const REFUND_STATUSES: readonly ["none", "requested", "approved", "denied"];
export declare const SUBSCRIPTION_STATUSES: readonly ["open", "active", "cancelled", "completed"];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export declare function orderStatusName(value: number): OrderStatus;
export declare function refundStatusName(value: number): RefundStatus;
export declare function subscriptionStatusName(value: number): SubscriptionStatus;
//# sourceMappingURL=status.d.ts.map