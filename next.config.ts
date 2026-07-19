import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  // Emit JS source maps in production for easier debugging.
  // (Doesn't affect runtime perf — maps are only loaded when DevTools is open.)
  productionBrowserSourceMaps: true,
  // Modernize browser targets so the compiler can emit smaller, faster code
  // (skip transpilation for IE / legacy Edge / old Safari).
  // Browserslist is also configured in package.json.
  experimental: {
    // Pre-fetch the next likely route (e.g. /tools when on home).
    optimisticClientCache: true,
  },
  // Aggressive code splitting — split framework chunks for better caching.
  compiler: {
    // Strip console.log in production (keep console.error + console.warn).
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
};

export default nextConfig;
