// @ts-check
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwind from "@astrojs/tailwind";

// UnQTools — static, privacy-first, offline-capable PWA.
// Static output only; no SSR, no server-side runtime.
export default defineConfig({
  site: "https://unqtools.example.com",
  output: "static",
  integrations: [preact({ compat: true }), tailwind({ applyBaseStyles: false })],
  vite: {
    worker: { format: "es" },
  },
  build: {
    inlineStylesheets: "auto",
  },
});
