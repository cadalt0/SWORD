import type { SdkContext } from "./context.js";
export type ActionMode = "merchant" | "relayer";
export declare function assertMerchantMode(ctx: SdkContext, action: string): void;
export declare function assertRelayerMode(ctx: SdkContext, action: string): void;
//# sourceMappingURL=mode.d.ts.map