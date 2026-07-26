/**
 * Data Unit Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "data-unit-converter",
  name: "Data Unit Converter",
  description: "Convert between bits, bytes, KiB, MiB, GiB, TiB, PiB, KB, MB, GB, TB with all-units table. 100% private. 100% private.",
  category: "calculators",
  keywords: ["data-unit-converter".replace(/-/g, ", "), "calculators"],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Data Unit Converter | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
