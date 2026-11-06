import { checkoutParams } from "@/lib/shared/checkout";
import { SubscribePage } from "./SubscribePage";

/// The public page for one subscription: /subscribe?id=…
/// The checkout widget adds &origin=… (popup) or &return=… (redirect), so the page can hand the result back.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const id = Array.isArray(q.id) ? q.id[0] : q.id;
  return <SubscribePage subscriptionId={id ?? ""} checkout={checkoutParams(q)} />;
}
