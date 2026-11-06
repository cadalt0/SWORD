import { bodyOf, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { revokeKey } from "@/lib/server/developers";

export const runtime = "nodejs";

/// POST {id}: revokes one of the merchant's keys. Calls with it fail from then on.
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants have API keys");
    const body = await bodyOf(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "INVALID_INPUT", "id is required");
    await revokeKey(user.id, body.id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
