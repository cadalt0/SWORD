import { erc20Abi, orderCollectorAbi } from "../abi/index.js";
import { spenderCall } from "../core/calls.js";
import { SwordError } from "../core/errors.js";
import { parseUsdt } from "../core/units.js";
import { collectorFor } from "../core/resolve.js";
import { readCall, sendTransaction } from "../core/transactions.js";
import { assertAddress } from "../core/validate.js";
/// Paying an order from a normal wallet (not a Sword account). The wallet approves the spender once for the
/// amount, then pays the order through the spender. Two transactions, both signed in the wallet.
export class PaymentsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Lets the spender move up to `amount` of the wallet's USDT. Replaces any earlier approval.
    async approve(amount) {
        return sendTransaction(this.ctx, {
            address: this.ctx.addresses.usdt,
            abi: erc20Abi,
            functionName: "approve",
            args: [this.ctx.addresses.spender, parseUsdt(amount)],
        });
    }
    /// How much USDT the spender may still move from `owner`, in base units.
    async allowance(owner) {
        return readCall(this.ctx, {
            address: this.ctx.addresses.usdt,
            abi: erc20Abi,
            functionName: "allowance",
            args: [assertAddress(owner, "owner"), this.ctx.addresses.spender],
        });
    }
    /// Pays an open order from the wallet. The exact order amount must already be approved.
    async payOrder(input) {
        const collector = await collectorFor(this.ctx, assertAddress(input.merchant, "merchant"), input.orderId);
        const [open, amount] = await readCall(this.ctx, {
            address: collector,
            abi: orderCollectorAbi,
            functionName: "payInfo",
            args: [],
        });
        if (!open)
            throw new SwordError("ORDER_NOT_OPEN", "This order is not accepting payment");
        const owner = this.ctx.walletClient.account.address;
        const allowed = await this.allowance(owner);
        if (allowed < amount) {
            throw new SwordError("INSUFFICIENT_ALLOWANCE", "Approve the amount first");
        }
        return sendTransaction(this.ctx, spenderCall(this.ctx, "payOrder", [collector]));
    }
}
//# sourceMappingURL=payments.js.map