/**
 * Plagiarism Similarity Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-plagiarism-checker",
  name: "Plagiarism Similarity Checker",
  description: "Compare two texts for similarity with n-gram analysis and highlight. 100% private. 100% private.",
  category: "text",
  keywords: ["text-plagiarism-checker".replace(/-/g, ", "), "text"],
  icon: "search-check",
  requiresNetwork: false,
  seo: {
    title: "Plagiarism Similarity Checker | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
