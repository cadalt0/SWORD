import { Dashboard } from "./_components/Dashboard";

export const metadata = { title: "Sword" };

/// The only page for now. Everything happens here: sign-in, account setup, and the merchant or customer panel.
export default function AppPage() {
  return <Dashboard />;
}
