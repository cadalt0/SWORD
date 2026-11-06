import { errorResponse, requireUser } from "@/lib/server/api";
import { recentEvents } from "@/lib/server/repo";

export const runtime = "nodejs";

/// GET: the signed-in user's recent actions, newest first.
export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const asked = Number(new URL(request.url).searchParams.get("limit"));
    const rows = await recentEvents(user.id, Number.isInteger(asked) && asked > 0 ? Math.min(asked, 500) : 12);
    return Response.json({
      activity: rows.map((r) => ({ type: r.type, details: r.details, txHash: r.tx_hash, createdAt: r.created_at })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
