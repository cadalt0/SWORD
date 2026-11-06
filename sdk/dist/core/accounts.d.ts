import { type Address } from "viem";
import type { SdkContext } from "./context.js";
export type AccountKind = "customer" | "merchant";
export declare function accountFactoryOf(ctx: SdkContext): Address;
export declare function assertAccountOwner(ctx: SdkContext, account: Address): Promise<void>;
//# sourceMappingURL=accounts.d.ts.map