import { DEFAULT_CHAIN_ID } from "sword-sdk";

import { checkoutParams } from "@/lib/shared/checkout";
import { PayPage } from "../app/_components/PayPage";
import { PayMissing } from "./PayMissing";

/// The public payment page for one order: /pay?chain=…&merchant=…&order=…. No sign-in needed to pay.
/// The checkout widget adds &origin=… (popup) or &return=… (redirect), so the page can hand the result back.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const merchant = one(q.merchant);
  const order = one(q.order);
  const chain = Number(one(q.chain));
  if (!merchant || !order) return <PayMissing />;
  return <PayPage chainId={Number.isFinite(chain) && chain > 0 ? chain : DEFAULT_CHAIN_ID} merchant={merchant} orderId={order} checkout={checkoutParams(q)} />;
}
