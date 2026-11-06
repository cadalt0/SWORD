import "server-only";

import { isAddress } from "viem";
import { DEFAULT_CHAIN_ID, SwordError, supportedChainIds } from "sword-sdk";

import { currentSession } from "./session";
import { currentAccounts } from "./current-accounts";
import { accountsOf, userById, type AccountRow, type UserRow } from "./repo";

/// An error with an HTTP status, for requests that cannot be served.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/// The signed-in user and their accounts. Throws 401 when there is no session.
export async function requireUser(): Promise<{ user: UserRow; accounts: AccountRow[] }> {
  const session = await currentSession();
  if (!session) throw new HttpError(401, "NOT_SIGNED_IN", "Sign in with Google first");
  const user = await userById(session.userId);
  if (!user) throw new HttpError(401, "NOT_SIGNED_IN", "Your session is no longer valid. Sign in again.");
  return { user, accounts: await currentAccounts(user, await accountsOf(user.id)) };
}

/// The user's account of their own kind (customer or merchant). Throws 400 if they have not created one yet.
export function accountOfUser(accounts: AccountRow[], user: UserRow): AccountRow {
  const account = accounts.find((a) => a.kind === user.role);
  if (!account) throw new HttpError(400, "NO_ACCOUNT", "Create your account first");
  return account;
}

/// Reads the chain from a request. Defaults to Whitechain. Rejects chains the SDK does not support.
export function chainIdFrom(value: unknown): number {
  if (value === undefined || value === null || value === "") return DEFAULT_CHAIN_ID;
  const id = Number(value);
  if (!supportedChainIds().includes(id)) throw new HttpError(400, "UNSUPPORTED_CHAIN", `Chain ${value} is not supported`);
  return id;
}

export function addressFrom(value: unknown, name: string): `0x${string}` {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new HttpError(400, "INVALID_ADDRESS", `${name} is not a valid address`);
  }
  return value as `0x${string}`;
}

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/// Turns any error into a JSON response. SDK errors keep their stable code.
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof SwordError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: { code: "SERVER_ERROR", message } }, { status: 500 });
}
