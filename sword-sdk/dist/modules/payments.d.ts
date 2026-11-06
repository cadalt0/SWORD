import type { Hex } from "viem";
import type { SdkContext } from "../core/context.js";
import type { TransactionResult } from "../types.js";
export declare class PaymentsModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    approve(amount: string): Promise<TransactionResult>;
    allowance(owner: string): Promise<bigint>;
    payOrder(input: {
        merchant: string;
        orderId: Hex;
    }): Promise<TransactionResult>;
}
//# sourceMappingURL=payments.d.ts.map