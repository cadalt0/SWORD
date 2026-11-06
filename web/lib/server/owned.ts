import "server-only";

import { HttpError, accountOfUser, requireUser } from "./api";
import type { AccountRow, UserRow } from "./repo";

/// The signed-in user with their own account on the chosen chain. Merchant and customer routes start here.
export async function ownAccount(chainId: number): Promise<{ user: UserRow; account: AccountRow }> {
  const { user, accounts } = await requireUser();
  const account = accountOfUser(accounts, user);
  if (account.chain_id !== chainId) {
    throw new HttpError(409, "ACCOUNT_ON_OTHER_CHAIN", "Your account was created on another chain. Use that chain.");
  }
  return { user, account };
}
