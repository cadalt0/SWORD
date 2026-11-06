import { dollarRates } from "@/lib/server/fx";

export const runtime = "nodejs";

/// Public: live dollar exchange rates for the currencies Sword pays in and out of.
export async function GET() {
  return Response.json(await dollarRates(), { headers: { "cache-control": "public, max-age=300" } });
}
