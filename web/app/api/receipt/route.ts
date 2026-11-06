import { chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { receiptFor } from "@/lib/server/receipt";

export const runtime = "nodejs";

/// Public: a receipt for a transaction, built from the chain. A transaction hash is public already, and the receipt only
/// shows what the chain shows, plus a merchant's display name and the order's reference.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tx = params.get("tx") ?? "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) throw new HttpError(400, "INVALID_INPUT", "That isn't a transaction hash");
    return Response.json(await receiptFor(chainIdFrom(params.get("chain")), tx as `0x${string}`));
  } catch (error) {
    return errorResponse(error);
  }
}
