import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "epub-to-azw3-converter",
  name: "EPUB to AZW3 Converter",
  description:
    "Convert EPUB ebooks to AZW3/KF8 (Kindle Format 8) in the browser — pure JavaScript. Parses EPUB, generates AZW3 (PalmDB + KF8 header + HTML records + BOUNDARY marker) using the proven pdf-to-azw3 generator. Supports custom title/author, cover page, encoding, chapter detection. 100% client-side.",
  category: "file",
  keywords: [
    "epub to azw3", "azw3 converter", "kf8 converter",
    "kindle format 8", "ebook converter", "epub2azw3",
    "convert epub", "kindle ebook",
    "epub-to-azw3-converter", "azw3 ebook",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "EPUB to AZW3 Converter — Convert .epub to .azw3 in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts EPUB ebooks to AZW3 (KF8 / Kindle Format 8) in your browser. EPUB is a ZIP archive of XHTML chapters. We parse the EPUB (using our proven epub-reader logic), extract each chapter's text, then generate an AZW3 file using the proven pdf-to-azw3 generator (PalmDB header + PalmDOC + MOBI header marked as KF8 type=6 + EXTH + HTML text records + BOUNDARY marker). The output .azw3 is readable by modern Kindle devices and the Kindle app." },
      { q: "What is the AZW3/KF8 format?", a: "AZW3 (KF8, Kindle Format 8) is Amazon's modern ebook format, introduced in 2011 with the Kindle Fire. It replaces the older MOBI format and supports HTML5/CSS3-like styling, embedded fonts, drop caps, and fixed-layout pages. Internally it's still based on the PalmDB container (78-byte header + record info table + records), but the records contain KF8-style HTML and a 'BOUNDARY' marker separating the KF8 section from the legacy MOBI section (for backwards compatibility with older Kindles)." },
      { q: "How is AZW3 different from MOBI?", a: "MOBI is the legacy format (2005-era): simple HTML, no CSS, no embedded fonts, 4096-byte text records, fixed line spacing. AZW3 (KF8) is the modern format: HTML5 + CSS3, embedded fonts, drop caps, custom line spacing, fixed-layout support, and a richer rendering engine. AZW3 also includes a 'BOUNDARY' marker that separates the KF8 section from a legacy MOBI section for backwards compatibility. Modern Kindle devices prefer AZW3; very old Kindles (pre-2011) only support MOBI." },
      { q: "Can I include a cover page?", a: "Yes — by default we generate a cover page as the first record: a centered <h1>title</h1> + <p>author</p> + subtitle. You can customize the cover subtitle text. Real AZW3 files can embed a cover image (JPEG) as a separate record — we don't support that, but the textual cover page is preserved." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Chapter detection from EPUB spine (preserves chapter boundaries via <h1> tags). (3) Custom title/author override (defaults to EPUB metadata). (4) Stats — chapter count, word count, record count, file size. (5) Preview of first chapter's extracted text. (6) Encoding choice (UTF-8 or CP1252). (7) Cover page generation with title + author + subtitle. (8) History (localStorage — last 10 conversions). (9) Shareable URL with options. (10) Table of contents detection (from EPUB's NCX/NAV, preserved as chapter headings)." },
      { q: "Is my EPUB file uploaded anywhere?", a: "No. All EPUB parsing and AZW3 generation runs in your browser using pure JavaScript. File contents never leave your device. Only file summaries (filename, chapter count, word count) are saved to local history." },
      { q: "Why is the AZW3 file larger than the EPUB?", a: "EPUBs use DEFLATE compression for XHTML files (typically 70-80% smaller). AZW3's HTML records are uncompressed in our generator (PalmDOC compression method 1 = none, for compatibility). So the AZW3 will be roughly 3-5x larger than the EPUB. Real Calibre AZW3 output uses PalmDOC RLE compression but we don't implement that to keep the tool small." },
    ],
  },
  status: "done",
};
