import type { Hex } from "viem";
import type { SwordSDK } from "sword-sdk";

import { config } from "../config.js";
import { ApiError } from "../errors.js";
import { prepareFor } from "../chain/prepare.js";
import { verifySubmitted } from "../chain/verify.js";
import { advancePending, claimHash, completePending, createPending, pendingById, releaseHash, type PendingRecord } from "../repo/pending.js";
import { forgetSigning, type Merchant } from "./merchant.js";

/// One engine for every merchant action, so the three kinds of merchant look the same to the caller.
///
/// - relayer and permission merchants: `hosted` runs with the relayer, then `finalize` builds the result.
/// - self-signing merchants: the engine prepares the first of `steps` for the merchant's wallet and answers
///   "signature_required". The merchant's SDK signs it and submits the hash. The engine checks it on chain, then either
///   prepares the next step or runs `finalize`. Steps are named, and the list is worked out again from the chain after
///   each one, so a step that is no longer needed (an approval already given) is simply not there.

export type Step = { name: string; build: (sdk: SwordSDK) => Promise<unknown> };

export type ActionSpec<I extends Record<string, unknown>, R> = {
  kind: string;
  /// Anyone may do this on chain (for example withdrawing a paid order to its merchant), so the relayer always does it.
  relayerOnly?: boolean;
  /// Signs with the relayer. Returns the hash of the transaction the result is about.
  hosted: (m: Merchant, sdk: SwordSDK, input: I) => Promise<Hex>;
  /// What the merchant's own wallet signs, in order, given the chain right now.
  steps: (m: Merchant, input: I) => Promise<Step[]>;
  /// Records the action and returns what the API answers with.
  finalize: (m: Merchant, input: I, txHash: Hex) => Promise<R>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, ActionSpec<any, unknown>>();

export function defineAction<I extends Record<string, unknown>, R>(spec: ActionSpec<I, R>): ActionSpec<I, R> {
  registry.set(spec.kind, spec as ActionSpec<Record<string, unknown>, unknown>);
  return spec;
}

/// The transaction a self-signing merchant must sign, as the API shows it.
export type PendingTransaction = {
  id: string;
  action: string;
  step: string;
  chainId: number;
  from: string;
  to: string;
  data: string;
  value: string;
  expiresAt: string;
};

export type Outcome<R> = { status: "completed"; result: R } | { status: "signature_required"; transaction: PendingTransaction };

const pendingJson = (p: PendingRecord, chainId: number): PendingTransaction => ({
  id: p.id,
  action: p.kind,
  step: p.params.step,
  chainId,
  from: p.from,
  to: p.to,
  data: p.data,
  value: p.value,
  expiresAt: p.expiresAt.toISOString(),
});

/// Single-step helper: the same SDK call, run by the merchant's wallet.
export const single = (name: string, build: Step["build"]): Step[] => [{ name, build }];

export async function perform<I extends Record<string, unknown>, R>(spec: ActionSpec<I, R>, m: Merchant, input: I): Promise<Outcome<R>> {
  if (spec.relayerOnly || m.signing !== "self") {
    try {
      const hash = await spec.hosted(m, m.kit.relayer, input);
      return { status: "completed", result: await spec.finalize(m, input, hash) };
    } catch (error) {
      // The permission may have just run out. Read it again on the next call.
      if (m.signing === "permission") forgetSigning(m.chainId, m.address);
      throw error;
    }
  }

  const [first] = await spec.steps(m, input);
  if (!first) throw new ApiError(409, "NOTHING_TO_SIGN", "There is nothing to sign for this action right now");
  const tx = await prepareFor(m.kit, m.signer, first.build);
  const pending = await createPending({
    keyId: m.keyId,
    kind: spec.kind,
    params: { input, done: [], step: first.name },
    from: m.signer,
    to: tx.to,
    data: tx.data,
    value: tx.value.toString(),
    minutes: config.pendingMinutes,
  });
  return { status: "signature_required", transaction: pendingJson(pending, m.chainId) };
}

/// A self-signing merchant reports the hash of the transaction it signed for a pending action.
export async function submit(m: Merchant, id: string, txHash: Hex): Promise<Outcome<unknown>> {
  const pending = await pendingById(id, m.keyId);
  if (!pending) throw new ApiError(404, "NOT_FOUND", "No pending transaction with that id for this key");
  if (pending.completedAt) return { status: "completed", result: pending.result };
  if (pending.expiresAt.getTime() < Date.now()) throw new ApiError(410, "EXPIRED", "This prepared transaction expired. Start the action again.");
  const spec = registry.get(pending.kind);
  if (!spec) throw new ApiError(500, "UNKNOWN_ACTION", `No action ${pending.kind}`);

  if (!(await claimHash(pending.id, txHash, pending.data))) throw new ApiError(409, "ALREADY_SUBMITTED", "A transaction for this step is already being checked");
  try {
    await verifySubmitted(m.kit, pending, txHash);
  } catch (error) {
    await releaseHash(pending.id);
    throw error;
  }

  const input = pending.params.input;
  const done = [...pending.params.done, pending.params.step];
  const next = (await spec.steps(m, input)).find((s) => !done.includes(s.name));
  if (next) {
    const tx = await prepareFor(m.kit, m.signer, next.build);
    const advanced = await advancePending(pending.id, { params: { input, done, step: next.name }, to: tx.to, data: tx.data, value: tx.value.toString(), minutes: config.pendingMinutes });
    return { status: "signature_required", transaction: pendingJson(advanced, m.chainId) };
  }
  const result = await spec.finalize(m, input, txHash);
  await completePending(pending.id, result);
  return { status: "completed", result };
}

export async function pendingState(m: Merchant, id: string): Promise<Outcome<unknown> | { status: "expired" }> {
  const pending = await pendingById(id, m.keyId);
  if (!pending) throw new ApiError(404, "NOT_FOUND", "No pending transaction with that id for this key");
  if (pending.completedAt) return { status: "completed", result: pending.result };
  if (pending.expiresAt.getTime() < Date.now()) return { status: "expired" };
  return { status: "signature_required", transaction: pendingJson(pending, m.chainId) };
}
