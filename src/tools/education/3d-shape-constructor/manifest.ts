/**
 * 3D Shape Constructor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "3d-shape-constructor",
  name: "3D Shape Constructor",
  description: "Calculate 3D shape properties: surface area, volume, nets for common shapes. 100% private. 100% private.",
  category: "education",
  keywords: ["3d-shape-constructor".replace(/-/g, ", "), "education"],
  icon: "box",
  requiresNetwork: false,
  seo: {
    title: "3D Shape Constructor | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
