import type { Metadata } from "next";

import { Playground } from "./Playground";

export const metadata: Metadata = {
  title: "API playground · Sword",
  description: "Try every sword-merchant call against the Sword API with your test key, and see the real answer.",
};

/// Read the API address on every request, so the samples show where calls really go.
export const dynamic = "force-dynamic";

/// /playground: try the Sword API with a test key. Public: the key is what decides what a call can do.
export default function Page() {
  return <Playground apiBase={(process.env.SWORD_API_URL ?? "https://sword-api-cadalt-d47a7a90dc84.herokuapp.com").replace(/\/+$/, "")} />;
}
