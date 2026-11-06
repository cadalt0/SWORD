const path = (id, action = "") => `/v1/subscriptions/${encodeURIComponent(id)}${action}`;
/// Recurring payments. Each subscription is taken by one customer and has its own deposit address.
export class Subscriptions {
    http;
    constructor(http) {
        this.http = http;
    }
    /// Creates a subscription. Show `subscribeUrl` to the customer, or pass it to the sword-checkout button.
    create(input) {
        return this.http.post("/v1/subscriptions", input);
    }
    get(id) {
        return this.http.get(path(id));
    }
    list(options = {}) {
        return this.http.get("/v1/subscriptions", { limit: options.limit, before: options.before });
    }
    /// Collects the next period. Fails with NOT_DUE before it is due.
    charge(id) {
        return this.http.post(path(id, "/charge"));
    }
    /// Stops future charges. The customer keeps access until the end of the paid period.
    cancel(id) {
        return this.http.post(path(id, "/cancel"));
    }
    /// Moves what the subscription holds to your merchant account.
    withdraw(id) {
        return this.http.post(path(id, "/withdraw"));
    }
    /// Refunds any amount up to what the customer paid less refunds.
    refund(id, input) {
        return this.http.post(path(id, "/refund"), input);
    }
    /// Declines the customer's open refund request.
    denyRefund(id, input = {}) {
        return this.http.post(path(id, "/refund/deny"), input);
    }
}
//# sourceMappingURL=subscriptions.js.map