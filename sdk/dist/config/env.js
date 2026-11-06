import { isHex } from "viem";
import { SwordError } from "../core/errors.js";
/// Environment variables the SDK reads. The names match the project's .env file.
export const ENV_RPC_URL = "WHITECHAIN_RPC_URL";
export const ENV_RELAYER_PRIVATE_KEY = "RELAYER_PRIVATE_KEY";
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;
/// Reads an RPC endpoint from the environment. Returns undefined when it is not set.
export function readEnvRpcUrl(envName, env = process.env) {
    const value = env[envName];
    return value ? value : undefined;
}
/// Reads the relayer key from the environment. Called only in relayer mode, on the backend.
/// The key is never returned as text to callers and never logged.
export function readRelayerPrivateKey(env = process.env) {
    const privateKey = env[ENV_RELAYER_PRIVATE_KEY];
    if (!privateKey) {
        throw new SwordError("INVALID_CONFIG", `${ENV_RELAYER_PRIVATE_KEY} is not set`);
    }
    if (!PRIVATE_KEY_PATTERN.test(privateKey) || !isHex(privateKey)) {
        throw new SwordError("INVALID_CONFIG", `${ENV_RELAYER_PRIVATE_KEY} must be 0x followed by 64 hex characters`);
    }
    return privateKey;
}
//# sourceMappingURL=env.js.map