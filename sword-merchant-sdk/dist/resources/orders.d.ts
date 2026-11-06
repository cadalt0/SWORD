import type { Http } from "../http.js";
import type { List, ListOptions, Order } from "../types.js";
export interface CreateOrderInput {
    amount: string;
    reference: string;
    refundDays?: number;
}
export interface WaitOptions {
    timeoutMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
}
export declare class Orders {
    private readonly http;
    constructor(http: Http);
    create(input: CreateOrderInput): Promise<Order>;
    get(id: string): Promise<Order>;
    list(options?: ListOptions): Promise<List<Order>>;
    confirm(id: string): Promise<Order>;
    waitForPayment(id: string, options?: WaitOptions): Promise<Order>;
    refund(id: string, input: {
        amount: string;
        note?: string;
    }): Promise<Order>;
    approveRefund(id: string, input: {
        amount: string;
    }): Promise<Order>;
    denyRefund(id: string, input?: {
        note?: string;
    }): Promise<Order>;
    payRefund(id: string): Promise<Order>;
    withdraw(id: string): Promise<Order>;
}
//# sourceMappingURL=orders.d.ts.map