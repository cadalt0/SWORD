/// Converts bigint values to strings so they can be sent as JSON. The browser turns them back where needed.
export function toJson<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/// Reads a bigint from a JSON string value.
export function bigintOf(value: unknown, name: string): bigint {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`${name} must be a number`);
  return BigInt(value);
}
