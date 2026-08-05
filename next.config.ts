import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  // Source maps off: they roughly double the deploy payload on Cloudflare Pages
  // and slow builds/edge/crawl for no user-visible benefit.
  productionBrowserSourceMaps: false,
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
