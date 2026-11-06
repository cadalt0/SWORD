/// Every setting the server reads, checked once at start-up.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to server/.env (see .env.example).`);
  return value;
}

const number = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
};

// The SDK reads the relayer key from RELAYER_PRIVATE_KEY and expects a 0x prefix.
const relayerKey = required("RELAYER_PRIVATE_KEY");
process.env.RELAYER_PRIVATE_KEY = relayerKey.startsWith("0x") ? relayerKey : `0x${relayerKey}`;

export const config = {
  port: number("PORT", 4000),
  databaseUrl: required("DATABASE_URL"),
  /// Where the Sword website runs. Checkout links point here, and actions are recorded through it.
  webUrl: required("PUBLIC_WEB_URL").replace(/\/+$/, ""),
  /// Shared with the website, for its internal record endpoint.
  internalSecret: required("INTERNAL_API_SECRET"),
  rateLimit: {
    /// Calls per key per minute.
    perMinute: number("RATE_LIMIT_PER_MINUTE", 120),
    /// Calls that send a transaction, per key per minute. Lower, because the relayer pays the gas.
    writesPerMinute: number("RATE_LIMIT_WRITES_PER_MINUTE", 30),
  },
  /// How long a prepared transaction for a self-signing merchant stays valid.
  pendingMinutes: number("PENDING_MINUTES", 15),
} as const;
