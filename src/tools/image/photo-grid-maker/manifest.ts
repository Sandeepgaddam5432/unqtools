/**
 * Photo Grid Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "photo-grid-maker",
  name: "Photo Grid Maker",
  description: "Create photo grids/collages from multiple images. Multiple layouts, gap, padding, background.",
  category: "image",
  keywords: ["photo grid", "photo collage", "image grid", "grid maker"],
  icon: "LayoutGrid",
  requiresNetwork: false,
  seo: {
    title: "Photo Grid Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create photo grids/collages from multiple images. Multiple layouts, gap, padding, background." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 10+ grid layouts, (2) (2) Custom rows/columns, (3) (3) Gap control, (4) (4) Padding, (5) (5) Background color, (6) (6) Drag-drop reorder, (7) (7) Per-cell resize, (8) (8) Download as PNG, (9) (9) Copy HTML+CSS, (10) (10) Live preview, (11) (11) Bulk import, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
