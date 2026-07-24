/**
 * Unicode Explorer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "unicode-explorer",
  name: "Unicode Explorer",
  description:
    "Inspect Unicode code points, names, blocks, categories, and UTF-8/16/32 encoding. 10+ extras. 100% private.",
  category: "text",
  keywords: ["unicode", "code point", "utf-8", "character info", "unicode block", "encoding"],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Unicode Explorer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded to any server." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core functionality, (2) Batch mode, (3) Copy results, (4) Download as file, (5) History (localStorage), (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats summary, (11) Multi-format output, (12) Configurable settings, (13) Real-time preview." },
    ],
  },
  status: "done",
};
