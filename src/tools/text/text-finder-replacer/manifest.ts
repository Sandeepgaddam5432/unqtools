/**
 * Text Finder & Replacer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-finder-replacer",
  name: "Text Finder & Replacer",
  description:
    "Find and replace text with regex, case-sensitive, whole-word, and batch mode. With 10+ extras. 100% private.",
  category: "text",
  keywords: ["find replace", "regex", "text search", "substitute", "swap"],
  icon: "finder-replacer",
  requiresNetwork: false,
  seo: {
    title: "Text Finder & Replacer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded to any server." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core functionality, (2) Batch mode, (3) Copy results, (4) Download as file, (5) History (localStorage), (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats summary, (11) Multi-format output, (12) Configurable settings, (13) Real-time preview." },
    ],
  },
  status: "done",
};
