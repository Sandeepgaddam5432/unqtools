/**
 * Atbash Cipher — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-atbash-cipher",
  name: "Atbash Cipher",
  description: "Apply Atbash cipher (A↔Z, B↔Y, C↔X mirror). 100% private. 100% private.",
  category: "text",
  keywords: ["text-atbash-cipher".replace(/-/g, ", "), "text"],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Atbash Cipher | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
