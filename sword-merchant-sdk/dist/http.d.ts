import type { LocalSigner } from "./signer.js";
export type HttpOptions = {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    signer: LocalSigner | undefined;
    fetch: typeof fetch;
};
export declare class Http {
    private readonly options;
    constructor(options: HttpOptions);
    get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    private request;
}
//# sourceMappingURL=http.d.ts.map