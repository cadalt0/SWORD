import { type Hex } from "viem";
export declare const ENV_RPC_URL = "WHITECHAIN_RPC_URL";
export declare const ENV_RELAYER_PRIVATE_KEY = "RELAYER_PRIVATE_KEY";
export declare function readEnvRpcUrl(envName: string, env?: NodeJS.ProcessEnv): string | undefined;
export declare function readRelayerPrivateKey(env?: NodeJS.ProcessEnv): Hex;
//# sourceMappingURL=env.d.ts.map