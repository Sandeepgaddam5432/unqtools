/**
 * Instagram Grid Splitter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-instagram-grid",
  name: "Instagram Grid Splitter",
  description: "Split image into Instagram grid (3x1, 3x3, 3x9) with download all tiles. 100% private. 100% private.",
  category: "image",
  keywords: ["image-instagram-grid".replace(/-/g, ", "), "image"],
  icon: "grid-2x2",
  requiresNetwork: false,
  seo: {
    title: "Instagram Grid Splitter | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
