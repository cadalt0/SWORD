import type { Address, Hex } from "viem";
import type { SdkContext } from "../../core/context.js";
import type { RefundResult, TransactionResult } from "../../types.js";
export interface AccountCreatedOrder {
    readonly orderId: Hex;
    readonly collector: Address;
    readonly transaction: TransactionResult;
}
export declare class MerchantAccountActions {
    private readonly ctx;
    constructor(ctx: SdkContext);
    register(account: string): Promise<TransactionResult>;
    createOrder(input: {
        readonly account: string;
        readonly reference: string;
        readonly amount: string;
        readonly refundDays?: number;
    }): Promise<AccountCreatedOrder>;
    reuseOrder(input: {
        readonly account: string;
        readonly collector: string;
        readonly reference: string;
        readonly amount: string;
        readonly refundDays?: number;
    }): Promise<AccountCreatedOrder>;
    confirmTransfer(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly payer: string;
        readonly transferTime?: bigint;
        readonly txHash: Hex;
    }): Promise<TransactionResult>;
    failOrder(input: {
        readonly account: string;
        readonly orderId: Hex;
    }): Promise<TransactionResult>;
    setRefundWindow(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly refundDays: number;
    }): Promise<TransactionResult>;
    refund(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly amount: string;
        readonly note?: string;
    }): Promise<RefundResult>;
    approveRefund(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly amount: string;
    }): Promise<TransactionResult>;
    denyRefund(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly note: string;
    }): Promise<TransactionResult>;
    executeRefundFromBalance(input: {
        readonly account: string;
        readonly orderId: Hex;
    }): Promise<TransactionResult>;
    payRefundFromWallet(input: {
        readonly account: string;
        readonly orderId: Hex;
    }): Promise<TransactionResult>;
    recordManualRefund(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly amount: string;
    }): Promise<TransactionResult>;
    refundExtra(input: {
        readonly account: string;
        readonly orderId: Hex;
        readonly to: string;
        readonly amount: string;
    }): Promise<TransactionResult>;
    createSubscription(input: {
        readonly account: string;
        readonly reference: string;
        readonly amount: string;
        readonly periodSeconds: number;
        readonly periods: number;
    }): Promise<{
        id: Hex;
        vault: Address;
        transaction: TransactionResult;
    }>;
    chargeSubscription(input: {
        readonly account: string;
        readonly id: Hex;
    }): Promise<TransactionResult>;
    cancelSubscription(input: {
        readonly account: string;
        readonly id: Hex;
    }): Promise<TransactionResult>;
    refundSubscription(input: {
        readonly account: string;
        readonly id: Hex;
        readonly amount: string;
        readonly note?: string;
    }): Promise<TransactionResult>;
    denySubscriptionRefund(input: {
        readonly account: string;
        readonly id: Hex;
        readonly note?: string;
    }): Promise<TransactionResult>;
    withdrawSubscription(input: {
        readonly account: string;
        readonly id: Hex;
    }): Promise<TransactionResult>;
}
//# sourceMappingURL=merchant.d.ts.map