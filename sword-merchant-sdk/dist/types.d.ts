export type Signing = "relayer" | "permission" | "self";
export interface Merchant {
    object: "merchant";
    address: string;
    chainId: number;
    custody: "custodial" | "self";
    signing: Signing;
    signer: string | null;
    registered: boolean;
    permission: {
        state: "none" | "active" | "expired";
        daysLeft: number;
    } | null;
    key: {
        prefix: string;
        scopes: string[];
    };
}
export type OrderStatus = "pending" | "expired" | "paid" | "partially_refunded" | "refunded" | "failed" | "closed";
export interface Order {
    object: "order";
    id: string;
    reference: string | null;
    merchant: string;
    amount: string;
    currency: "USDT";
    status: OrderStatus;
    depositAddress: string;
    expiresAt: string | null;
    payer: string | null;
    paidAt: string | null;
    paymentTransaction: string | null;
    withdrawn: boolean;
    refund: {
        status: "none" | "requested" | "approved" | "denied";
        requested: string;
        approved: string;
        refunded: string;
    };
    checkoutUrl: string;
    createdAt: string | null;
    transaction?: string;
}
export type SubscriptionStatus = "open" | "active" | "cancelled" | "completed";
export interface Subscription {
    object: "subscription";
    id: string;
    reference: string | null;
    name: string | null;
    description: string | null;
    merchant: string;
    status: SubscriptionStatus;
    amount: string;
    currency: "USDT";
    periodSeconds: number;
    periodDays: number;
    periods: number;
    paidPeriods: number;
    subscriber: string | null;
    depositAddress: string;
    collected: string;
    refunded: string;
    withdrawn: string;
    held: string;
    refundRequest: {
        amount: string;
    } | null;
    nextChargeAt: string | null;
    accessUntil: string | null;
    startedAt: string | null;
    cancelledAt: string | null;
    subscribeUrl: string;
    createdAt: string | null;
    transaction?: string;
}
export interface List<T> {
    object: "list";
    data: T[];
    hasMore: boolean;
}
export interface ListOptions {
    limit?: number;
    before?: string;
}
export interface PendingTransaction {
    id: string;
    action: string;
    step: string;
    chainId: number;
    from: string;
    to: string;
    data: string;
    value: string;
    expiresAt: string;
}
//# sourceMappingURL=types.d.ts.map