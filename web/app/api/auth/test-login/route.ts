import { testingEnabled } from "@/lib/server/testing";
import { startSession } from "@/lib/server/session";
import { upsertUser, type Role } from "@/lib/server/repo";
import { bodyOf, errorResponse, HttpError } from "@/lib/server/api";

export const runtime = "nodejs";

/// Testing only: signs in with any test email, without verification. Disabled when testing mode is off.
export async function POST(request: Request) {
  try {
    if (!testingEnabled()) throw new HttpError(404, "NOT_FOUND", "Not found");
    const body = await bodyOf(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "INVALID_EMAIL", "Enter a valid test email");
    const role: Role = body.role === "merchant" ? "merchant" : "customer";

    const user = await upsertUser({ googleSub: `test:${email}`, email, name: undefined, role });
    await startSession({ userId: user.id, googleSub: user.google_sub });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    return errorResponse(error);
  }
}
