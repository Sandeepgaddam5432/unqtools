/**
 * Autoprefixer Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "autoprefixer",
  name: "Autoprefixer Tool",
  description: "Add vendor prefixes to CSS based on caniuse-like rules. ~30-property database. Browserslist presets.",
  category: "developer",
  keywords: ["autoprefixer", "autoprefixer tool", "encode", "decode", "converter"],
  icon: "Wand2",
  requiresNetwork: false,
  seo: {
    title: "Autoprefixer Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add vendor prefixes to CSS based on caniuse-like rules. ~30-property database. Browserslist presets." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
