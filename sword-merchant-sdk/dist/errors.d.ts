export declare class SwordApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: Record<string, unknown>;
    readonly name = "SwordApiError";
    constructor(status: number, code: string, message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map