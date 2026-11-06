import type { Address } from "viem";
import type { SdkContext } from "./context.js";
import type { CallDescription } from "./transactions.js";
export declare function registryCall(ctx: SdkContext, functionName: string, args?: readonly unknown[]): CallDescription;
export declare function bookCall(book: Address, functionName: string, args?: readonly unknown[]): CallDescription;
export declare function collectorCall(collector: Address, functionName: string, args?: readonly unknown[]): CallDescription;
export declare function spenderCall(ctx: SdkContext, functionName: string, args?: readonly unknown[]): CallDescription;
export declare function accountCall(account: Address, functionName: string, args?: readonly unknown[]): CallDescription;
export declare function accountFactoryCall(factory: Address, functionName: string, args?: readonly unknown[]): CallDescription;
//# sourceMappingURL=calls.d.ts.map