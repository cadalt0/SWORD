export declare class SwordError extends Error {
    readonly code: string;
    readonly contractError: string | undefined;
    constructor(code: string, message: string, options?: {
        cause?: unknown;
        contractError?: string;
    });
}
export declare function toSwordError(error: unknown): SwordError;
//# sourceMappingURL=errors.d.ts.map