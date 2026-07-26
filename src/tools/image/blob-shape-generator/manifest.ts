/**
 * Blob Shape Generator (SVG) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "blob-shape-generator",
  name: "Blob Shape Generator (SVG)",
  description: "Generate organic blob shapes as SVG. Random or seeded generation with smooth Bezier curves.",
  category: "image",
  keywords: ["blob shape", "svg blob", "organic shape", "blob generator"],
  icon: "Circle",
  requiresNetwork: false,
  seo: {
    title: "Blob Shape Generator (SVG) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate organic blob shapes as SVG. Random or seeded generation with smooth Bezier curves." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Random blob generation, (2) (2) Seeded blob (reproducible), (3) (3) Complexity control, (4) (4) Smoothness control, (5) (5) Color fill, (6) (6) Stroke options, (7) (7) SVG export, (8) (8) PNG export, (9) (9) CSS background-image export, (10) (10) Copy SVG, (11) (11) Bulk generate (10 variations), (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
