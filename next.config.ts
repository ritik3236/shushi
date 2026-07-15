import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verify builds run in their own distDir so `next build` never corrupts a live `next dev` cache.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
    // Statement/payslip uploads run through a Server Action, whose body defaults
    // to a 1 MB cap — large GPay PDFs get rejected before our own 15 MB check in
    // actions.ts. Lift it just past that ceiling so the friendly size error is
    // the effective gate, not this raw framework error.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
