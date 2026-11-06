export const ACCOUNT_GRANT_TYPES = {
    SmartAccountGrant: [
        { name: "relayer", type: "address" },
        { name: "expiry", type: "uint256" },
        { name: "maxAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
    ],
};
/// The EIP-712 domain for a smart account. The verifying contract is the account itself.
export function accountGrantDomain(chainId, account) {
    return { name: "SmartAccount", version: "1", chainId, verifyingContract: account };
}
/// The full typed-data payload for signing or verifying a grant.
export function accountGrantTypedData(chainId, account, terms) {
    return {
        domain: accountGrantDomain(chainId, account),
        types: ACCOUNT_GRANT_TYPES,
        primaryType: "SmartAccountGrant",
        message: { ...terms },
    };
}
//# sourceMappingURL=grant.js.map