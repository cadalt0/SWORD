import { erc20Abi } from "../abi/index.js";
import { MAX_PERIOD_SECONDS, MAX_PERIODS, MIN_PERIOD_SECONDS } from "../config/constants.js";
import { spenderCall } from "../core/calls.js";
import { SwordError } from "../core/errors.js";
import { orderIdFromReference, reasonHash, subscriptionIdOf } from "../core/ids.js";
import { assertMerchantMode } from "../core/mode.js";
import { parseUsdt } from "../core/units.js";
import { chainTime, readCall, sendTransaction } from "../core/transactions.js";
import { assertAddress, assertIntegerInRange } from "../core/validate.js";
import { toSubscriptionView } from "../core/views.js";
import { requirePermission } from "./permission.js";
/// Subscriptions, built like orders: the merchant creates one, it gets its own deposit address (a vault), and exactly
/// one customer takes it. Taking it pays the first period. Later periods are pulled into the vault when due. The
/// merchant withdraws from the vault, and can refund any amount at any time.
export class SubscriptionsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /// The id a merchant's subscription gets for a reference. Known before it is created.
    idOf(merchant, reference) {
        return subscriptionIdOf(assertAddress(merchant, "merchant"), reference);
    }
    /// Creates a subscription for a merchant wallet. The merchant in merchant mode; the relayer within the merchant's
    /// permission in relayer mode. For merchant smart accounts, use `accounts.merchant.createSubscription`.
    async create(input) {
        const merchant = assertAddress(input.merchant, "merchant");
        const amount = parseUsdt(input.amount);
        const periodSeconds = assertIntegerInRange(input.periodSeconds, MIN_PERIOD_SECONDS, MAX_PERIOD_SECONDS, "periodSeconds");
        const periods = assertIntegerInRange(input.periods, 1, MAX_PERIODS, "periods");
        const relayer = input.relayer ? assertAddress(input.relayer, "relayer") : this.ctx.mode === "relayer" ? this.ctx.walletClient.account.address : undefined;
        if (!relayer)
            throw new SwordError("INVALID_INPUT", "relayer is required when the merchant creates a subscription");
        if (this.ctx.mode === "relayer")
            await requirePermission(this.ctx, merchant);
        const id = subscriptionIdOf(merchant, input.reference);
        const transaction = await sendTransaction(this.ctx, spenderCall(this.ctx, "createSubscription", [orderIdFromReference(input.reference), merchant, relayer, amount, BigInt(periodSeconds), BigInt(periods)]));
        const vault = await readCall(this.ctx, spenderCall(this.ctx, "vaultOf", [id]));
        return { id, vault, transaction };
    }
    /// Takes an open subscription with the connected wallet and pays the first period. If needed, the spender's allowance
    /// is raised by the subscription total first, on top of what the wallet already allowed, so other payments keep
    /// working. Wallet (merchant mode) only; the wallet signs these one or two transactions.
    async subscribe(id) {
        assertMerchantMode(this.ctx, "Subscribing from a wallet");
        const sub = await this.read(id);
        if (sub.cancelled)
            throw new SwordError("SUBSCRIPTION_CANCELLED", "This subscription was cancelled");
        if (sub.subscriber !== "0x0000000000000000000000000000000000000000")
            throw new SwordError("ALREADY_TAKEN", "Someone already took this subscription");
        const owner = this.ctx.walletClient.account.address;
        const total = sub.amount * BigInt(sub.periods);
        const { spender, usdt } = this.ctx.addresses;
        const allowance = await readCall(this.ctx, { address: usdt, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
        let approval;
        if (allowance < total) {
            approval = await sendTransaction(this.ctx, { address: usdt, abi: erc20Abi, functionName: "approve", args: [spender, allowance + total] });
        }
        const transaction = await sendTransaction(this.ctx, spenderCall(this.ctx, "subscribe", [id]));
        return { transaction, approval };
    }
    /// Pulls the next period into the vault, once it is due. Merchant or relayer.
    async charge(id) {
        const view = await this.get(id);
        if (!view.subscriber)
            throw new SwordError("NOT_STARTED", "No customer has taken this subscription yet");
        if (view.nextChargeAt === undefined)
            throw new SwordError("NOTHING_DUE", "No more periods will be charged");
        const now = await chainTime(this.ctx);
        if (now < view.nextChargeAt) {
            throw new SwordError("PERIOD_NOT_DUE", `The next period is due at ${view.nextChargeAt}; the chain time is ${now}`);
        }
        return sendTransaction(this.ctx, spenderCall(this.ctx, "chargeNext", [id]));
    }
    /// Cancels a subscription. The customer's wallet, the merchant, or the relayer. Paid periods run to their end.
    async cancel(id) {
        await this.read(id);
        return sendTransaction(this.ctx, spenderCall(this.ctx, "cancelSubscription", [id]));
    }
    /// The customer asks for a refund, at any time after paying. Wallet (merchant mode) of the customer.
    async requestRefund(input) {
        assertMerchantMode(this.ctx, "Requesting a refund from a wallet");
        return sendTransaction(this.ctx, spenderCall(this.ctx, "requestSubscriptionRefund", [input.id, reasonHash(input.reason), parseUsdt(input.amount)]));
    }
    /// Refunds any amount to the customer, at any time: one period, several, or everything paid. Paid from the vault
    /// first; any rest comes from the merchant's wallet. In merchant mode the wallet's allowance is raised for that rest
    /// if needed. The merchant, or the relayer within the merchant's permission.
    async refund(input) {
        const view = await this.get(input.id);
        const amount = parseUsdt(input.amount);
        if (amount > view.collected - view.refunded)
            throw new SwordError("REFUND_TOO_LARGE", "That is more than the customer has paid less refunds");
        const rest = amount > view.held ? amount - view.held : 0n;
        if (this.ctx.mode === "relayer") {
            await requirePermission(this.ctx, view.merchant);
        }
        else if (rest > 0n) {
            const { spender, usdt } = this.ctx.addresses;
            const allowance = await readCall(this.ctx, { address: usdt, abi: erc20Abi, functionName: "allowance", args: [view.merchant, spender] });
            if (allowance < rest)
                await sendTransaction(this.ctx, { address: usdt, abi: erc20Abi, functionName: "approve", args: [spender, allowance + rest] });
        }
        return sendTransaction(this.ctx, spenderCall(this.ctx, "refundSubscription", [input.id, amount, reasonHash(input.note ?? "")]));
    }
    /// Denies the customer's open refund request. The merchant, or the relayer within the merchant's permission.
    async deny(input) {
        const view = await this.get(input.id);
        if (this.ctx.mode === "relayer")
            await requirePermission(this.ctx, view.merchant);
        return sendTransaction(this.ctx, spenderCall(this.ctx, "denySubscriptionRefund", [input.id, reasonHash(input.note ?? "")]));
    }
    /// Moves everything the vault holds to the merchant. Merchant or relayer.
    async withdraw(id) {
        const view = await this.get(id);
        if (view.held === 0n)
            throw new SwordError("NOTHING_TO_WITHDRAW", "This subscription holds nothing right now");
        return sendTransaction(this.ctx, spenderCall(this.ctx, "withdrawSubscription", [id]));
    }
    /// Returns a subscription with its status and what its vault holds.
    async get(id) {
        const sub = await this.read(id);
        const [status, held] = await Promise.all([
            readCall(this.ctx, spenderCall(this.ctx, "subscriptionStatus", [id])),
            readCall(this.ctx, spenderCall(this.ctx, "heldBalance", [id])),
        ]);
        return toSubscriptionView(id, sub, status, held);
    }
    /// Whether the customer has paid access at a given time. Defaults to the chain's current time.
    async hasAccess(id, at) {
        const time = at ?? (await chainTime(this.ctx));
        return readCall(this.ctx, spenderCall(this.ctx, "hasAccess", [id, time]));
    }
    /// The deposit address of a subscription. Known before it is created.
    async vaultOf(id) {
        return readCall(this.ctx, spenderCall(this.ctx, "vaultOf", [id]));
    }
    /// Payment time of one period, in seconds. Zero if not paid.
    async periodPaidAt(id, index) {
        return readCall(this.ctx, spenderCall(this.ctx, "periodPaidAt", [id, BigInt(index)]));
    }
    /// Reads a subscription record, throwing if it does not exist.
    async read(id) {
        const sub = await readCall(this.ctx, spenderCall(this.ctx, "getSubscription", [id]));
        if (!sub.exists)
            throw new SwordError("SUBSCRIPTION_NOT_FOUND", `No subscription with id ${id}`);
        return sub;
    }
}
//# sourceMappingURL=subscriptions.js.map