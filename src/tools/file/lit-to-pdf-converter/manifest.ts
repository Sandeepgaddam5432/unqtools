import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lit-to-pdf-converter",
  name: "LIT to PDF Converter",
  description:
    "Convert MS Reader LIT ebooks to PDF in the browser — pure JavaScript. Parses LIT (Microsoft Reader) header + section table, extracts text, splits into chapters by headings, and renders to PDF using pdf-lib. Supports custom title, font size, page size, margins. 100% client-side.",
  category: "file",
  keywords: [
    "lit to pdf", "lit converter", "microsoft reader",
    "lit ebook", ".lit file", "lit viewer",
    "ebook to pdf", "ms reader converter",
    "lit-to-pdf-converter", "lit ebook to pdf",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "LIT to PDF Converter — Convert .lit to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts Microsoft Reader LIT ebooks to PDF in your browser. LIT is a Microsoft ebook format (discontinued in 2012, but old books still circulate). We parse the LIT header (8-byte signature 'ITOLITLS' + version + section count + section table), extract text from each text section (we skip LZX-compressed sections — see honesty clause below), split into chapters by heading patterns, and render to PDF using pdf-lib." },
      { q: "What is the LIT format?", a: "LIT (Microsoft Reader) is an ebook format Microsoft released in 2000 and discontinued in 2012. The format is based on the Open Ebook Publication Structure (OEBPS) — sections containing HTML or plain text, optionally compressed with LZX (a Huffman+LZ77 variant). The LIT container starts with an 8-byte signature 'ITOLITLS', then a 4-byte version, a 4-byte header size, a 4-byte section count, and a section table (each entry: 4-byte offset + 4-byte size + 4-byte flags)." },
      { q: "Can it extract text from all LIT files?", a: "Honest answer: not from LZX-compressed sections. LZX is a complex compression format (used in Windows Imaging Format WIM files, and some CHM help files). A pure-JS LZX decoder is ~50KB+ and we don't bundle it. Most LIT files have an uncompressed section 0 (metadata XML) and may have uncompressed text sections (older LITs); we extract those. For LZX-only LITs, conversion fails with a clear error message. Use Calibre (desktop) to convert LZX-compressed LITs to PDF — it has a complete LZX implementation." },
      { q: "How does chapter detection work?", a: "After extracting text from the LIT sections, we look for heading patterns: Markdown-style '# Chapter 1', 'Chapter 1', 'Part 1', or ALL-CAPS lines (5+ chars, no lowercase). Each heading starts a new chapter. If no headings are found, the entire text becomes one chapter. The output PDF has one page per chapter (with wrapping) plus chapter headings." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) LIT signature detection ('ITOLITLS'). (3) Section table parsing (offset, size, flags). (4) Compression detection (flag bit 0 = LZX compressed). (5) Stats — section count, text section count, compressed section count, chapter count, word count. (6) Custom title (defaults to LIT metadata title). (7) Adjustable font size (8-24pt). (8) Page size choice (US Letter or A4). (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my LIT file uploaded anywhere?", a: "No. All LIT parsing and PDF generation runs in your browser using pure JavaScript + pdf-lib. File contents never leave your device. Only file summaries (filename, section count, word count) are saved to local history." },
      { q: "Can I convert DRM-protected LIT files?", a: "LIT files could be DRM-protected via Microsoft's 'Owner Exclusive' flag. Microsoft disabled the DRM activation servers in 2012, so old DRM-protected LITs can no longer be activated on new devices. If your LIT is DRM-protected, conversion will fail because we can't decrypt it. Most free LIT downloads (Project Gutenberg, Baen Free Library) are DRM-free." },
    ],
  },
  status: "done",
};
