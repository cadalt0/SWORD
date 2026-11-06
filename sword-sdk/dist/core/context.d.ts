import type { Account, Chain, PublicClient, Transport, WalletClient } from "viem";
import type { SwordAddresses } from "../config/addresses.js";
import type { ActionMode } from "./mode.js";
export interface SdkContext {
    readonly mode: ActionMode;
    chain: Chain;
    addresses: SwordAddresses;
    publicClient: PublicClient<Transport, Chain>;
    walletClient: WalletClient<Transport, Chain, Account>;
}
//# sourceMappingURL=context.d.ts.map