/**
 * CSS Color Format Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "css-color-format-converter",
  name: "CSS Color Format Converter",
  description: "Generate css color format converter with live preview, presets, and 10+ extras. 100% private, offline-capable.",
  category: "developer",
  keywords: ["css color format converter", "css color format converter"],
  icon: "Palette",
  requiresNetwork: false,
  seo: {
    title: "CSS Color Format Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate css color format converter with live preview, presets, and 10+ extras. 100% private, offline-capable." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multi-layer support, (2) Live preview, (3) 10+ presets, (4) Copy CSS/SCSS/Tailwind, (5) Import existing CSS, (6) Export JSON, (7) Randomize button, (8) Color picker, (9) Dark/light preview toggle, (10) PWA offline, (11) History (localStorage), (12) Bulk mode" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
