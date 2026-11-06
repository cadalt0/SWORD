import type { Address } from "viem";
import type { SdkContext } from "../core/context.js";
import type { TransactionResult } from "../types.js";
export declare class MerchantModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    register(): Promise<{
        book: Address;
        created: boolean;
        transaction?: TransactionResult;
    }>;
    getBook(merchant: string): Promise<Address | undefined>;
    approveRefundSpender(amount: string): Promise<TransactionResult>;
    refundAllowance(merchant: string): Promise<bigint>;
}
//# sourceMappingURL=merchant.d.ts.map