/**
 * Text Sorter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-sorter",
  name: "Text Sorter",
  description:
    "Sort text lines, words, paragraphs, or CSV columns. 6 sort algorithms, natural number sort, locale-aware, and 10+ extras. 100% private.",
  category: "text",
  keywords: ["text sorter", "sort lines", "sort words", "alphabetical sort", "numeric sort", "natural sort"],
  icon: "arrow-down-up",
  requiresNetwork: false,
  seo: {
    title: "Text Sorter — Lines/Words/CSV + Natural + Locale | UnQTools",
    faq: [
      { q: "What can I sort?", a: "Lines (split by newline), words (split by whitespace), paragraphs (split by double newline), or CSV column values. Sort by alphabetical, numeric, length, natural (numeric-aware like 'file2' < 'file10'), or reverse any." },
      { q: "What extras does this tool have?", a: "Extras: (1) Sort lines, (2) Sort words, (3) Sort paragraphs, (4) Sort CSV column values, (5) Alphabetical sort, (6) Numeric sort, (7) Natural sort (numeric-aware), (8) Length sort, (9) Reverse sort, (10) Case-insensitive toggle, (11) Locale-aware (BCP-47 codes), (12) Remove duplicates after sort, (13) Keep empty lines toggle, (14) Custom separator, (15) Show sort stats, (16) CSV export." },
    ],
  },
  status: "done",
};
