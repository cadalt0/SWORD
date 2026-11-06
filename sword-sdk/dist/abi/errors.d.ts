import type { Abi } from "viem";
type ErrorItem = Extract<Abi[number], {
    type: "error";
}>;
export declare const mergedErrorAbi: readonly ErrorItem[];
export {};
//# sourceMappingURL=errors.d.ts.map