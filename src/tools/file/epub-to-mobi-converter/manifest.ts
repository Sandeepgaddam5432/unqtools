import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "epub-to-mobi-converter",
  name: "EPUB to MOBI Converter",
  description:
    "Convert EPUB ebooks to MOBI format in the browser — pure JavaScript. Parses EPUB (ZIP + OPF + chapters), generates a MOBI file (PalmDB header + PalmDOC + MOBI + EXTH + text records) using the proven pdf-to-mobi generator. Supports custom title/author, chapter detection, UTF-8/CP1252 encoding. 100% client-side.",
  category: "file",
  keywords: [
    "epub to mobi", "epub converter", "mobi converter",
    "ebook converter", "kindle format", "epub2mobi",
    "convert epub", "palm database",
    "epub-to-mobi-converter", "mobi ebook",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "EPUB to MOBI Converter — Convert .epub to .mobi in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts EPUB ebooks to MOBI format in your browser. EPUB is a ZIP archive containing XHTML chapter files, an OPF manifest, and a NCX/NAV table of contents. We parse the EPUB (using our proven epub-reader logic), extract each chapter's text content, then generate a MOBI file using the proven pdf-to-mobi generator (PalmDB header + PalmDOC header + MOBI header + EXTH metadata + text records split into 4096-byte chunks). The result is a .mobi file readable by older Kindle devices and the Kindle app." },
      { q: "What is the MOBI format?", a: "MOBI is an ebook format developed by Mobipocket (acquired by Amazon in 2005) and used by early Kindle devices. It's based on the Palm Database (PalmDB) container: a 78-byte header, a record info table, and a series of records. Record 0 is the PalmDOC + MOBI + EXTH headers, records 1..N are the book's HTML text (split into 4096-byte chunks), and later records may hold images. Modern Kindles prefer KF8/AZW3, but MOBI is still widely supported." },
      { q: "How does the conversion work?", a: "Pipeline: (1) parse the EPUB ZIP and extract the OPF manifest; (2) read each chapter's XHTML file from the spine; (3) strip HTML tags to get plain text per chapter; (4) wrap each chapter's text in <h1>title</h1><p>para</p>... HTML; (5) generate the MOBI file via the proven pdf-to-mobi generator (PalmDB + PalmDOC + MOBI + EXTH + 4096-byte text records). The output .mobi preserves chapter boundaries via <h1> tags (the MOBI reader detects them as chapter breaks)." },
      { q: "What encoding should I use?", a: "UTF-8 (default) supports all Unicode characters (accented letters, CJK, emoji). CP1252 (Windows Latin-1) is smaller but only covers Western European characters — use it for English/French/German/Spanish/Italian books where file size matters. Most modern MOBI readers handle UTF-8 fine; CP1252 is for legacy compatibility." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Chapter detection from EPUB spine (preserves chapter boundaries in MOBI via <h1> tags). (3) Custom title/author override (defaults to EPUB metadata). (4) Stats — chapter count, word count, record count, file size. (5) Preview of first chapter's extracted text. (6) Encoding choice (UTF-8 or CP1252). (7) History (localStorage — last 10 conversions). (8) Shareable URL with options. (9) Compression note (MOBI text records are uncompressed — file size will be larger than EPUB's compressed XHTML). (10) Table of contents detection (from EPUB's NCX/NAV, preserved as chapter headings)." },
      { q: "Is my EPUB file uploaded anywhere?", a: "No. All EPUB parsing and MOBI generation runs in your browser using pure JavaScript. File contents never leave your device. Only file summaries (filename, chapter count, word count) are saved to local history." },
      { q: "Why is the MOBI file larger than the EPUB?", a: "EPUBs use DEFLATE compression for their XHTML files (typically 70-80% smaller than the raw text). MOBI's text records are uncompressed in our generator (PalmDOC compression method 1 = none, for compatibility). So the MOBI will be roughly 3-5x larger than the EPUB. Real Calibre MOBI output uses PalmDOC RLE compression (method 1 = PalmDOC, ~50% reduction) but we don't implement that to keep the tool small. The trade-off is file size vs. complexity." },
    ],
  },
  status: "done",
};
