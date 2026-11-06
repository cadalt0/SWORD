import type { Hex } from "viem";
import type { SdkContext } from "../core/context.js";
import type { RefundResult, TransactionResult } from "../types.js";
export declare class RefundsModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    refund(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly amount: string;
        readonly note?: string;
    }): Promise<RefundResult>;
    approve(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly amount: string;
    }): Promise<TransactionResult>;
    deny(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly note: string;
    }): Promise<TransactionResult>;
    executeFromBalance(merchant: string, orderId: Hex): Promise<TransactionResult>;
    payFromMerchantWallet(merchant: string, orderId: Hex): Promise<TransactionResult>;
    recordManual(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly amount: string;
    }): Promise<TransactionResult>;
    refundExtra(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly to: string;
        readonly amount: string;
    }): Promise<TransactionResult>;
    private permissioned;
    private collectorAction;
}
//# sourceMappingURL=refunds.d.ts.map