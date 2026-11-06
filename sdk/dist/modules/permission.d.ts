import { type Address } from "viem";
import type { SdkContext } from "../core/context.js";
import { type GrantRequest, type SignedMandate } from "../signing/mandate.js";
import type { PermissionView, TransactionResult } from "../types.js";
export interface PrepareGrantInput {
    readonly merchant: string;
    readonly relayer: string;
    readonly validForDays: number;
    readonly maxOrders: number;
    readonly maxActions: number;
    readonly maxAmount: string;
}
export declare class PermissionModule {
    private readonly ctx;
    constructor(ctx: SdkContext);
    status(merchant: string): Promise<PermissionView>;
    prepare(input: PrepareGrantInput): Promise<GrantRequest>;
    sign(request: GrantRequest): Promise<SignedMandate>;
    submit(signed: SignedMandate): Promise<TransactionResult>;
    revoke(): Promise<TransactionResult>;
}
export declare function readPermission(ctx: SdkContext, merchant: Address): Promise<PermissionView>;
export declare function requirePermission(ctx: SdkContext, merchant: Address): Promise<void>;
//# sourceMappingURL=permission.d.ts.map