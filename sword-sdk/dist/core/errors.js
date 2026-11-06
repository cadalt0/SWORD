import { BaseError, ContractFunctionRevertedError } from "viem";
/// The error every SDK call throws. `code` is stable and safe to match on in integration code.
/// Contract errors use their name in SCREAMING_SNAKE_CASE, for example `NOT_AUTHORIZED` or `MANDATE_EXPIRED`.
export class SwordError extends Error {
    code;
    /// Name of the contract error, when the failure came from a contract revert.
    contractError;
    constructor(code, message, options = {}) {
        super(message, { cause: options.cause });
        this.name = "SwordError";
        this.code = code;
        this.contractError = options.contractError;
    }
}
/// Turns any thrown value into a SwordError. Reverts are decoded to their contract error name.
export function toSwordError(error) {
    if (error instanceof SwordError)
        return error;
    if (error instanceof BaseError) {
        const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
        if (reverted instanceof ContractFunctionRevertedError) {
            const name = reverted.data?.errorName;
            if (name) {
                return new SwordError(toCode(name), `Contract rejected the call: ${name}`, {
                    cause: error,
                    contractError: name,
                });
            }
            return new SwordError("REVERTED", reverted.shortMessage || "Contract call reverted", { cause: error });
        }
        return new SwordError("CHAIN_CALL_FAILED", error.shortMessage || error.message, { cause: error });
    }
    return new SwordError("UNKNOWN", error instanceof Error ? error.message : String(error), { cause: error });
}
/// Converts an error name such as `InvalidSigner` to a code such as `INVALID_SIGNER`.
function toCode(errorName) {
    return errorName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}
//# sourceMappingURL=errors.js.map