/**
 * Text Trimmer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-trimmer",
  name: "Text Trimmer",
  description:
    "Trim whitespace, leading/trailing characters, empty lines, and more. Multi-line batch, custom char trim, and 10+ extras. 100% private.",
  category: "text",
  keywords: ["text trimmer", "trim whitespace", "strip whitespace", "remove spaces", "trim text", "leading trailing"],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Text Trimmer — Whitespace + Custom Char + Line Cleanup | UnQTools",
    faq: [
      { q: "What can this tool trim?", a: "Leading/trailing whitespace (spaces, tabs, newlines), internal double-spaces, empty lines, specific custom characters, quotes, markdown syntax, HTML tags, zero-width characters, and BOM markers." },
      { q: "What extras does this tool have?", a: "Extras: (1) Trim leading whitespace, (2) Trim trailing whitespace, (3) Trim both, (4) Collapse internal whitespace, (5) Remove empty lines, (6) Custom character trim, (7) Strip quotes (single/double/backtick), (8) Strip markdown syntax (* _ # `), (9) Strip HTML tags, (10) Strip zero-width chars (U+200B, U+FEFF), (11) Strip BOM, (12) Trim each line individually, (13) Batch mode (one item per line), (14) Show before/after diff stats." },
    ],
  },
  status: "done",
};
