import { SwordApiError } from "./errors.js";
/// Calls the API with the key. When the API answers that the merchant must sign (202), signs with the local key,
/// submits the hash, and repeats until the action is done, so the caller always gets the final result.
export class Http {
    options;
    constructor(options) {
        this.options = options;
    }
    async get(path, query) {
        const q = query ? Object.entries(query).filter(([, v]) => v !== undefined) : [];
        const search = q.length ? `?${new URLSearchParams(q.map(([k, v]) => [k, String(v)])).toString()}` : "";
        return (await this.request("GET", `${path}${search}`)).body;
    }
    async post(path, body) {
        let answer = await this.request("POST", path, body ?? {});
        while (answer.status === 202) {
            const pending = answer.body.transaction;
            if (!this.options.signer) {
                throw new SwordApiError(202, "SIGNATURE_REQUIRED", `This merchant signs its own transactions. Pass privateKey (the key of ${pending.from}) to new Sword().`, { transaction: pending });
            }
            const txHash = await this.options.signer.send(pending);
            answer = await this.request("POST", `/v1/transactions/${pending.id}/submit`, { txHash });
        }
        return answer.body;
    }
    async request(method, path, body) {
        let res;
        try {
            res = await this.options.fetch(`${this.options.baseUrl}${path}`, {
                method,
                headers: { authorization: `Bearer ${this.options.apiKey}`, accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
                signal: AbortSignal.timeout(this.options.timeoutMs),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new SwordApiError(0, "NETWORK_ERROR", `Could not reach the Sword API at ${this.options.baseUrl}: ${message}`);
        }
        const data = (await res.json().catch(() => ({})));
        if (!res.ok) {
            const { code = "HTTP_ERROR", message = `Request failed with status ${res.status}`, ...details } = data.error ?? {};
            throw new SwordApiError(res.status, code, message, details);
        }
        return { status: res.status, body: data };
    }
}
//# sourceMappingURL=http.js.map