"use client";

import { Features } from "./Features";
import { Currencies, Fees, NoFreeze, PayAnywhere } from "./Global";
import { Control, Developers, FinalCta, Footer, Numbers } from "./Sections";
import { Hero, Nav } from "./Hero";

/// The public home page. Always dark, whatever the app's theme, so the sword and the glow look the way they should.
export function Landing() {
  return (
    <div className="dark min-h-screen overflow-x-clip bg-[#06060c] text-white selection:bg-violet-500/40">
      <Nav />
      <main>
        <Hero />
        <Numbers />
        <Fees />
        <PayAnywhere />
        <Currencies />
        <NoFreeze />
        <Features />
        <Control />
        <Developers />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
