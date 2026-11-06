import type { Address, Hex } from "viem";
export interface AccountGrantTerms {
    readonly relayer: Address;
    readonly expiry: bigint;
    readonly maxAmount: bigint;
    readonly nonce: bigint;
}
export interface AccountGrantRequest {
    readonly account: Address;
    readonly terms: AccountGrantTerms;
}
export interface SignedAccountGrant {
    readonly account: Address;
    readonly terms: AccountGrantTerms;
    readonly signature: Hex;
}
export declare const ACCOUNT_GRANT_TYPES: {
    readonly SmartAccountGrant: readonly [{
        readonly name: "relayer";
        readonly type: "address";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly name: "maxAmount";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }];
};
export declare function accountGrantDomain(chainId: number, account: Address): {
    readonly name: "SmartAccount";
    readonly version: "1";
    readonly chainId: number;
    readonly verifyingContract: `0x${string}`;
};
export declare function accountGrantTypedData(chainId: number, account: Address, terms: AccountGrantTerms): {
    readonly domain: {
        readonly name: "SmartAccount";
        readonly version: "1";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly SmartAccountGrant: readonly [{
            readonly name: "relayer";
            readonly type: "address";
        }, {
            readonly name: "expiry";
            readonly type: "uint256";
        }, {
            readonly name: "maxAmount";
            readonly type: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }];
    };
    readonly primaryType: "SmartAccountGrant";
    readonly message: {
        readonly relayer: Address;
        readonly expiry: bigint;
        readonly maxAmount: bigint;
        readonly nonce: bigint;
    };
};
//# sourceMappingURL=grant.d.ts.map