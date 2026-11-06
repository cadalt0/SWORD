import type { Abi, Address, Hash, TransactionReceipt } from "viem";
import type { SdkContext } from "./context.js";
export interface TransactionResult {
    readonly hash: Hash;
    readonly receipt: TransactionReceipt;
}
export interface CallDescription {
    readonly address: Address;
    readonly abi: Abi;
    readonly functionName: string;
    readonly args?: readonly unknown[];
}
export declare function sendTransaction(ctx: SdkContext, call: CallDescription): Promise<TransactionResult>;
export declare function assertWalletOnChain(ctx: SdkContext): Promise<void>;
export declare function readCall<T>(ctx: SdkContext, call: CallDescription): Promise<T>;
export declare function chainTime(ctx: SdkContext): Promise<bigint>;
//# sourceMappingURL=transactions.d.ts.map