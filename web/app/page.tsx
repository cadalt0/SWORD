import type { Metadata } from "next";

import { Landing } from "./_landing/Landing";

export const metadata: Metadata = {
  title: "Sword · Pay anyone. Pay anywhere.",
  description: "Move money worldwide with stablecoins. Pay contractors, teams and vendors, or get paid by clients, in 80+ countries for a flat 1%.",
};

export default function Home() {
  return <Landing />;
}
