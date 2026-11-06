import { type Address, type Hex } from "viem";
export declare function orderIdFromReference(reference: string): Hex;
export declare function subscriptionIdOf(merchant: Address, reference: string): Hex;
export declare function reasonHash(reason: string): Hex;
export declare function unixNow(): bigint;
export declare function identifierHashOf(stableId: string): Hex;
//# sourceMappingURL=ids.d.ts.map