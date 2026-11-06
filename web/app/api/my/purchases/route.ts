import { accountOfUser, errorResponse, HttpError, requireUser } from "@/lib/server/api";
import { myPurchases } from "@/lib/server/customer";

export const runtime = "nodejs";

/// GET: the orders the signed-in customer paid, each with its refund progress read from the chain.
export async function GET() {
  try {
    const { user, accounts } = await requireUser();
    if (user.role !== "customer") throw new HttpError(403, "NOT_CUSTOMER", "Only customers have purchases");
    return Response.json({ purchases: await myPurchases(user.id, accountOfUser(accounts, user)) });
  } catch (error) {
    return errorResponse(error);
  }
}
