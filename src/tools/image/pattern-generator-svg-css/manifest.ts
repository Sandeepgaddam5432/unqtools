/**
 * Pattern Generator (SVG/CSS) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pattern-generator-svg-css",
  name: "Pattern Generator (SVG/CSS)",
  description: "Generate SVG/CSS background patterns: stripes, dots, grid, checkerboard, chevrons, waves.",
  category: "image",
  keywords: ["pattern generator", "svg pattern", "css pattern", "background pattern"],
  icon: "Grid3x3",
  requiresNetwork: false,
  seo: {
    title: "Pattern Generator (SVG/CSS) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate SVG/CSS background patterns: stripes, dots, grid, checkerboard, chevrons, waves." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 20+ pattern types, (2) (2) Color customization, (3) (3) Size/spacing control, (4) (4) SVG export, (5) (5) CSS export, (6) (6) PNG export, (7) (7) Live preview, (8) (8) Random colors, (9) (9) Copy SVG, (10) (10) Copy CSS, (11) (11) Bulk generate, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
