import { createHash } from "node:crypto";

/// API keys look like sk_test_ followed by 40 letters and digits. Only their SHA-256 hash is stored.
const FORMAT = /^sk_(test|live)_[A-Za-z0-9]{40}$/;

export const isKeyFormat = (key: string) => FORMAT.test(key);
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
