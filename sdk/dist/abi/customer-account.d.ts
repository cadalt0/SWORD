export declare const customerAccountAbi: readonly [{
    readonly inputs: readonly [];
    readonly name: "AccountFrozen";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "target";
        readonly type: "address";
    }];
    readonly name: "AddressEmptyCode";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "AlreadyInitialized";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ECDSAInvalidSignature";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "length";
        readonly type: "uint256";
    }];
    readonly name: "ECDSAInvalidSignatureLength";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "s";
        readonly type: "bytes32";
    }];
    readonly name: "ECDSAInvalidSignatureS";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "FailedCall";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "GrantCapTooHigh";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "GrantExpired";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "GrantLimitExceeded";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "GrantMissing";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "GrantTooLong";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "balance";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "needed";
        readonly type: "uint256";
    }];
    readonly name: "InsufficientBalance";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidGrantRelayer";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidNonce";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidShortString";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidSigner";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotAuthorized";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotOwner";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "OrderNotOpen";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ReentrancyGuardReentrantCall";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "token";
        readonly type: "address";
    }];
    readonly name: "SafeERC20FailedOperation";
    readonly type: "error";
}, {
    readonly inputs: readonly [{
        readonly internalType: "string";
        readonly name: "str";
        readonly type: "string";
    }];
    readonly name: "StringTooLong";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ZeroAddress";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ZeroAmount";
    readonly type: "error";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "relayer";
        readonly type: "address";
    }];
    readonly name: "AccountInitialized";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [];
    readonly name: "EIP712DomainChanged";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "target";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "value";
        readonly type: "uint256";
    }];
    readonly name: "Executed";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
    }];
    readonly name: "Frozen";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "nonce";
        readonly type: "uint256";
    }];
    readonly name: "GrantRevoked";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "relayer";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "maxAmount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "nonce";
        readonly type: "uint256";
    }];
    readonly name: "GrantSet";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "OrderPaid";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }];
    readonly name: "OrderRefundRequested";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "SubscriptionCancelled";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }];
    readonly name: "SubscriptionRefundRequested";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "totalApproved";
        readonly type: "uint256";
    }];
    readonly name: "SubscriptionStarted";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [];
    readonly name: "Unfrozen";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "UsdtSent";
    readonly type: "event";
}, {
    readonly inputs: readonly [];
    readonly name: "MAX_GRANT_AMOUNT";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "MAX_GRANT_DURATION";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "cancelSubscription";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "eip712Domain";
    readonly outputs: readonly [{
        readonly internalType: "bytes1";
        readonly name: "fields";
        readonly type: "bytes1";
    }, {
        readonly internalType: "string";
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly internalType: "string";
        readonly name: "version";
        readonly type: "string";
    }, {
        readonly internalType: "uint256";
        readonly name: "chainId";
        readonly type: "uint256";
    }, {
        readonly internalType: "address";
        readonly name: "verifyingContract";
        readonly type: "address";
    }, {
        readonly internalType: "bytes32";
        readonly name: "salt";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256[]";
        readonly name: "extensions";
        readonly type: "uint256[]";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "target";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "value";
        readonly type: "uint256";
    }, {
        readonly internalType: "bytes";
        readonly name: "data";
        readonly type: "bytes";
    }];
    readonly name: "execute";
    readonly outputs: readonly [{
        readonly internalType: "bytes";
        readonly name: "";
        readonly type: "bytes";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
    }];
    readonly name: "freeze";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "freezeReason";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "frozen";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "grant";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "relayer";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "maxAmount";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "nonce";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "grantUsed";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "relayer_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "usdt_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "spender_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "registry_";
        readonly type: "address";
    }];
    readonly name: "initialize";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "nonce";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "owner";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }];
    readonly name: "payOrder";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "registry";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "relayer";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }, {
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }];
    readonly name: "requestOrderRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }];
    readonly name: "requestSubscriptionRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "revokeGrant";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "sendUsdt";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly components: readonly [{
            readonly internalType: "address";
            readonly name: "relayer";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "expiry";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxAmount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "nonce";
            readonly type: "uint256";
        }];
        readonly internalType: "struct AccountBase.Grant";
        readonly name: "g";
        readonly type: "tuple";
    }, {
        readonly internalType: "bytes";
        readonly name: "signature";
        readonly type: "bytes";
    }];
    readonly name: "setGrant";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "spender";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "subscribe";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "unfreeze";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "usdt";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "usdtBalance";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly stateMutability: "payable";
    readonly type: "receive";
}];
//# sourceMappingURL=customer-account.d.ts.map