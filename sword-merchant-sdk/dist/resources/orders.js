import { SwordApiError } from "../errors.js";
const PAID = new Set(["paid", "partially_refunded", "refunded"]);
const ENDED = new Set(["expired", "failed", "closed"]);
const path = (id, action = "") => `/v1/orders/${encodeURIComponent(id)}${action}`;
/// One-time payments.
export class Orders {
    http;
    constructor(http) {
        this.http = http;
    }
    /// Creates an order. Show `checkoutUrl` to the customer, or pass it to the sword-checkout button.
    create(input) {
        return this.http.post("/v1/orders", input);
    }
    get(id) {
        return this.http.get(path(id));
    }
    /// Your orders made through Sword, newest first.
    list(options = {}) {
        return this.http.get("/v1/orders", { limit: options.limit, before: options.before });
    }
    /// Marks the order paid if a wallet sent the full amount to its deposit address (for example by scanning the QR).
    /// Safe to call as often as you like; it returns the order as it is.
    confirm(id) {
        return this.http.post(path(id, "/confirm"));
    }
    /// Waits until the order is paid and returns it. Checks wallet transfers too. Throws when the order expires first.
    async waitForPayment(id, options = {}) {
        const interval = options.intervalMs ?? 4000;
        let order = await this.confirm(id);
        const deadline = Date.now() + (options.timeoutMs ?? Math.max(0, (order.expiresAt ? Date.parse(order.expiresAt) : Date.now()) - Date.now()) + 30_000);
        for (;;) {
            if (PAID.has(order.status))
                return order;
            if (ENDED.has(order.status))
                throw new SwordApiError(0, "ORDER_NOT_PAID", `Order ${id} is ${order.status} and can no longer be paid`, { order });
            if (Date.now() >= deadline)
                throw new SwordApiError(0, "TIMEOUT", `Order ${id} was not paid in time`, { order });
            if (options.signal?.aborted)
                throw new SwordApiError(0, "ABORTED", "Stopped waiting for the payment");
            await new Promise((r) => setTimeout(r, interval));
            order = await this.confirm(id);
        }
    }
    /// Refunds without a request from the customer: up to what is still refundable.
    refund(id, input) {
        return this.http.post(path(id, "/refund"), input);
    }
    /// Approves an amount on the customer's open refund request. Then call payRefund.
    approveRefund(id, input) {
        return this.http.post(path(id, "/refund/approve"), input);
    }
    /// Declines the customer's open refund request.
    denyRefund(id, input = {}) {
        return this.http.post(path(id, "/refund/deny"), input);
    }
    /// Pays the approved refund to the customer.
    payRefund(id) {
        return this.http.post(path(id, "/refund/pay"));
    }
    /// Moves a paid order's money to your merchant account.
    withdraw(id) {
        return this.http.post(path(id, "/withdraw"));
    }
}
//# sourceMappingURL=orders.js.map