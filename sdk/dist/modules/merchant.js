import { erc20Abi } from "../abi/index.js";
import { ZERO_ADDRESS } from "../config/constants.js";
import { registryCall } from "../core/calls.js";
import { assertMerchantMode } from "../core/mode.js";
import { resolveBook } from "../core/resolve.js";
import { parseUsdt } from "../core/units.js";
import { readCall, sendTransaction } from "../core/transactions.js";
import { assertAddress } from "../core/validate.js";
/// Merchant registration and the merchant's own token approval. These need the merchant's wallet.
export class MerchantModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Registers the merchant wallet and deploys its order book. Does nothing if already registered. Merchant mode only.
    async register() {
        assertMerchantMode(this.ctx, "Registering");
        const merchant = this.ctx.walletClient.account.address;
        const existing = await readCall(this.ctx, registryCall(this.ctx, "bookOf", [merchant]));
        if (existing !== ZERO_ADDRESS) {
            return { book: existing, created: false };
        }
        const transaction = await sendTransaction(this.ctx, registryCall(this.ctx, "register"));
        const book = await resolveBook(this.ctx, merchant);
        return { book, created: true, transaction };
    }
    /// Returns the merchant's order book, or undefined if the merchant has not registered. Works in either mode.
    async getBook(merchant) {
        const book = await readCall(this.ctx, registryCall(this.ctx, "bookOf", [assertAddress(merchant, "merchant")]));
        return book === ZERO_ADDRESS ? undefined : book;
    }
    /// Lets the spender pay refunds from the merchant's wallet, up to `amount`. Needed before paying refunds
    /// on withdrawn orders. Replaces any earlier approval. Pass "0" to remove it. Merchant mode only.
    async approveRefundSpender(amount) {
        assertMerchantMode(this.ctx, "Approving the spender");
        const value = parseUsdt(amount, { allowZero: true });
        return sendTransaction(this.ctx, {
            address: this.ctx.addresses.usdt,
            abi: erc20Abi,
            functionName: "approve",
            args: [this.ctx.addresses.spender, value],
        });
    }
    /// How much the spender may still pay from the merchant's wallet for refunds, in USDT base units.
    async refundAllowance(merchant) {
        return readCall(this.ctx, {
            address: this.ctx.addresses.usdt,
            abi: erc20Abi,
            functionName: "allowance",
            args: [assertAddress(merchant, "merchant"), this.ctx.addresses.spender],
        });
    }
}
//# sourceMappingURL=merchant.js.map