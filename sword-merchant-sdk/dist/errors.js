/// Every failed call throws this. `code` is stable and meant for programs; `message` is meant for people.
export class SwordApiError extends Error {
    status;
    code;
    details;
    name = "SwordApiError";
    constructor(
    /// The HTTP status, or 0 when the API could not be reached.
    status, code, message, 
    /// Anything else the API said, such as `contractError`, `fields`, `scope`, or `retryAfter`.
    details = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
//# sourceMappingURL=errors.js.map