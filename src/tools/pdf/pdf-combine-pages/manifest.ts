/**
 * PDF Combine Pages Side-by-Side — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-combine-pages",
  name: "PDF Combine Pages Side-by-Side",
  description: "Combine PDF pages 2-up (side-by-side) with spacing and orientation options. 100% private. 100% private.",
  category: "pdf",
  keywords: ["pdf-combine-pages".replace(/-/g, ", "), "pdf"],
  icon: "columns",
  requiresNetwork: false,
  seo: {
    title: "PDF Combine Pages Side-by-Side | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
