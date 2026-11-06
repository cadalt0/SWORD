import { DEFAULT_CHAIN_ID } from "sword-sdk";

import { verifyGoogleCredential } from "@/lib/server/google";
import { startSession } from "@/lib/server/session";
import { upsertUser, type Role } from "@/lib/server/repo";
import { bodyOf, errorResponse, HttpError } from "@/lib/server/api";

export const runtime = "nodejs";

/// Signs the user in with a Google sign-in token. The role is set at first sign-in and kept after that.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    if (typeof body.credential !== "string") throw new HttpError(400, "NO_CREDENTIAL", "Missing Google sign-in token");
    const role: Role = body.role === "merchant" ? "merchant" : "customer";

    const identity = await verifyGoogleCredential(body.credential);
    const user = await upsertUser({ googleSub: identity.sub, email: identity.email, name: identity.name, role });
    await startSession({ userId: user.id, googleSub: user.google_sub });

    return Response.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, chainId: DEFAULT_CHAIN_ID });
  } catch (error) {
    return errorResponse(error);
  }
}
