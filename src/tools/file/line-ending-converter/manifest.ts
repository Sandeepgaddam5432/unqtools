/**
 * Line Ending Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "line-ending-converter",
  name: "Line Ending Converter",
  description:
    "Convert line endings between CRLF (Windows), LF (Unix), CR (Classic Mac). Detect source, normalize, batch files, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["line ending", "crlf", "lf", "newline", "line break", "windows unix", "normalize"],
  icon: "wrap-text",
  requiresNetwork: false,
  seo: {
    title: "Line Ending Converter — CRLF ↔ LF ↔ CR + Detect + Batch | UnQTools",
    faq: [
      { q: "What's the difference between CRLF, LF, and CR?", a: "LF (\\n, 0x0A) is Unix/Linux/macOS standard. CRLF (\\r\\n, 0x0D 0x0A) is Windows standard. CR (\\r, 0x0D) is classic Mac OS (pre-OS X), now extremely rare. Most modern systems use LF." },
      { q: "What extras does this tool have?", a: "Extras: (1) Auto-detect source line endings, (2) Convert to CRLF/LF/CR, (3) Show source + target counts, (4) Mixed-line-ending detection + warning, (5) Batch multiple files at once, (6) File size before/after delta, (7) .gitattributes generator for repo-wide settings, (8) EditorConfig snippet generator, (9) Preview first 10 lines side-by-side, (10) Copy converted text, (11) Download converted file, (12) Preserve BOM option, (13) Strip BOM option, (14) Show byte-level diff for first line." },
    ],
  },
  status: "done",
};
