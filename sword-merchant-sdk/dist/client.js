import { SwordApiError } from "./errors.js";
import { Http } from "./http.js";
import { Orders } from "./resources/orders.js";
import { Subscriptions } from "./resources/subscriptions.js";
import { LocalSigner } from "./signer.js";
const env = (name) => (typeof process !== "undefined" ? process.env?.[name] : undefined);
/// The Sword API client for your backend.
///
///   const sword = new Sword({ apiKey: process.env.SWORD_API_KEY });
///   const order = await sword.orders.create({ amount: "1.00", reference: "order-42" });
///   // give order.checkoutUrl to your page
export class Sword {
    orders;
    subscriptions;
    http;
    constructor(options = {}) {
        const apiKey = options.apiKey ?? env("SWORD_API_KEY");
        if (!apiKey)
            throw new SwordApiError(0, "MISSING_API_KEY", "Pass apiKey, or set SWORD_API_KEY. Create a key on the Developers page.");
        if (typeof window !== "undefined" && typeof document !== "undefined") {
            throw new SwordApiError(0, "BROWSER_NOT_ALLOWED", "sword-merchant runs on your server. In the browser, use sword-checkout with the checkoutUrl from your backend.");
        }
        const privateKey = options.privateKey ?? env("SWORD_PRIVATE_KEY");
        this.http = new Http({
            apiKey,
            baseUrl: (options.baseUrl ?? env("SWORD_API_URL") ?? "http://localhost:4000").replace(/\/+$/, ""),
            timeoutMs: options.timeoutMs ?? 180_000,
            signer: privateKey ? new LocalSigner(privateKey, options.rpcUrl) : undefined,
            fetch: options.fetch ?? fetch,
        });
        this.orders = new Orders(this.http);
        this.subscriptions = new Subscriptions(this.http);
    }
    /// Who the key acts for, how its actions are signed, and what it may do.
    merchant() {
        return this.http.get("/v1/merchant");
    }
}
//# sourceMappingURL=client.js.map