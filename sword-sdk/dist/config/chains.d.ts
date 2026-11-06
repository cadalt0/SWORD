import type { Chain } from "viem";
import type { SwordAddresses } from "./addresses.js";
export interface ChainEntry {
    readonly chain: Chain;
    readonly addresses: SwordAddresses;
    readonly rpcEnvName: string;
}
export declare const CHAINS: Readonly<Record<number, ChainEntry>>;
export declare const DEFAULT_CHAIN_ID = 1874;
export declare function chainEntry(chainId: number): ChainEntry;
export declare function supportedChainIds(): number[];
//# sourceMappingURL=chains.d.ts.map