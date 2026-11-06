import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SwordApiError } from "./errors.js";
/// Public RPC endpoints for the chains Sword runs on, used when no rpcUrl is given.
const RPC = { 1874: "https://rpc.testnet.whitechain.io" };
/// Signs the transactions the API prepares, for merchants that sign their own actions. The key stays in this process:
/// only the signed transaction goes to the chain, and only its hash goes to Sword.
export class LocalSigner {
    rpcUrl;
    account;
    constructor(privateKey, rpcUrl) {
        this.rpcUrl = rpcUrl;
        const key = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
        if (!/^0x[0-9a-fA-F]{64}$/.test(key))
            throw new SwordApiError(0, "INVALID_PRIVATE_KEY", "privateKey must be 32 bytes in hex");
        this.account = privateKeyToAccount(key);
    }
    /// Sends one prepared transaction and returns its hash. Sword checks it on chain.
    async send(tx) {
        if (tx.from.toLowerCase() !== this.account.address.toLowerCase()) {
            throw new SwordApiError(0, "WRONG_PRIVATE_KEY", `This action must be signed by ${tx.from}, but the privateKey is for ${this.account.address}`);
        }
        const url = this.rpcUrl ?? RPC[tx.chainId];
        if (!url)
            throw new SwordApiError(0, "NO_RPC_URL", `Pass rpcUrl: there is no default RPC endpoint for chain ${tx.chainId}`);
        const chain = defineChain({ id: tx.chainId, name: `chain-${tx.chainId}`, nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
        const wallet = createWalletClient({ account: this.account, chain, transport: http(url) });
        try {
            return await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
        }
        catch (error) {
            const message = error instanceof Error ? error.shortMessage ?? error.message : String(error);
            throw new SwordApiError(0, "SIGNING_FAILED", `Could not send the transaction from ${this.account.address}: ${message}`);
        }
    }
}
//# sourceMappingURL=signer.js.map