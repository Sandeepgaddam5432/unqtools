/**
 * Pig Latin Translator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-pig-latin",
  name: "Pig Latin Translator",
  description: "Translate text to and from Pig Latin. 100% private. 100% private.",
  category: "text",
  keywords: ["text-pig-latin".replace(/-/g, ", "), "text"],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Pig Latin Translator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
