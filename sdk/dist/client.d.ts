import { type Account, type Address, type Chain, type Transport, type WalletClient } from "viem";
import type { ActionMode } from "./core/mode.js";
import { AccountsModule } from "./modules/accounts/accounts.js";
import { MerchantModule } from "./modules/merchant.js";
import { OrdersModule } from "./modules/orders.js";
import { PaymentsModule } from "./modules/payments.js";
import { PermissionModule } from "./modules/permission.js";
import { RefundsModule } from "./modules/refunds.js";
import { SubscriptionsModule } from "./modules/subscriptions.js";
interface SharedOptions {
    readonly chainId?: number;
    readonly rpcUrl?: string;
}
export interface Eip1193Provider {
    request(args: {
        method: string;
        params?: unknown[];
    }): Promise<unknown>;
}
export type MerchantModeOptions = SharedOptions & {
    readonly mode: "merchant";
} & ({
    readonly walletClient: WalletClient<Transport, Chain, Account>;
    readonly provider?: undefined;
    readonly account?: undefined;
} | {
    readonly provider: Eip1193Provider;
    readonly account: Address;
    readonly walletClient?: undefined;
});
export interface RelayerModeOptions extends SharedOptions {
    readonly mode: "relayer";
}
export type SwordOptions = MerchantModeOptions | RelayerModeOptions;
export declare class SwordSDK {
    readonly mode: ActionMode;
    readonly address: Address;
    readonly merchant: MerchantModule;
    readonly permission: PermissionModule;
    readonly orders: OrdersModule;
    readonly payments: PaymentsModule;
    readonly refunds: RefundsModule;
    readonly subscriptions: SubscriptionsModule;
    readonly accounts: AccountsModule;
    private readonly ctx;
    private readonly relayerAccount;
    constructor(options: SwordOptions);
    get chain(): Chain;
    get chainId(): number;
    setChain(chainId: number, rpcUrl?: string): void;
}
export {};
//# sourceMappingURL=client.d.ts.map