// @ts-check
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// UnQTools — static, privacy-first, offline-capable PWA.
// Static output only; no SSR, no server-side runtime, no SPA fallback.
// Deploy target: Cloudflare Pages (every route is its own prerendered HTML file).
//
// The `site` value drives absolute URLs for sitemap, canonical, OG tags, and
// the PWA manifest start_url. It's a placeholder until the real domain is set
// — update this once and everything downstream updates with it.
export default defineConfig({
  site: "https://unqtools.pages.dev",
  output: "static",
  // No `adapter` — pure static build. Cloudflare Pages serves the dist/ directory as-is.
  integrations: [
    preact({ compat: true }),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      // Add lastmod, changefreq, priority hints for search engines.
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      // Filter out 404 from sitemap (we don't want search engines indexing it).
      filter: (page) => !page.includes("/404"),
    }),
  ],
  vite: {
    worker: { format: "es" },
  },
  build: {
    // Inline small stylesheets to reduce render-blocking requests.
    inlineStylesheets: "auto",
  },
});
