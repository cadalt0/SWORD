import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import type { MandateTerms } from "./signing/mandate.js";
import type { OrderStatus, RefundStatus, SubscriptionStatus } from "./core/status.js";
export type { MandateTerms, GrantRequest, SignedMandate } from "./signing/mandate.js";
export type { OrderStatus, RefundStatus, SubscriptionStatus } from "./core/status.js";
export interface TransactionResult {
    readonly hash: Hash;
    readonly receipt: TransactionReceipt;
}
export interface RefundResult {
    readonly approval: TransactionResult;
    readonly payment: TransactionResult;
}
export type PermissionState = "none" | "active" | "expired";
export interface PermissionView {
    readonly state: PermissionState;
    readonly terms: MandateTerms | undefined;
    readonly daysLeft: number;
    readonly renewalDue: boolean;
    readonly usage: {
        readonly orders: bigint;
        readonly actions: bigint;
        readonly amount: bigint;
    };
}
export interface OrderView {
    readonly orderId: Hex;
    readonly collector: Address;
    readonly epoch: bigint;
    readonly status: OrderStatus;
    readonly amount: bigint;
    readonly expiresAt: bigint;
    readonly payer: Address;
    readonly paidAt: bigint;
    readonly paymentTxHash: Hex;
    readonly withdrawn: boolean;
    readonly settledAt: bigint;
    readonly closedAt: bigint;
    readonly refundWindow: bigint;
    readonly refundedAmount: bigint;
    readonly refundStatus: RefundStatus;
    readonly refundRequestedAmount: bigint;
    readonly refundApprovedAmount: bigint;
}
export interface SubscriptionView {
    readonly id: Hex;
    readonly merchant: Address;
    readonly relayer: Address;
    readonly subscriber: Address | undefined;
    readonly vault: Address;
    readonly status: SubscriptionStatus;
    readonly amount: bigint;
    readonly periodLength: bigint;
    readonly periods: number;
    readonly paidPeriods: number;
    readonly createdAt: bigint;
    readonly startedAt: bigint;
    readonly cancelledAt: bigint;
    readonly collected: bigint;
    readonly refunded: bigint;
    readonly withdrawn: bigint;
    readonly held: bigint;
    readonly refundRequested: boolean;
    readonly requestedAmount: bigint;
    readonly nextChargeAt: bigint | undefined;
    readonly accessUntil: bigint | undefined;
}
//# sourceMappingURL=types.d.ts.map