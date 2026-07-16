import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mobi-to-epub-converter",
  name: "MOBI to EPUB Converter",
  description:
    "Convert MOBI ebooks to EPUB format in the browser — pure JavaScript. Parses MOBI (PalmDB + MOBI + EXTH headers + text records), extracts chapter text, splits into chapters by <h1>/<h2>/<mbp:pagebreak/>, generates an EPUB 3 (OPF + NCX + NAV + XHTML chapters). Supports custom title/author, CSS, encoding. 100% client-side.",
  category: "file",
  keywords: [
    "mobi to epub", "mobi converter", "epub converter",
    "kindle to epub", "ebook converter", "mobi2epub",
    "convert mobi", "palm database to epub",
    "mobi-to-epub-converter", "mobi ebook",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "MOBI to EPUB Converter — Convert .mobi to .epub in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts MOBI ebooks to EPUB format in your browser. MOBI is a Palm Database container with HTML text records. We parse the MOBI (using our proven mobi-reader logic — PalmDB header, MOBI header, EXTH metadata, PalmDOC decompression), extract the book's HTML text, split into chapters by <h1>/<h2>/<mbp:pagebreak/> tags, then generate an EPUB 3 (mimetype + META-INF/container.xml + OEBPS/content.opf + toc.ncx + nav.xhtml + chapter*.xhtml) using the proven pdf-to-epub-converter generator." },
      { q: "Why convert MOBI to EPUB?", a: "EPUB is the open, cross-platform ebook standard (used by Apple Books, Kobo, Google Play Books, Calibre, and most non-Kindle readers). MOBI is Amazon's older format (now deprecated in favor of KF8/AZW3). Converting MOBI → EPUB lets you read your Amazon-purchased books on non-Kindle devices, edit them in Sigil/Calibre, or archive them in a future-proof format. Note: DRM-protected MOBI files cannot be converted — you must remove DRM first (legally restricted in some jurisdictions)." },
      { q: "How does the conversion work?", a: "Pipeline: (1) parse the MOBI PalmDB header (78 bytes); (2) parse the record info table; (3) parse record 0 (PalmDOC + MOBI + EXTH headers); (4) decompress each text record (we support compression 0=none and 1=PalmDOC RLE); (5) concatenate text records as HTML; (6) split HTML into chapters by <h1>/<h2>/<mbp:pagebreak/> tags; (7) generate EPUB 3 structure (OPF manifest + NCX + NAV + per-chapter XHTML)." },
      { q: "What about HuffCDic compression (method 2)?", a: "HuffCDic is a Huffman-coded compression used in some MOBI files (mostly older Amazon-purchased books). A pure-JS HuffCDic decoder is ~30KB+ and we don't bundle it. If your MOBI uses HuffCDic, conversion will fail with a clear error message. Use Calibre (desktop) to convert HuffCDic MOBIs to EPUB — it has a complete HuffCDic implementation." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Chapter detection from <h1>/<h2>/<mbp:pagebreak/> tags in the MOBI HTML. (3) Custom title/author override (defaults to MOBI metadata). (4) Stats — chapter count, word count, file size. (5) Preview of first chapter's extracted text. (6) Custom CSS appended to the EPUB stylesheet. (7) History (localStorage — last 10 conversions). (8) Shareable URL with options. (9) Table of contents generation (NCX for EPUB 2 + NAV for EPUB 3). (10) Encoding selection (UTF-8 or CP1252, auto-detected from MOBI header)." },
      { q: "Is my MOBI file uploaded anywhere?", a: "No. All MOBI parsing and EPUB generation runs in your browser using pure JavaScript. File contents never leave your device. Only file summaries (filename, chapter count, word count) are saved to local history." },
      { q: "Can I convert DRM-protected MOBI files?", a: "No. DRM (Digital Rights Management) on MOBI files uses Amazon's proprietary encryption. Removing DRM requires the device's PID (Product ID) and serial number, plus custom decryption code that's legally restricted in many jurisdictions. If your MOBI file fails to open with a 'DRM-protected' error, that's why. Most Project Gutenberg and Standard Ebooks MOBI downloads are DRM-free." },
    ],
  },
  status: "done",
};
