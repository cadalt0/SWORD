import { ReceiptPage } from "./ReceiptPage";

/// A receipt for one transaction, read from the chain: /receipt?tx=…&chain=…
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <ReceiptPage tx={one(q.tx) ?? ""} chain={one(q.chain) ?? ""} />;
}
