import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lrf-to-pdf-converter",
  name: "LRF to PDF Converter",
  description:
    "Convert Sony BroadBook LRF ebooks to PDF in the browser — pure JavaScript. Parses LRF header + object table, extracts text from TEXT-type objects, splits into chapters by headings, and renders to PDF using pdf-lib. Supports custom title, font size, page size, margins. 100% client-side.",
  category: "file",
  keywords: [
    "lrf to pdf", "lrf converter", "sony broadbook",
    "lrf ebook", ".lrf file", "lrf viewer",
    "ebook to pdf", "sony reader converter",
    "lrf-to-pdf-converter", "bbeb ebook",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "LRF to PDF Converter — Convert .lrf to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts Sony BroadBook LRF ebooks to PDF in your browser. LRF is Sony's proprietary ebook format (used by the Sony Reader PRS-500, discontinued in 2011). We parse the LRF header (8-byte signature 'LRF' + zeros, version, object count, metadata offset), walk the object table (each entry: 4-byte type + 4-byte offset + 4-byte size + 4-byte id), extract text from TEXT-type objects, split into chapters by heading patterns, and render to PDF using pdf-lib." },
      { q: "What is the LRF format?", a: "LRF (Sony BroadBook, also called BBeB — Broad Band eBook) is Sony's proprietary ebook format. It uses a binary container with: (1) an 8-byte signature 'LRF' + 5 zeros; (2) a 4-byte version (usually 800-1000); (3) a 4-byte object count; (4) a 4-byte metadata offset; (5) an object table where each entry is 16 bytes: type (META=0, BOOK=1, PAGE=2, TEXT=3, IMAGE=4) + offset + size + id. Real LRF files use compressed objects and a complex PageTree/PageList structure; we support the DRM-free text-extraction path." },
      { q: "Can it extract text from all LRF files?", a: "Honest answer: most LRF files use object-level compression (a Sony variant of zlib) which we cannot decode in pure JavaScript without bundling a ~30KB+ decoder. We extract text from uncompressed TEXT-type objects only. If your LRF file uses compressed objects (most Sony-purchased books do), conversion may fail with 'no text objects found'. Use Calibre (desktop) to convert compressed LRFs to PDF — it has a complete LRF decoder." },
      { q: "How does chapter detection work?", a: "After extracting text from the TEXT objects, we look for heading patterns: Markdown-style '# Chapter 1', 'Chapter 1', 'Part 1', or ALL-CAPS lines (5+ chars). Each heading starts a new chapter. If no headings are found, the entire text becomes one chapter. The output PDF has chapter headings rendered in bold, with the body text in regular Helvetica." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) LRF signature detection ('LRF' + zeros). (3) Object table parsing (type, offset, size, id). (4) Object type classification (META, BOOK, PAGE, TEXT, IMAGE). (5) Stats — object count, text object count, image count, page count, word count, PDF page count. (6) Custom title (defaults to LRF metadata title). (7) Adjustable font size (8-24pt). (8) Page size choice (US Letter or A4). (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my LRF file uploaded anywhere?", a: "No. All LRF parsing and PDF generation runs in your browser using pure JavaScript + pdf-lib. File contents never leave your device. Only file summaries (filename, object count, word count) are saved to local history." },
      { q: "Can I convert DRM-protected LRF files?", a: "No. Sony's LRF DRM is proprietary and was discontinued when Sony shut down the Reader Store in 2014. Most free LRF downloads (Project Gutenberg, Baen Free Library) are DRM-free. If your LRF is DRM-protected, conversion will fail. For non-DRM LRFs that use compressed objects, use Calibre (desktop) which has a complete LRF implementation." },
    ],
  },
  status: "done",
};
