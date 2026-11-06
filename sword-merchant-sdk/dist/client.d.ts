import { Orders } from "./resources/orders.js";
import { Subscriptions } from "./resources/subscriptions.js";
import type { Merchant } from "./types.js";
export interface SwordOptions {
    apiKey?: string;
    privateKey?: string;
    baseUrl?: string;
    rpcUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}
export declare class Sword {
    readonly orders: Orders;
    readonly subscriptions: Subscriptions;
    private readonly http;
    constructor(options?: SwordOptions);
    merchant(): Promise<Merchant>;
}
//# sourceMappingURL=client.d.ts.map