import type { Address, Hex } from "viem";
import { type AccountKind } from "../../core/accounts.js";
import type { SdkContext } from "../../core/context.js";
import { type AccountGrantRequest, type AccountGrantTerms, type SignedAccountGrant } from "../../signing/grant.js";
import type { TransactionResult } from "../../types.js";
import { CustomerAccountActions } from "./customer.js";
import { MerchantAccountActions } from "./merchant.js";
export type { AccountKind };
export interface AccountStatus {
    readonly account: Address;
    readonly owner: Address;
    readonly relayer: Address;
    readonly frozen: boolean;
    readonly freezeReason: Hex;
    readonly usdtBalance: bigint;
    readonly grant: AccountGrantTerms | undefined;
    readonly grantUsed: bigint;
    readonly grantActive: boolean;
}
export declare class AccountsModule {
    private readonly ctx;
    readonly customer: CustomerAccountActions;
    readonly merchant: MerchantAccountActions;
    constructor(ctx: SdkContext);
    create(input: {
        readonly kind: AccountKind;
        readonly identifier: string;
        readonly owner: string;
    }): Promise<{
        account: Address;
        created: boolean;
        transaction?: TransactionResult;
    }>;
    predict(input: {
        readonly kind: AccountKind;
        readonly identifier: string;
    }): Promise<Address>;
    accountOf(kind: AccountKind, identifier: string): Promise<Address | undefined>;
    status(account: string): Promise<AccountStatus>;
    prepareGrant(input: {
        readonly account: string;
        readonly maxAmount: string;
        readonly validForDays: number;
    }): Promise<AccountGrantRequest>;
    signGrant(request: AccountGrantRequest): Promise<SignedAccountGrant>;
    submitGrant(signed: SignedAccountGrant): Promise<TransactionResult>;
    revokeGrant(account: string): Promise<TransactionResult>;
    sendUsdt(input: {
        readonly account: string;
        readonly to: string;
        readonly amount: string;
    }): Promise<TransactionResult>;
    execute(input: {
        readonly account: string;
        readonly target: string;
        readonly value?: bigint;
        readonly data: Hex;
    }): Promise<TransactionResult>;
    freeze(input: {
        readonly account: string;
        readonly reason: string;
    }): Promise<TransactionResult>;
    unfreeze(account: string): Promise<TransactionResult>;
}
//# sourceMappingURL=accounts.d.ts.map