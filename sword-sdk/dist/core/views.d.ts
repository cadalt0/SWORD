import type { Address, Hex } from "viem";
import type { OrderView, PermissionView, SubscriptionView } from "../types.js";
export interface RawMandate {
    readonly relayer: Address;
    readonly expiry: bigint;
    readonly maxOrders: bigint;
    readonly maxActions: bigint;
    readonly maxAmount: bigint;
    readonly nonce: bigint;
}
export interface RawUsage {
    readonly orders: bigint;
    readonly actions: bigint;
    readonly amount: bigint;
}
export interface RawCollectorState {
    readonly orderId: Hex;
    readonly amount: bigint;
    readonly epoch: bigint;
    readonly expiresAt: number | bigint;
    readonly refundWindow: number | bigint;
    readonly status: number;
    readonly payer: Address;
    readonly paidAt: number | bigint;
    readonly paymentTxHash: Hex;
    readonly withdrawn: boolean;
    readonly settledAt: number | bigint;
    readonly closedAt: number | bigint;
    readonly refundedAmount: bigint;
    readonly refundStatus: number;
    readonly refundRequestedAmount: bigint;
    readonly refundApprovedAmount: bigint;
    readonly refundReasonHash: Hex;
}
export interface RawSubscription {
    readonly merchant: Address;
    readonly relayer: Address;
    readonly subscriber: Address;
    readonly vault: Address;
    readonly amount: bigint;
    readonly periodLength: bigint;
    readonly periods: number;
    readonly paidPeriods: number;
    readonly createdAt: bigint;
    readonly startedAt: bigint;
    readonly cancelledAt: bigint;
    readonly exists: boolean;
    readonly cancelled: boolean;
    readonly refundRequested: boolean;
    readonly collected: bigint;
    readonly refunded: bigint;
    readonly withdrawn: bigint;
    readonly requestedAmount: bigint;
    readonly requestReasonHash: Hex;
}
export declare function toPermissionView(mandate: RawMandate, usage: RawUsage, now: bigint): PermissionView;
export declare function toOrderView(state: RawCollectorState, collector: Address): OrderView;
export declare function toSubscriptionView(id: Hex, sub: RawSubscription, status: number, held: bigint): SubscriptionView;
//# sourceMappingURL=views.d.ts.map