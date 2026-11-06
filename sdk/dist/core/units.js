import { formatUnits, parseUnits } from "viem";
import { USDT_DECIMALS } from "../config/constants.js";
import { SwordError } from "./errors.js";
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
/// Converts a decimal USDT string such as "25.50" into base units (25500000n).
/// Rejects zero, negative values, and more decimal places than USDT supports.
export function parseUsdt(amount, options = {}) {
    if (!DECIMAL_PATTERN.test(amount)) {
        throw new SwordError("INVALID_AMOUNT", `Amount must be a plain decimal number, got "${amount}"`);
    }
    const [, fraction = ""] = amount.split(".");
    if (fraction.length > USDT_DECIMALS) {
        throw new SwordError("INVALID_AMOUNT", `USDT has ${USDT_DECIMALS} decimal places at most, got "${amount}"`);
    }
    const value = parseUnits(amount, USDT_DECIMALS);
    if (value === 0n && !options.allowZero) {
        throw new SwordError("INVALID_AMOUNT", "Amount must be greater than zero");
    }
    return value;
}
/// Converts base units to a decimal USDT string such as "25.5".
export function formatUsdt(value) {
    return formatUnits(value, USDT_DECIMALS);
}
//# sourceMappingURL=units.js.map