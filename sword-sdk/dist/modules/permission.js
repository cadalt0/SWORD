import { isAddressEqual } from "viem";
import { MAX_MANDATE_ACTIONS, MAX_MANDATE_AMOUNT, MAX_MANDATE_DURATION_SECONDS, MAX_MANDATE_ORDERS, } from "../config/constants.js";
import { bookCall } from "../core/calls.js";
import { SwordError } from "../core/errors.js";
import { assertMerchantMode } from "../core/mode.js";
import { resolveBook } from "../core/resolve.js";
import { parseUsdt } from "../core/units.js";
import { assertWalletOnChain, chainTime, readCall, sendTransaction } from "../core/transactions.js";
import { toPermissionView } from "../core/views.js";
import { assertAddress, assertIntegerInRange } from "../core/validate.js";
import { mandateTypedData } from "../signing/mandate.js";
/// The merchant's permission for its relayer: status, preparing, signing, submitting, and revoking.
export class PermissionModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// Returns the current permission for a merchant, with days left and whether renewal is due.
    async status(merchant) {
        return readPermission(this.ctx, assertAddress(merchant, "merchant"));
    }
    /// Builds the permission the merchant is asked to sign. Nothing is signed or sent. Works in either mode.
    async prepare(input) {
        const merchant = assertAddress(input.merchant, "merchant");
        const relayer = assertAddress(input.relayer, "relayer");
        const validForDays = assertIntegerInRange(input.validForDays, 1, Math.floor(MAX_MANDATE_DURATION_SECONDS / 86_400), "validForDays");
        const maxOrders = assertIntegerInRange(input.maxOrders, 0, Number(MAX_MANDATE_ORDERS), "maxOrders");
        const maxActions = assertIntegerInRange(input.maxActions, 0, Number(MAX_MANDATE_ACTIONS), "maxActions");
        const maxAmount = parseUsdt(input.maxAmount, { allowZero: true });
        if (maxAmount > MAX_MANDATE_AMOUNT) {
            throw new SwordError("INVALID_INPUT", "maxAmount is above the limit of 1000 USDT per permission");
        }
        const book = await resolveBook(this.ctx, merchant);
        const nonce = await readCall(this.ctx, bookCall(book, "nonce"));
        const now = await chainTime(this.ctx);
        const terms = {
            relayer,
            expiry: now + BigInt(validForDays) * 86400n,
            maxOrders: BigInt(maxOrders),
            maxActions: BigInt(maxActions),
            maxAmount,
            nonce,
        };
        return { merchant, book, terms };
    }
    /// Signs a prepared permission with the merchant's wallet. Merchant mode only.
    async sign(request) {
        assertMerchantMode(this.ctx, "Signing a permission");
        await assertWalletOnChain(this.ctx);
        if (!isAddressEqual(this.ctx.walletClient.account.address, request.merchant)) {
            throw new SwordError("NOT_THE_MERCHANT", "Only the merchant can sign its own permission");
        }
        const signature = await this.ctx.walletClient.signTypedData({
            account: this.ctx.walletClient.account,
            ...mandateTypedData(this.ctx.chain.id, request.book, request.terms),
        });
        return { merchant: request.merchant, book: request.book, terms: request.terms, signature };
    }
    /// Submits a signed permission to the merchant's book. Either mode can submit; the merchant's signature is what counts.
    async submit(signed) {
        return sendTransaction(this.ctx, bookCall(signed.book, "setMandate", [signed.terms, signed.signature]));
    }
    /// Revokes the merchant's permission at once. Old signatures stop working. Merchant mode only.
    async revoke() {
        assertMerchantMode(this.ctx, "Revoking a permission");
        const book = await resolveBook(this.ctx, this.ctx.walletClient.account.address);
        return sendTransaction(this.ctx, bookCall(book, "revoke"));
    }
}
/// Reads a merchant's permission from its book.
export async function readPermission(ctx, merchant) {
    const book = await resolveBook(ctx, merchant);
    const [mandate, usage] = await readCall(ctx, bookCall(book, "getMandate"));
    const now = await chainTime(ctx);
    return toPermissionView(mandate, usage, now);
}
/// Throws unless the merchant has an active permission for this instance's relayer.
/// In merchant mode the merchant acts directly, so no permission is needed and nothing is checked.
export async function requirePermission(ctx, merchant) {
    if (ctx.mode === "merchant")
        return;
    const view = await readPermission(ctx, merchant);
    if (view.state !== "active" || !view.terms) {
        throw new SwordError("PERMISSION_REQUIRED", `The merchant has no active permission (${view.state}). Ask the merchant to grant a new one.`);
    }
    if (!isAddressEqual(view.terms.relayer, ctx.walletClient.account.address)) {
        throw new SwordError("PERMISSION_FOR_OTHER_RELAYER", "The merchant's permission names a different relayer");
    }
}
//# sourceMappingURL=permission.js.map