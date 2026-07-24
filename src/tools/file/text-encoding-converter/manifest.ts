/**
 * Text Encoding Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-encoding-converter",
  name: "Text Encoding Converter",
  description:
    "Convert text files between UTF-8, UTF-16 LE/BE, ASCII, Latin-1, Windows-1252. Add/strip BOM, batch files, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["encoding converter", "utf-8", "utf-16", "ascii", "latin-1", "windows-1252", "bom", "charset converter"],
  icon: "file-cog",
  requiresNetwork: false,
  seo: {
    title: "Text Encoding Converter — UTF-8/16/ASCII/Latin-1 + BOM | UnQTools",
    faq: [
      { q: "Which encodings are supported?", a: "UTF-8 (with/without BOM), UTF-16 LE, UTF-16 BE, ASCII, Latin-1 (ISO-8859-1), and Windows-1252. The browser's TextEncoder handles UTF-8; UTF-16 uses DataView; ASCII and Latin-1 use single-byte mapping." },
      { q: "What extras does this tool have?", a: "Extras: (1) 6 target encodings, (2) Add/strip/preserve BOM toggle, (3) Auto-detect source encoding, (4) Show size before/after, (5) Show byte diff for first 80 bytes, (6) Lossy vs lossless conversion warning, (7) Batch multiple files, (8) Download converted file, (9) Copy converted text, (10) Show conversion log, (11) Preserve line endings, (12) Strip invalid chars vs replace with '?', (13) Hex preview of output, (14) Generate charset declaration for HTML." },
    ],
  },
  status: "done",
};
