export declare const merchantRegistryAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "usdt_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "spender_";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "factory_";
        readonly type: "address";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "constructor";
}, {
    readonly inputs: readonly [];
    readonly name: "AlreadyRegistered";
    readonly type: "error";
}, {
    readonly inputs: readonly [];
    readonly name: "ZeroAddress";
    readonly type: "error";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "book";
        readonly type: "address";
    }];
    readonly name: "MerchantRegistered";
    readonly type: "event";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "merchant";
        readonly type: "address";
    }];
    readonly name: "bookOf";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "book";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "factory";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "merchantCount";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "register";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "book";
        readonly type: "address";
    }];
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
}];
//# sourceMappingURL=merchant-registry.d.ts.map