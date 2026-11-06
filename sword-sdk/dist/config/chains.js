import { WHITECHAIN_TESTNET_ID, whitechainTestnet } from "./chain.js";
import { ENV_RPC_URL } from "./env.js";
import { SwordError } from "../core/errors.js";
/// Chains Sword is deployed on, keyed by chain id.
/// To add a chain: deploy the contracts there, then add one entry here. Nothing else changes.
export const CHAINS = {
    [WHITECHAIN_TESTNET_ID]: {
        chain: whitechainTestnet,
        addresses: {
            usdt: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
            spender: "0x6a2694158de4141a31c428d06a8aee994dfddc86",
            factory: "0xa8336857bf520c3340b8a18945a534852124dd44",
            registry: "0x8380f81dc88182c8f0d082a785a05e75aeb28600",
            accountFactory: "0x025f7371db8a5f2418469ee84b838c16cc811068",
        },
        rpcEnvName: ENV_RPC_URL,
    },
};
/// The chain used when none is chosen. Whitechain testnet.
export const DEFAULT_CHAIN_ID = WHITECHAIN_TESTNET_ID;
/// Returns the entry for a chain id, or throws if Sword is not set up on that chain.
export function chainEntry(chainId) {
    const entry = CHAINS[chainId];
    if (!entry) {
        throw new SwordError("UNSUPPORTED_CHAIN", `Sword is not set up on chain ${chainId}`);
    }
    return entry;
}
/// Chain ids that can be selected.
export function supportedChainIds() {
    return Object.keys(CHAINS).map(Number);
}
//# sourceMappingURL=chains.js.map