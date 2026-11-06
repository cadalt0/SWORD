import { type Hex } from "viem";
import { type PrivateKeyAccount } from "viem/accounts";
import type { PendingTransaction } from "./types.js";
export declare class LocalSigner {
    private readonly rpcUrl?;
    readonly account: PrivateKeyAccount;
    constructor(privateKey: string, rpcUrl?: string | undefined);
    send(tx: PendingTransaction): Promise<Hex>;
}
//# sourceMappingURL=signer.d.ts.map