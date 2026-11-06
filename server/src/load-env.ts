import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/// Loads server/.env when it exists. Imported first by index.ts, so settings are in place before anything reads them.
/// In production the variables come from the host instead, and this does nothing.
const file = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(file)) process.loadEnvFile(file);
