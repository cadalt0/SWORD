import type { Address, Hex } from "viem";
import type { SdkContext } from "../core/context.js";
import type { SubscriptionView, TransactionResult } from "../types.js";
export interface CreateSubscriptionInput {
    readonly merchant: string;
    readonly reference: string;
    readonly amount: string;
    readonly periodSeconds: number;
    readonly periods: number;
    readonly relayer?: string;
}
export declare class SubscriptionsModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    idOf(merchant: string, reference: string): Hex;
    create(input: CreateSubscriptionInput): Promise<{
        id: Hex;
        vault: Address;
        transaction: TransactionResult;
    }>;
    subscribe(id: Hex): Promise<{
        transaction: TransactionResult;
        approval: TransactionResult | undefined;
    }>;
    charge(id: Hex): Promise<TransactionResult>;
    cancel(id: Hex): Promise<TransactionResult>;
    requestRefund(input: {
        readonly id: Hex;
        readonly amount: string;
        readonly reason: string;
    }): Promise<TransactionResult>;
    refund(input: {
        readonly id: Hex;
        readonly amount: string;
        readonly note?: string;
    }): Promise<TransactionResult>;
    deny(input: {
        readonly id: Hex;
        readonly note?: string;
    }): Promise<TransactionResult>;
    withdraw(id: Hex): Promise<TransactionResult>;
    get(id: Hex): Promise<SubscriptionView>;
    hasAccess(id: Hex, at?: bigint): Promise<boolean>;
    vaultOf(id: Hex): Promise<Address>;
    periodPaidAt(id: Hex, index: number): Promise<bigint>;
    private read;
}
//# sourceMappingURL=subscriptions.d.ts.map