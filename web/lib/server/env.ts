import "server-only";

/// Reads a required server setting. Throws a clear error if it is missing.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
}

export const env = {
  get databaseUrl() {
    return requireEnv("DATABASE_URL");
  },
  get googleClientId() {
    return requireEnv("GOOGLE_CLIENT_ID");
  },
  get sessionSecret() {
    return requireEnv("SESSION_SECRET");
  },
};
