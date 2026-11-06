import { relayerSdk } from "@/lib/server/sdk";
import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { ownAccount } from "@/lib/server/owned";
import { recordEvent, savePermission, setAccountSigning } from "@/lib/server/repo";
import { toJson } from "@/lib/shared/json";
import type { Address } from "viem";

export const runtime = "nodejs";

/// GET: the permission the relayer has for this account. Wallet merchants use the mandate; smart accounts use the grant.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { account } = await ownAccount(chainId);
    const sdk = relayerSdk(chainId);

    if (account.is_eoa) {
      const view = await sdk.permission.status(account.address);
      return Response.json(
        toJson({
          relayer: sdk.address,
          grantActive: view.state === "active",
          grant: view.terms ? { maxAmount: view.terms.maxAmount, expiry: view.terms.expiry } : undefined,
          grantUsed: view.usage.amount,
        }),
      );
    }

    const status = await sdk.accounts.status(account.address);
    return Response.json(toJson({ ...status, relayer: sdk.address }));
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {action: "prepare", maxAmount, validForDays} builds the permission for the owner to sign.
/// POST {action: "submit", signed} sends the owner's signed permission to the chain, and keeps it.
/// POST {action: "revoked", txHash} after the owner's wallet removed it: the account signs with the wallet from then on.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    const sdk = relayerSdk(chainId);

    if (body.action === "prepare") {
      if (typeof body.maxAmount !== "string") throw new HttpError(400, "INVALID_INPUT", "maxAmount is required");
      const validForDays = Number(body.validForDays ?? 30);
      if (account.is_eoa) {
        const request = await sdk.permission.prepare({
          merchant: account.address,
          relayer: sdk.address,
          validForDays,
          maxOrders: 100,
          maxActions: 100,
          maxAmount: body.maxAmount,
        });
        return Response.json(toJson(request));
      }
      const request = await sdk.accounts.prepareGrant({ account: account.address, maxAmount: body.maxAmount, validForDays });
      return Response.json(toJson(request));
    }

    if (body.action === "submit") {
      const signed = body.signed as { signature: string; terms: Record<string, string>; merchant?: string; book?: string } | undefined;
      if (!signed?.signature || !signed.terms) throw new HttpError(400, "INVALID_INPUT", "A signed permission is required");
      const t = signed.terms;

      if (account.is_eoa) {
        if (!signed.merchant || !signed.book) throw new HttpError(400, "INVALID_INPUT", "The permission is incomplete");
        const hash = await sdk.permission.submit({
          merchant: signed.merchant as Address,
          book: signed.book as Address,
          terms: {
            relayer: t.relayer as Address,
            expiry: BigInt(t.expiry),
            maxOrders: BigInt(t.maxOrders),
            maxActions: BigInt(t.maxActions),
            maxAmount: BigInt(t.maxAmount),
            nonce: BigInt(t.nonce),
          },
          signature: signed.signature as `0x${string}`,
        });
        await savePermission({ accountAddress: account.address, chainId, terms: stringify(t), signature: signed.signature, txHash: hash.hash });
        await setAccountSigning(account.id, "signless");
        return Response.json({ hash: hash.hash });
      }

      const result = await sdk.accounts.submitGrant({
        account: account.address as Address,
        terms: {
          relayer: t.relayer as Address,
          expiry: BigInt(t.expiry),
          maxAmount: BigInt(t.maxAmount),
          nonce: BigInt(t.nonce),
        },
        signature: signed.signature as `0x${string}`,
      });
      await savePermission({ accountAddress: account.address, chainId, terms: stringify(t), signature: signed.signature, txHash: result.hash });
      await setAccountSigning(account.id, "signless");
      return Response.json({ hash: result.hash });
    }

    // The owner's wallet removed the permission on chain. Checked on chain before anything changes here; from now on
    // the owner signs every action.
    if (body.action === "revoked") {
      const stillActive = account.is_eoa ? (await sdk.permission.status(account.address)).state === "active" : (await sdk.accounts.status(account.address)).grantActive;
      if (stillActive) throw new HttpError(409, "STILL_ACTIVE", "The permission is still active on chain");
      await setAccountSigning(account.id, "manual");
      await recordEvent({ userId: user.id, type: "permission.revoked", details: { chainId }, txHash: typeof body.txHash === "string" ? body.txHash : undefined });
      return Response.json({ ok: true });
    }

    throw new HttpError(400, "INVALID_ACTION", "action must be prepare, submit or revoked");
  } catch (error) {
    return errorResponse(error);
  }
}

function stringify(terms: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, String(v)]));
}
