import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verify builds run in their own distDir so `next build` never corrupts a live `next dev` cache.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
