import { createPublicClient, erc20Abi, http, type Address } from "viem";
import { CHAINS } from "sword-sdk";

import { bodyOf, chainIdFrom, errorResponse, HttpError } from "@/lib/server/api";
import { cashedOut, fiatPayoutsOf, fiatReference, saveFiatPayout } from "@/lib/server/fiat";
import { rateFor } from "@/lib/server/fx";
import { ownAccount } from "@/lib/server/owned";
import { recordEvent } from "@/lib/server/repo";
import { rpcUrlFor } from "@/lib/server/rpc";
import { countryOf, formatFiat } from "@/lib/shared/fiat";
import { tokenOf } from "@/lib/shared/token";

export const runtime = "nodejs";

/// The account's balance less what it already cashed out, in the stablecoin.
async function available(chainId: number, address: string): Promise<{ balance: number; available: number }> {
  const entry = CHAINS[chainId];
  const client = createPublicClient({ chain: entry.chain, transport: http(rpcUrlFor(chainId)) });
  const raw = await client.readContract({ address: entry.addresses.usdt, abi: erc20Abi, functionName: "balanceOf", args: [address as Address] });
  const balance = Number(raw) / 10 ** entry.token.decimals;
  return { balance, available: Math.max(0, balance - (await cashedOut(address, chainId))) };
}

const view = (p: Awaited<ReturnType<typeof fiatPayoutsOf>>[number]) => ({
  id: p.id,
  amount: p.amount,
  currency: p.currency,
  fiatAmount: p.fiat_amount,
  rate: p.rate,
  country: p.country,
  holderName: p.holder_name,
  bankName: p.bank_name,
  accountLast4: p.account_last4,
  reference: p.reference,
  status: p.status,
  createdAt: p.created_at.toISOString(),
});

/// GET ?chainId: what the signed-in user can cash out, and their past cash-outs.
export async function GET(request: Request) {
  try {
    const chainId = chainIdFrom(new URL(request.url).searchParams.get("chainId"));
    const { user, account } = await ownAccount(chainId);
    const [money, payouts] = await Promise.all([available(chainId, account.address), fiatPayoutsOf(user.id, chainId)]);
    return Response.json({ ...money, payouts: payouts.map(view) });
  } catch (error) {
    return errorResponse(error);
  }
}

/// POST {chainId, amount, country, holderName, bankName?, accountNumber}: converts part of the balance to local money
/// and sends it to the bank account.
export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const chainId = chainIdFrom(body.chainId);
    const { user, account } = await ownAccount(chainId);
    const country = countryOf(typeof body.country === "string" ? body.country : undefined);
    if (!country) throw new HttpError(400, "INVALID_INPUT", "Choose a country");
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,6})?$/.test(String(body.amount))) throw new HttpError(400, "INVALID_INPUT", "Enter an amount");
    const holderName = typeof body.holderName === "string" ? body.holderName.trim() : "";
    if (holderName.length < 2) throw new HttpError(400, "INVALID_INPUT", "Enter the account holder's name");
    const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.replace(/\s+/g, "") : "";
    if (accountNumber.length < 4 || accountNumber.length > 40) throw new HttpError(400, "INVALID_INPUT", `Enter the ${country.accountLabel}`);
    const bankName = typeof body.bankName === "string" && body.bankName.trim() ? body.bankName.trim().slice(0, 80) : undefined;

    const { available: left } = await available(chainId, account.address);
    if (amount > left + 1e-9) throw new HttpError(400, "INSUFFICIENT_BALANCE", `You can cash out up to ${left.toFixed(2)} ${tokenOf(chainId)}`);

    const rate = await rateFor(country.currency);
    const payout = await saveFiatPayout({
      userId: user.id,
      chainId,
      accountAddress: account.address,
      amount: String(body.amount),
      currency: country.currency,
      fiatAmount: amount * rate,
      rate,
      country: country.code,
      holderName,
      bankName,
      accountLast4: accountNumber.slice(-4),
      reference: fiatReference(),
    });
    await recordEvent({
      userId: user.id,
      type: "fiat.withdrawn",
      details: { chainId, amount: String(body.amount), currency: country.currency, fiatAmount: payout.fiat_amount, label: formatFiat(Number(payout.fiat_amount), country.currency), bank: bankName ?? null, last4: payout.account_last4, reference: payout.reference },
    });
    return Response.json({ payout: view(payout) });
  } catch (error) {
    return errorResponse(error);
  }
}
