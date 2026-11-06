import { accountAbi, accountFactoryAbi, merchantOrdersAbi, merchantRegistryAbi, merchantSpenderAbi, orderCollectorAbi } from "../abi/index.js";
/// Builds call descriptions for each contract the SDK talks to. Keeps each address and ABI pair in one place.
export function registryCall(ctx, functionName, args = []) {
    return { address: ctx.addresses.registry, abi: merchantRegistryAbi, functionName, args };
}
export function bookCall(book, functionName, args = []) {
    return { address: book, abi: merchantOrdersAbi, functionName, args };
}
export function collectorCall(collector, functionName, args = []) {
    return { address: collector, abi: orderCollectorAbi, functionName, args };
}
export function spenderCall(ctx, functionName, args = []) {
    return { address: ctx.addresses.spender, abi: merchantSpenderAbi, functionName, args };
}
/// A call to a smart account, customer or merchant. Base functions (owner, grant, send, freeze) work on both kinds.
export function accountCall(account, functionName, args = []) {
    return { address: account, abi: accountAbi, functionName, args };
}
/// A call to the account factory.
export function accountFactoryCall(factory, functionName, args = []) {
    return { address: factory, abi: accountFactoryAbi, functionName, args };
}
//# sourceMappingURL=calls.js.map