export declare const merchantSpenderAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "usdt_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "registry_";
        readonly type: "address";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "constructor";
}, {
    readonly inputs: readonly [];
    readonly name: "AllPeriodsPaid";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "AlreadyCancelled";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "AlreadyTaken";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "FailedDeployment";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InsufficientAllowance";
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
    readonly name: "InvalidPeriods";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NoRefundRequest";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotApproved";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotAuthorized";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotCancellable";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotStarted";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotSubscriber";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotWithdrawn";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NothingToWithdraw";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "OrderNotOpen";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "PeriodNotDue";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ReentrancyGuardReentrantCall";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "RefundAlreadyOpen";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "RefundTooLarge";
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
    readonly inputs: readonly [];
    readonly name: "SubscriptionExists";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "SubscriptionIsCancelled";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "SubscriptionNotFound";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "UnknownBook";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "UnknownCollector";
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
        readonly name: "collector";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "payer";
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
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "index";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "periodStart";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "periodEnd";
        readonly type: "uint256";
    }];
    readonly name: "PeriodPaid";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "payer";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "RefundPulled";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "by";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint64";
        readonly name: "cancelledAt";
        readonly type: "uint64";
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
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "address";
        readonly name: "vault";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "periodLength";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "periods";
        readonly type: "uint256";
    }];
    readonly name: "SubscriptionCreated";
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
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "SubscriptionRefundDenied";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "subscriber";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
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
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "subscriber";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "fromVault";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "SubscriptionRefunded";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "subscriber";
        readonly type: "address";
    }];
    readonly name: "SubscriptionStarted";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "SubscriptionWithdrawn";
    readonly type: "event";
}, {
    readonly inputs: readonly [];
    readonly name: "MAX_PERIOD";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "MAX_PERIODS";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "MIN_PERIOD";
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
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "chargeNext";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "ref";
        readonly type: "bytes32";
    }, {
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "relayer_";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "periodLength";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "periods";
        readonly type: "uint256";
    }];
    readonly name: "createSubscription";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "denySubscriptionRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "getSubscription";
    readonly outputs: readonly [{
        readonly components: readonly [{
            readonly internalType: "address";
            readonly name: "merchant";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "relayer";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "subscriber";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "vault";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint64";
            readonly name: "periodLength";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint32";
            readonly name: "periods";
            readonly type: "uint32";
        }, {
            readonly internalType: "uint32";
            readonly name: "paidPeriods";
            readonly type: "uint32";
        }, {
            readonly internalType: "uint64";
            readonly name: "createdAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "startedAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "cancelledAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "bool";
            readonly name: "exists";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "cancelled";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "refundRequested";
            readonly type: "bool";
        }, {
            readonly internalType: "uint256";
            readonly name: "collected";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "refunded";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "withdrawn";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "requestedAmount";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "requestReasonHash";
            readonly type: "bytes32";
        }];
        readonly internalType: "struct MerchantSpender.Subscription";
        readonly name: "";
        readonly type: "tuple";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "at";
        readonly type: "uint256";
    }];
    readonly name: "hasAccess";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "heldBalance";
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
        readonly name: "collector";
        readonly type: "address";
    }];
    readonly name: "payOrder";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "index";
        readonly type: "uint256";
    }];
    readonly name: "periodPaidAt";
    readonly outputs: readonly [{
        readonly internalType: "uint64";
        readonly name: "";
        readonly type: "uint64";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "collector";
        readonly type: "address";
    }];
    readonly name: "pullRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "refundSubscription";
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
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }, {
        readonly internalType: "bytes32";
        readonly name: "ref";
        readonly type: "bytes32";
    }];
    readonly name: "subscriptionIdOf";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "pure";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "subscriptionStatus";
    readonly outputs: readonly [{
        readonly internalType: "enum MerchantSpender.SubStatus";
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "id";
        readonly type: "bytes32";
    }];
    readonly name: "subscriptionTerms";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "periods";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
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
    readonly name: "vaultImplementation";
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
    readonly name: "vaultOf";
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
    readonly name: "withdrawSubscription";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
//# sourceMappingURL=merchant-spender.d.ts.map