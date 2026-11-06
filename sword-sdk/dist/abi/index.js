import { mergedErrorAbi } from "./errors.js";
import { customerAccountAbi } from "./customer-account.js";
import { merchantAccountAbi } from "./merchant-account.js";
export { accountFactoryAbi } from "./account-factory.js";
export { customerAccountAbi } from "./customer-account.js";
export { erc20Abi } from "./erc20.js";
export { merchantAccountAbi } from "./merchant-account.js";
export { merchantOrdersAbi } from "./merchant-orders.js";
export { merchantRegistryAbi } from "./merchant-registry.js";
export { merchantSpenderAbi } from "./merchant-spender.js";
export { orderCollectorAbi } from "./order-collector.js";
/// The functions of both account kinds, without repeats. Customer and merchant accounts share their base functions,
/// so calls to a base function (owner, grant, send, freeze) work on either kind.
export const accountAbi = dedupeFunctions([...customerAccountAbi, ...merchantAccountAbi]);
/// Appends every Sword error to a function ABI. A revert raised by another contract in the call chain
/// (for example a book error during a collector call) can then still be decoded to its error name.
export function withErrors(abi) {
    return [...abi, ...mergedErrorAbi];
}
function dedupeFunctions(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (item.type !== "function")
            return false;
        const key = `${item.name}(${item.inputs.map((input) => input.type).join(",")})`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=index.js.map