import type { Abi } from "viem";
export { accountFactoryAbi } from "./account-factory.js";
export { customerAccountAbi } from "./customer-account.js";
export { erc20Abi } from "./erc20.js";
export { merchantAccountAbi } from "./merchant-account.js";
export { merchantOrdersAbi } from "./merchant-orders.js";
export { merchantRegistryAbi } from "./merchant-registry.js";
export { merchantSpenderAbi } from "./merchant-spender.js";
export { orderCollectorAbi } from "./order-collector.js";
export declare const accountAbi: Abi;
export declare function withErrors<const T extends Abi>(abi: T): readonly [...T, ...import("abitype").AbiError[]];
//# sourceMappingURL=index.d.ts.map