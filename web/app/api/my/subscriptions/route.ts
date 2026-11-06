import { accountOfUser, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { mySubscriptions } from "@/lib/server/customer";

export const runtime = "nodejs";

/// GET: every subscription the signed-in customer holds, with where each stands on chain. For the customer's own page,
/// the upcoming payments, and the low-balance warning.
export async function GET() {
  try {
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers have subscriptions here");
    return Response.json({ subscriptions: await mySubscriptions(accountOfUser(accounts, user)) });
  } catch (error) {
    return errorResponse(error);
  }
}
