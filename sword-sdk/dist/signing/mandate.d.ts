import type { Address, Hex } from "viem";
export interface MandateTerms {
    readonly relayer: Address;
    readonly expiry: bigint;
    readonly maxOrders: bigint;
    readonly maxActions: bigint;
    readonly maxAmount: bigint;
    readonly nonce: bigint;
}
export interface GrantRequest {
    readonly merchant: Address;
    readonly book: Address;
    readonly terms: MandateTerms;
}
export interface SignedMandate {
    readonly merchant: Address;
    readonly book: Address;
    readonly terms: MandateTerms;
    readonly signature: Hex;
}
export declare const MANDATE_TYPES: {
    readonly Mandate: readonly [{
        readonly name: "relayer";
        readonly type: "address";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly name: "maxOrders";
        readonly type: "uint256";
    }, {
        readonly name: "maxActions";
        readonly type: "uint256";
    }, {
        readonly name: "maxAmount";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }];
};
export declare function mandateDomain(chainId: number, book: Address): {
    readonly name: "MerchantOrders";
    readonly version: "2";
    readonly chainId: number;
    readonly verifyingContract: `0x${string}`;
};
export declare function mandateTypedData(chainId: number, book: Address, terms: MandateTerms): {
    readonly domain: {
        readonly name: "MerchantOrders";
        readonly version: "2";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly Mandate: readonly [{
            readonly name: "relayer";
            readonly type: "address";
        }, {
            readonly name: "expiry";
            readonly type: "uint256";
        }, {
            readonly name: "maxOrders";
            readonly type: "uint256";
        }, {
            readonly name: "maxActions";
            readonly type: "uint256";
        }, {
            readonly name: "maxAmount";
            readonly type: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }];
    };
    readonly primaryType: "Mandate";
    readonly message: {
        readonly relayer: Address;
        readonly expiry: bigint;
        readonly maxOrders: bigint;
        readonly maxActions: bigint;
        readonly maxAmount: bigint;
        readonly nonce: bigint;
    };
};
//# sourceMappingURL=mandate.d.ts.map