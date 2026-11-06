import { isAddress } from "viem";
import { SwordError } from "./errors.js";
/// Checks that a value is a 20-byte hex address and returns it typed as an Address.
export function assertAddress(value, name) {
    if (!isAddress(value, { strict: false })) {
        throw new SwordError("INVALID_ADDRESS", `${name} is not a valid address: "${value}"`);
    }
    return value;
}
/// Checks that a whole number lies within [min, max].
export function assertIntegerInRange(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new SwordError("INVALID_INPUT", `${name} must be a whole number from ${min} to ${max}, got ${value}`);
    }
    return value;
}
/// Checks that a value is positive.
export function assertPositive(value, name) {
    if (value <= 0n) {
        throw new SwordError("INVALID_INPUT", `${name} must be greater than zero`);
    }
    return value;
}
//# sourceMappingURL=validate.js.map