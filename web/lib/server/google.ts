import "server-only";

import { OAuth2Client } from "google-auth-library";

import { env } from "./env";

export type GoogleIdentity = { sub: string; email: string; name: string | undefined };

const client = new OAuth2Client();

/// Checks a Google sign-in token: it must be signed by Google and issued for this app's client ID.
/// No secret is needed for this check, and no Google account access is requested.
export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error("Google did not return a verified email for this account");
  }
  return { sub: payload.sub, email: payload.email, name: payload.name };
}
