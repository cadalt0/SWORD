import { encodeAbiParameters, keccak256, stringToHex } from "viem";
import { MAX_REFERENCE_LENGTH } from "../config/constants.js";
import { SwordError } from "./errors.js";
/// Turns a merchant's own reference (for example a cart or invoice id) into the on-chain order id.
/// The same reference always gives the same id, so creating the same order twice is rejected by the contract.
export function orderIdFromReference(reference) {
    const trimmed = reference.trim();
    if (trimmed.length === 0) {
        throw new SwordError("INVALID_REFERENCE", "Reference must not be empty");
    }
    if (trimmed.length > MAX_REFERENCE_LENGTH) {
        throw new SwordError("INVALID_REFERENCE", `Reference must be at most ${MAX_REFERENCE_LENGTH} characters`);
    }
    return keccak256(stringToHex(trimmed));
}
/// The id a merchant's subscription gets for its reference. Matches the spender's `subscriptionIdOf`.
export function subscriptionIdOf(merchant, reference) {
    return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [merchant, orderIdFromReference(reference)]));
}
/// Turns a free-text reason (for example a refund reason) into the hash stored on chain.
export function reasonHash(reason) {
    return keccak256(stringToHex(reason.trim()));
}
/// Current time in seconds, from the local clock. Use chain time for checks the contract makes.
export function unixNow() {
    return BigInt(Math.floor(Date.now() / 1000));
}
/// Turns a stable login identity (for example the Google account id) into the identifier hash the account factories use.
/// Hash the stable id, not the email: emails can change.
export function identifierHashOf(stableId) {
    const trimmed = stableId.trim();
    if (trimmed.length === 0) {
        throw new SwordError("INVALID_IDENTIFIER", "Identifier must not be empty");
    }
    return keccak256(stringToHex(trimmed));
}
//# sourceMappingURL=ids.js.map