import type { Hex } from "viem";
import type { SdkContext } from "../../core/context.js";
import type { TransactionResult } from "../../types.js";
export declare class CustomerAccountActions {
    private readonly ctx;
    constructor(ctx: SdkContext);
    payOrder(input: {
        readonly account: string;
        readonly merchant: string;
        readonly orderId: Hex;
    }): Promise<TransactionResult>;
    requestOrderRefund(input: {
        readonly account: string;
        readonly merchant: string;
        readonly orderId: Hex;
        readonly amount: string;
        readonly reason: string;
    }): Promise<TransactionResult>;
    subscribe(input: {
        readonly account: string;
        readonly id: Hex;
    }): Promise<TransactionResult>;
    cancelSubscription(input: {
        readonly account: string;
        readonly id: Hex;
    }): Promise<TransactionResult>;
    requestSubscriptionRefund(input: {
        readonly account: string;
        readonly id: Hex;
        readonly amount: string;
        readonly reason: string;
    }): Promise<TransactionResult>;
}
//# sourceMappingURL=customer.d.ts.map