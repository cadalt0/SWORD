import { isAddressEqual } from "viem";
import { SwordError } from "./errors.js";
import { accountCall } from "./calls.js";
import { readCall } from "./transactions.js";
/// Returns the account factory address. Throws if it has not been deployed on this chain yet.
export function accountFactoryOf(ctx) {
    const factory = ctx.addresses.accountFactory;
    if (!factory) {
        throw new SwordError("FACTORY_NOT_DEPLOYED", `The account factory is not deployed on chain ${ctx.chain.id}`);
    }
    return factory;
}
/// Throws unless the signing wallet is the owner of the account.
export async function assertAccountOwner(ctx, account) {
    const owner = await readCall(ctx, accountCall(account, "owner"));
    if (!isAddressEqual(owner, ctx.walletClient.account.address)) {
        throw new SwordError("NOT_ACCOUNT_OWNER", "Only the account's owner can do this");
    }
}
//# sourceMappingURL=accounts.js.map