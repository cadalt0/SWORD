import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { allowedOrigins, saveAllowedOrigins } from "@/lib/server/developers";
import { ownAccount } from "@/lib/server/owned";

export const runtime = "nodejs";

/// GET: the domains a checkout may report back to.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants have integration settings");
    return Response.json({ allowedOrigins: await allowedOrigins(account.address, chainId) });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {allowedOrigins: string[]}: replaces the approved domains.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    if (user.role !== "merchant") throw new HttpError(403, "NOT_MERCHANT", "Only merchants have integration settings");
    if (!Array.isArray(body.allowedOrigins)) throw new HttpError(400, "INVALID_INPUT", "allowedOrigins must be a list");
    return Response.json({ allowedOrigins: await saveAllowedOrigins(account.address, chainId, body.allowedOrigins.map(String)) });
  } catch (error) {
    return errorResponse(error);
  }
}
