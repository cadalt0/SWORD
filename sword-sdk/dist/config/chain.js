import { defineChain } from "viem";
/// Whitechain testnet. The RPC endpoint is supplied by the caller, so no URL is hard-coded here.
export const WHITECHAIN_TESTNET_ID = 1874;
export const whitechainTestnet = defineChain({
    id: WHITECHAIN_TESTNET_ID,
    name: "Whitechain Testnet",
    nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
    rpcUrls: {
        default: { http: [] },
    },
    blockExplorers: {
        default: { name: "Whitechain Testnet Explorer", url: "https://explorer.testnet.whitechain.io" },
    },
});
//# sourceMappingURL=chain.js.map