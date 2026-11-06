import { createPublicClient, createWalletClient, custom, http, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainEntry, DEFAULT_CHAIN_ID } from "./config/chains.js";
import { readEnvRpcUrl, readRelayerPrivateKey } from "./config/env.js";
import { SwordError } from "./core/errors.js";
import { AccountsModule } from "./modules/accounts/accounts.js";
import { MerchantModule } from "./modules/merchant.js";
import { OrdersModule } from "./modules/orders.js";
import { PaymentsModule } from "./modules/payments.js";
import { PermissionModule } from "./modules/permission.js";
import { RefundsModule } from "./modules/refunds.js";
import { SubscriptionsModule } from "./modules/subscriptions.js";
/// Sword SDK. One instance per mode. The chain can be switched at any time with setChain.
/// Merchant mode sends every action from the merchant's wallet. Relayer mode sends actions from the relayer wallet,
/// within the permission the merchant has granted. Customer actions are not part of this SDK.
export class SwordSDK {
    /// Which wallet sends the transactions of this instance.
    mode;
    /// Address of the wallet that sends transactions (the merchant's or the relayer's).
    address;
    merchant;
    permission;
    orders;
    payments;
    refunds;
    subscriptions;
    accounts;
    /// Shared with every module. Changing the chain changes these fields, so the modules follow.
    ctx;
    /// The relayer account, kept so the relayer wallet can be rebuilt for another chain. Undefined in merchant mode.
    relayerAccount;
    constructor(options) {
        const entry = chainEntry(options.chainId ?? DEFAULT_CHAIN_ID);
        const rpcUrl = resolveRpcUrl(entry, options.rpcUrl);
        let walletClient;
        let relayerAccount;
        if (options.mode === "merchant") {
            walletClient = options.walletClient ?? createWalletClient({ account: options.account, chain: entry.chain, transport: custom(options.provider) });
        }
        else {
            relayerAccount = privateKeyToAccount(readRelayerPrivateKey());
            walletClient = createWalletClient({ account: relayerAccount, chain: entry.chain, transport: http(rpcUrl) });
        }
        this.mode = options.mode;
        this.relayerAccount = relayerAccount;
        this.address = walletClient.account.address;
        this.ctx = {
            mode: options.mode,
            chain: entry.chain,
            addresses: entry.addresses,
            publicClient: createPublicClient({ chain: entry.chain, transport: http(rpcUrl) }),
            walletClient,
        };
        this.merchant = new MerchantModule(this.ctx);
        this.permission = new PermissionModule(this.ctx);
        this.orders = new OrdersModule(this.ctx);
        this.payments = new PaymentsModule(this.ctx);
        this.refunds = new RefundsModule(this.ctx);
        this.subscriptions = new SubscriptionsModule(this.ctx);
        this.accounts = new AccountsModule(this.ctx);
    }
    /// The chain every action currently goes to.
    get chain() {
        return this.ctx.chain;
    }
    /// The id of the chain every action currently goes to.
    get chainId() {
        return this.ctx.chain.id;
    }
    /// Switches every action to another chain. Used when the UI changes chain.
    /// The merchant's wallet is not changed: in merchant mode the wallet must also be switched to the new chain.
    setChain(chainId, rpcUrl) {
        const entry = chainEntry(chainId);
        const url = resolveRpcUrl(entry, rpcUrl);
        this.ctx.chain = entry.chain;
        this.ctx.addresses = entry.addresses;
        this.ctx.publicClient = createPublicClient({ chain: entry.chain, transport: http(url) });
        if (this.relayerAccount) {
            this.ctx.walletClient = createWalletClient({
                account: this.relayerAccount,
                chain: entry.chain,
                transport: http(url),
            });
        }
    }
}
/// Uses the RPC given, or the chain's environment variable. Throws if neither is available.
function resolveRpcUrl(entry, rpcUrl) {
    const url = rpcUrl ?? readEnvRpcUrl(entry.rpcEnvName);
    if (!url) {
        throw new SwordError("RPC_REQUIRED", `No RPC endpoint for chain ${entry.chain.id}. Give one or set ${entry.rpcEnvName}.`);
    }
    return url;
}
//# sourceMappingURL=client.js.map