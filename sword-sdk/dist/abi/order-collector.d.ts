export declare const orderCollectorAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "usdt_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "merchant_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "relayer_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "book_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "spender_";
        readonly type: "address";
    }, {
        readonly internalType: "bytes32";
        readonly name: "orderId_";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount_";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "refundWindow_";
        readonly type: "uint256";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "constructor";
}, {
    readonly inputs: readonly [];
    readonly name: "AmountTooLarge";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "BalanceNotZero";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ExtraFundsPending";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InsufficientBalance";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidRefundWindow";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "InvalidStatus";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NoPayer";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NoRefundRequest";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotAuthorized";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotBook";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotClosable";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotExpired";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotMerchant";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotOpen";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotPaid";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotPayer";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotSpender";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NotWithdrawn";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "NothingToRefund";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "OrderExpired";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "RefundAlreadyOpen";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ReuseDelayActive";
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
    readonly name: "WithdrawnRefundNeedsSpender";
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
    readonly inputs: readonly [];
    readonly name: "ZeroOrderId";
    readonly type: "error";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
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
    readonly name: "FailedOrderRefunded";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
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
    readonly name: "FundsRefunded";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint64";
        readonly name: "closedAt";
        readonly type: "uint64";
    }];
    readonly name: "OrderClosed";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }];
    readonly name: "OrderFailed";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "epoch";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "uint64";
        readonly name: "expiresAt";
        readonly type: "uint64";
    }];
    readonly name: "OrderReset";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
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
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "txHash";
        readonly type: "bytes32";
    }];
    readonly name: "PaymentReceived";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "RefundApproved";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "RefundDenied";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
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
    }, {
        readonly indexed: false;
        readonly internalType: "bool";
        readonly name: "fromMerchantWallet";
        readonly type: "bool";
    }];
    readonly name: "RefundExecuted";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "RefundInitiated";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "RefundRecorded";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "payer";
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
    readonly name: "RefundRequested";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint64";
        readonly name: "refundWindow";
        readonly type: "uint64";
    }];
    readonly name: "RefundWindowSet";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "orderId";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "Withdrawn";
    readonly type: "event";
}, {
    readonly inputs: readonly [];
    readonly name: "MAX_REFUND_WINDOW";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "MIN_REFUND_WINDOW";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "ORDER_TTL";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "REUSE_DELAY";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly name: "approveRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "book";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "close";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "denyRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "epoch";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "executeRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "expire";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "failOrder";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "getState";
    readonly outputs: readonly [{
        readonly components: readonly [{
            readonly internalType: "bytes32";
            readonly name: "orderId";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "epoch";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint64";
            readonly name: "expiresAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "refundWindow";
            readonly type: "uint64";
        }, {
            readonly internalType: "enum OrderCollector.OrderStatus";
            readonly name: "status";
            readonly type: "uint8";
        }, {
            readonly internalType: "address";
            readonly name: "payer";
            readonly type: "address";
        }, {
            readonly internalType: "uint64";
            readonly name: "paidAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "bytes32";
            readonly name: "paymentTxHash";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bool";
            readonly name: "withdrawn";
            readonly type: "bool";
        }, {
            readonly internalType: "uint64";
            readonly name: "settledAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "closedAt";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint256";
            readonly name: "refundedAmount";
            readonly type: "uint256";
        }, {
            readonly internalType: "enum OrderCollector.RefundStatus";
            readonly name: "refundStatus";
            readonly type: "uint8";
        }, {
            readonly internalType: "uint256";
            readonly name: "refundRequestedAmount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "refundApprovedAmount";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "refundReasonHash";
            readonly type: "bytes32";
        }];
        readonly internalType: "struct OrderCollector.State";
        readonly name: "";
        readonly type: "tuple";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly internalType: "bytes32";
        readonly name: "noteHash";
        readonly type: "bytes32";
    }];
    readonly name: "initiateRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "payer";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "transferTime";
        readonly type: "uint256";
    }, {
        readonly internalType: "bytes32";
        readonly name: "txHash";
        readonly type: "bytes32";
    }];
    readonly name: "markPaid";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "merchant";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "payInfo";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "open";
        readonly type: "bool";
    }, {
        readonly internalType: "uint256";
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "pullInfo";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "withdrawn";
        readonly type: "bool";
    }, {
        readonly internalType: "uint8";
        readonly name: "status";
        readonly type: "uint8";
    }, {
        readonly internalType: "address";
        readonly name: "payer";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "approvedAmount";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "payer";
        readonly type: "address";
    }];
    readonly name: "recordPayment";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "refundAmount";
        readonly type: "uint256";
    }];
    readonly name: "recordRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "refundFailedOrder";
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
        readonly name: "refundAmount";
        readonly type: "uint256";
    }];
    readonly name: "refundTo";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
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
        readonly internalType: "bytes32";
        readonly name: "reasonHash";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "requestedAmount";
        readonly type: "uint256";
    }];
    readonly name: "requestRefund";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "newOrderId";
        readonly type: "bytes32";
    }, {
        readonly internalType: "uint256";
        readonly name: "newAmount";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "newRefundWindow";
        readonly type: "uint256";
    }];
    readonly name: "reset";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "refundDays";
        readonly type: "uint256";
    }];
    readonly name: "setRefundWindow";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "settleWithdrawnRefund";
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
    readonly name: "withdraw";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
//# sourceMappingURL=order-collector.d.ts.map