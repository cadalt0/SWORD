import type { Address, Hex } from "viem";
import type { SdkContext } from "../core/context.js";
import type { OrderView, TransactionResult } from "../types.js";
export interface CreateOrderInput {
    readonly merchant: string;
    readonly reference: string;
    readonly amount: string;
    readonly refundDays?: number;
    readonly relayer?: string;
}
export interface CreatedOrder {
    readonly orderId: Hex;
    readonly collector: Address;
    readonly transaction: TransactionResult;
}
export interface ReuseCollectorInput {
    readonly merchant: string;
    readonly collector: string;
    readonly reference: string;
    readonly amount: string;
    readonly refundDays?: number;
}
export declare class OrdersModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    create(input: CreateOrderInput): Promise<CreatedOrder>;
    reuse(input: ReuseCollectorInput): Promise<CreatedOrder>;
    get(merchant: string, orderId: Hex): Promise<OrderView>;
    confirmTransfer(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly payer: string;
        readonly transferTime: bigint;
        readonly txHash: Hex;
    }): Promise<TransactionResult>;
    fail(merchant: string, orderId: Hex): Promise<TransactionResult>;
    setRefundWindow(input: {
        readonly merchant: string;
        readonly orderId: Hex;
        readonly refundDays: number;
    }): Promise<TransactionResult>;
    expire(merchant: string, orderId: Hex): Promise<TransactionResult>;
    refundFailed(merchant: string, orderId: Hex): Promise<TransactionResult>;
    withdraw(merchant: string, orderId: Hex): Promise<TransactionResult>;
    close(merchant: string, orderId: Hex): Promise<TransactionResult>;
    private permissioned;
    private open;
    private relayerFor;
    private assertOrderIsFree;
}
//# sourceMappingURL=orders.d.ts.map