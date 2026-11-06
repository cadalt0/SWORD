import { endSession } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    await endSession();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
