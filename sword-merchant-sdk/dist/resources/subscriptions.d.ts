import type { Http } from "../http.js";
import type { List, ListOptions, Subscription } from "../types.js";
export interface CreateSubscriptionInput {
    name: string;
    reference: string;
    amount: string;
    periodDays?: number;
    periodSeconds?: number;
    periods: number;
    description?: string;
}
export declare class Subscriptions {
    private readonly http;
    constructor(http: Http);
    create(input: CreateSubscriptionInput): Promise<Subscription>;
    get(id: string): Promise<Subscription>;
    list(options?: ListOptions): Promise<List<Subscription>>;
    charge(id: string): Promise<Subscription>;
    cancel(id: string): Promise<Subscription>;
    withdraw(id: string): Promise<Subscription>;
    refund(id: string, input: {
        amount: string;
        note?: string;
    }): Promise<Subscription>;
    denyRefund(id: string, input?: {
        note?: string;
    }): Promise<Subscription>;
}
//# sourceMappingURL=subscriptions.d.ts.map