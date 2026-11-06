import { bodyOf, errorResponse, requireUser } from "@/lib/server/api";
import { markNotificationsRead, notificationsOf } from "@/lib/server/notify";

export const runtime = "nodejs";

/// GET: the signed-in user's latest notifications and the unread count.
export async function GET() {
  try {
    const { user } = await requireUser();
    const { items, unread } = await notificationsOf(user.id);
    return Response.json({
      unread,
      notifications: items.map((n) => ({ id: n.id, tone: n.tone, title: n.title, body: n.body, link: n.link, txHash: n.tx_hash, read: n.read_at !== null, createdAt: n.created_at })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {ids?: string[], all?: true}: marks notifications read.
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await bodyOf(request);
    await markNotificationsRead(user.id, body.all === true ? "all" : Array.isArray(body.ids) ? body.ids.map(String) : []);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
