import "server-only";

import { relayerSdk } from "./sdk";
import { updateAccountAddress, type AccountRow, type UserRow } from "./repo";

/// A smart account saved from an earlier deployment of the contracts points at an account the current contracts
/// don't know. This moves such an account to the current deployment: the same user, a new address. A custodial account's owner becomes the current relayer.
/// It runs once per account (the address is remembered), and two requests arriving together share one run.

const checked = new Set<string>();
const running = new Map<string, Promise<AccountRow>>();

export async function currentAccounts(user: UserRow, accounts: AccountRow[]): Promise<AccountRow[]> {
  return Promise.all(accounts.map((a) => current(user, a)));
}

async function current(user: UserRow, account: AccountRow): Promise<AccountRow> {
  // A wallet that is its own merchant has no smart account, so there is nothing to move.
  if (account.is_eoa) return account;
  const key = `${account.id}:${account.address.toLowerCase()}`;
  if (checked.has(key)) return account;

  const existing = running.get(key);
  if (existing) return existing;
  const job = migrate(user, account)
    .then((fresh) => {
      checked.add(`${fresh.id}:${fresh.address.toLowerCase()}`);
      return fresh;
    })
    // If this can't be done now (for example the relayer is out of gas), carry on with what is saved.
    .catch(() => account)
    .finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

async function migrate(user: UserRow, account: AccountRow): Promise<AccountRow> {
  const sdk = relayerSdk(account.chain_id);
  const wanted = await sdk.accounts.predict({ kind: account.kind, identifier: user.google_sub });
  if (wanted.toLowerCase() === account.address.toLowerCase()) return account;

  // A custodial account is owned by the relayer, and the relayer may have changed since the account was first made.
  // The new account must be owned by the current relayer, or it could not act for the user. Self-custody keeps its owner.
  const owner = account.custody === "custodial" ? sdk.address : account.owner_address;
  const made = await sdk.accounts.create({ kind: account.kind, identifier: user.google_sub, owner });
  return updateAccountAddress(account.id, made.account, owner);
}
