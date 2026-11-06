import { MAX_ACCOUNT_GRANT_AMOUNT, MAX_ACCOUNT_GRANT_DURATION_SECONDS, ZERO_ADDRESS, } from "../../config/constants.js";
import { accountCall, accountFactoryCall } from "../../core/calls.js";
import { accountFactoryOf, assertAccountOwner } from "../../core/accounts.js";
import { SwordError } from "../../core/errors.js";
import { assertRelayerMode } from "../../core/mode.js";
import { identifierHashOf, reasonHash } from "../../core/ids.js";
import { parseUsdt } from "../../core/units.js";
import { chainTime, readCall, sendTransaction } from "../../core/transactions.js";
import { assertAddress, assertIntegerInRange } from "../../core/validate.js";
import { accountGrantTypedData, } from "../../signing/grant.js";
import { CustomerAccountActions } from "./customer.js";
import { MerchantAccountActions } from "./merchant.js";
/// Smart accounts: creation (relayer), lookup, status, the owner's grant, and actions shared by both kinds.
/// Customer actions are under `customer`, merchant actions under `merchant`.
export class AccountsModule {
    ctx;
    /// Actions a customer account takes: paying, subscribing, cancelling, and refund requests.
    customer;
    /// Actions a merchant account takes: registration, orders, refunds, and subscription actions for the merchant.
    merchant;
    constructor(ctx) {
        this.ctx = ctx;
        this.customer = new CustomerAccountActions(ctx);
        this.merchant = new MerchantAccountActions(ctx);
    }
    /// Creates the account for an identity. Relayer mode only. If the identity already has an account of this kind,
    /// nothing is sent and the existing account is returned.
    async create(input) {
        assertRelayerMode(this.ctx, "Creating an account");
        const identifierHash = identifierHashOf(input.identifier);
        const owner = assertAddress(input.owner, "owner");
        const factory = accountFactoryOf(this.ctx);
        const existing = await this.accountOf(input.kind, input.identifier);
        if (existing)
            return { account: existing, created: false };
        const functionName = input.kind === "customer" ? "createCustomerAccount" : "createMerchantAccount";
        const transaction = await sendTransaction(this.ctx, accountFactoryCall(factory, functionName, [identifierHash, owner]));
        const account = await this.accountOf(input.kind, input.identifier);
        if (!account) {
            throw new SwordError("ACCOUNT_NOT_FOUND", "The account was not found after it was created");
        }
        return { account, created: true, transaction };
    }
    /// The address an account of this kind will have, before it is created. Works in either mode.
    async predict(input) {
        const functionName = input.kind === "customer" ? "predictCustomerAccount" : "predictMerchantAccount";
        return readCall(this.ctx, accountFactoryCall(accountFactoryOf(this.ctx), functionName, [identifierHashOf(input.identifier)]));
    }
    /// The account of this kind created for an identity, or undefined if there is none yet.
    async accountOf(kind, identifier) {
        const functionName = kind === "customer" ? "customerAccountOf" : "merchantAccountOf";
        const account = await readCall(this.ctx, accountFactoryCall(accountFactoryOf(this.ctx), functionName, [identifierHashOf(identifier)]));
        return account === ZERO_ADDRESS ? undefined : account;
    }
    /// Full state of one account.
    async status(account) {
        const address = assertAddress(account, "account");
        const [owner, relayer, frozen, freezeReason, usdtBalance, grant, grantUsed] = await Promise.all([
            readCall(this.ctx, accountCall(address, "owner")),
            readCall(this.ctx, accountCall(address, "relayer")),
            readCall(this.ctx, accountCall(address, "frozen")),
            readCall(this.ctx, accountCall(address, "freezeReason")),
            readCall(this.ctx, accountCall(address, "usdtBalance")),
            readCall(this.ctx, accountCall(address, "grant")),
            readCall(this.ctx, accountCall(address, "grantUsed")),
        ]);
        const now = await chainTime(this.ctx);
        // The grant comes back as an ordered list: relayer, expiry, maxAmount, nonce.
        const [grantRelayer, grantExpiry, grantMaxAmount, grantNonce] = grant;
        const hasGrant = grantRelayer !== ZERO_ADDRESS;
        const terms = hasGrant
            ? { relayer: grantRelayer, expiry: grantExpiry, maxAmount: grantMaxAmount, nonce: grantNonce }
            : undefined;
        const grantActive = terms !== undefined && now <= terms.expiry && grantUsed < terms.maxAmount;
        return { account: address, owner, relayer, frozen, freezeReason, usdtBalance, grant: terms, grantUsed, grantActive };
    }
    /// Builds the grant the owner is asked to sign: the relayer, the amount limit, and how many days it lasts.
    async prepareGrant(input) {
        const account = assertAddress(input.account, "account");
        const maxAmount = parseUsdt(input.maxAmount, { allowZero: true });
        if (maxAmount > MAX_ACCOUNT_GRANT_AMOUNT) {
            throw new SwordError("INVALID_INPUT", "maxAmount is above the limit of 1000 USDT per grant");
        }
        const validForDays = assertIntegerInRange(input.validForDays, 1, Math.floor(MAX_ACCOUNT_GRANT_DURATION_SECONDS / 86_400), "validForDays");
        const [relayer, nonce, now] = await Promise.all([
            readCall(this.ctx, accountCall(account, "relayer")),
            readCall(this.ctx, accountCall(account, "nonce")),
            chainTime(this.ctx),
        ]);
        return {
            account,
            terms: { relayer, expiry: now + BigInt(validForDays) * 86400n, maxAmount, nonce },
        };
    }
    /// Signs a grant with the owner's wallet. The wallet must be the account's owner.
    async signGrant(request) {
        await assertAccountOwner(this.ctx, request.account);
        const signature = await this.ctx.walletClient.signTypedData({
            account: this.ctx.walletClient.account,
            ...accountGrantTypedData(this.ctx.chain.id, request.account, request.terms),
        });
        return { account: request.account, terms: request.terms, signature };
    }
    /// Submits a signed grant to the account. Either mode can submit; the owner's signature is what counts.
    async submitGrant(signed) {
        return sendTransaction(this.ctx, accountCall(signed.account, "setGrant", [signed.terms, signed.signature]));
    }
    /// Revokes the grant at once. Owner only.
    async revokeGrant(account) {
        const address = assertAddress(account, "account");
        await assertAccountOwner(this.ctx, address);
        return sendTransaction(this.ctx, accountCall(address, "revokeGrant"));
    }
    /// Sends USDT from the account. The owner, or the relayer within the grant.
    async sendUsdt(input) {
        return sendTransaction(this.ctx, accountCall(assertAddress(input.account, "account"), "sendUsdt", [
            assertAddress(input.to, "to"),
            parseUsdt(input.amount),
        ]));
    }
    /// Runs an arbitrary call from the account. Owner only. For custodial accounts the owner is the relayer.
    async execute(input) {
        const account = assertAddress(input.account, "account");
        await assertAccountOwner(this.ctx, account);
        return sendTransaction(this.ctx, accountCall(account, "execute", [assertAddress(input.target, "target"), input.value ?? 0n, input.data]));
    }
    /// Freezes the account. Owner only. Nothing can be done until unfrozen. The reason is hashed on chain.
    async freeze(input) {
        const account = assertAddress(input.account, "account");
        await assertAccountOwner(this.ctx, account);
        return sendTransaction(this.ctx, accountCall(account, "freeze", [reasonHash(input.reason)]));
    }
    /// Unfreezes the account. Owner only.
    async unfreeze(account) {
        const address = assertAddress(account, "account");
        await assertAccountOwner(this.ctx, address);
        return sendTransaction(this.ctx, accountCall(address, "unfreeze"));
    }
}
//# sourceMappingURL=accounts.js.map