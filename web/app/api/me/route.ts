import { requireUser, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

/// The signed-in user and their accounts. Returns 401 when signed out.
export async function GET() {
  try {
    const { user, accounts } = await requireUser();
    return Response.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accounts: accounts.map((a) => ({ kind: a.kind, custody: a.custody, signing: a.signing, eoa: a.is_eoa, address: a.address, owner: a.owner_address, chainId: a.chain_id })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
