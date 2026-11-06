import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test builds set NEXT_DIST_DIR so they never write into the folder a running dev server is using (that corrupts it).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [
      // Plans became individual subscriptions; old links land on the subscriptions page.
      { source: "/plans", destination: "/subscriptions", permanent: false },
    ];
  },
};

export default nextConfig;
