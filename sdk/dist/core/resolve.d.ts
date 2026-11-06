import type { Address, Hex } from "viem";
import type { SdkContext } from "./context.js";
import { type CallDescription } from "./transactions.js";
export declare function resolveBook(ctx: SdkContext, merchant: Address): Promise<Address>;
export declare function resolveCollector(ctx: SdkContext, book: Address, orderId: Hex): Promise<Address>;
export declare function collectorFor(ctx: SdkContext, merchant: Address, orderId: Hex): Promise<Address>;
export declare function orderCall(ctx: SdkContext, merchant: Address, orderId: Hex, functionName: string, args?: readonly unknown[]): Promise<CallDescription>;
export declare function isWithdrawn(ctx: SdkContext, collector: Address): Promise<boolean>;
//# sourceMappingURL=resolve.d.ts.map