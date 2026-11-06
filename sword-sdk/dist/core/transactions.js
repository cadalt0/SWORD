import { withErrors } from "../abi/index.js";
import { toSwordError, SwordError } from "./errors.js";
/// Simulates a contract call first, so a rejected call costs no gas, then sends it and waits for the receipt.
export async function sendTransaction(ctx, call) {
    await assertWalletOnChain(ctx);
    try {
        const { request } = await ctx.publicClient.simulateContract({
            account: ctx.walletClient.account,
            address: call.address,
            abi: withErrors(call.abi),
            functionName: call.functionName,
            args: call.args ?? [],
        });
        const hash = await ctx.walletClient.writeContract(request);
        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
            throw new SwordError("TRANSACTION_REVERTED", `Transaction ${hash} reverted`);
        }
        return { hash, receipt };
    }
    catch (error) {
        throw toSwordError(error);
    }
}
/// Throws unless the wallet is on the chain the SDK is set to. Checked before signing or sending anything.
export async function assertWalletOnChain(ctx) {
    const walletChain = await ctx.walletClient.getChainId();
    if (walletChain !== ctx.chain.id) {
        throw new SwordError("WRONG_NETWORK", `The wallet is on chain ${walletChain}, but the SDK is set to chain ${ctx.chain.id}. Switch the wallet network first.`);
    }
}
/// Reads a view function. Reverts are converted to SwordError the same way as writes.
export async function readCall(ctx, call) {
    try {
        return (await ctx.publicClient.readContract({
            address: call.address,
            abi: withErrors(call.abi),
            functionName: call.functionName,
            args: call.args ?? [],
        }));
    }
    catch (error) {
        throw toSwordError(error);
    }
}
/// Returns the timestamp of the latest block. Contract time checks use this clock, not the local one.
export async function chainTime(ctx) {
    try {
        const block = await ctx.publicClient.getBlock({ blockTag: "latest" });
        return block.timestamp;
    }
    catch (error) {
        throw toSwordError(error);
    }
}
//# sourceMappingURL=transactions.js.map