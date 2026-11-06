import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { env } from "./env";

export const SESSION_COOKIE = "wm_session";
const SESSION_DAYS = 7;

export type SessionUser = { userId: string; googleSub: string };

function key(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

/// Creates a signed session for a user and stores it in an httpOnly cookie.
export async function startSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ uid: user.userId, sub: user.googleSub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/// Returns the signed-in user, or null when there is no valid session.
export async function currentSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.sub !== "string") return null;
    return { userId: payload.uid, googleSub: payload.sub };
  } catch {
    return null;
  }
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
