export const MANDATE_TYPES = {
    Mandate: [
        { name: "relayer", type: "address" },
        { name: "expiry", type: "uint256" },
        { name: "maxOrders", type: "uint256" },
        { name: "maxActions", type: "uint256" },
        { name: "maxAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
    ],
};
/// The EIP-712 domain for a merchant's book. The verifying contract is the book itself.
export function mandateDomain(chainId, book) {
    return { name: "MerchantOrders", version: "2", chainId, verifyingContract: book };
}
/// The full typed-data payload for signing or verifying a permission.
export function mandateTypedData(chainId, book, terms) {
    return {
        domain: mandateDomain(chainId, book),
        types: MANDATE_TYPES,
        primaryType: "Mandate",
        message: { ...terms },
    };
}
//# sourceMappingURL=mandate.js.map