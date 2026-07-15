import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-azw3-converter",
  name: "PDF to AZW3 Converter",
  description:
    "Convert PDF text to AZW3 (KF8) Kindle format in your browser. Generates a simplified PalmDB + KF8 header + HTML records structure. Pure JavaScript — no Calibre needed. Downloads a .azw3 file readable by modern Kindle devices and apps.",
  category: "file",
  keywords: [
    "pdf to azw3", "convert pdf to azw3", "pdf to kf8",
    "pdf to kindle format", "pdf to azw3 converter",
    "pdf to azw3 online", "pdf to azw3 free",
    "pdf ebook to kindle azw3", "extract text from pdf to azw3",
    "azw3 ebook creator", "kf8 generator",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "PDF to AZW3 Converter — Convert PDF to Kindle KF8 in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates an AZW3 (KF8) Kindle file with a PalmDB header, KF8 boundary marker, and HTML records. The result can be sideloaded to modern Kindle devices (Paperwhite 2012+, Voyage, Oasis, Kindle Fire) and the Kindle app." },
      { q: "How does AZW3 differ from MOBI?", a: "AZW3 (also called KF8) is Amazon's newer format. It supports CSS styling, embedded fonts, drop caps, SVG images, hyphenation, and better typography than MOBI. AZW3 also supports a KF8 layer that wraps the legacy MOBI structure for backward compatibility. Our simplified generator produces the KF8 layer with HTML records — readable on modern Kindles." },
      { q: "Is this a full AZW3 implementation?", a: "No — it's a simplified subset. We generate the PalmDB header, a KF8-style boundary record, an HTML cover page, and text records. We do NOT implement: full KF8 index tables, embedded fonts, CSS, SVG, drop caps, images, dictionaries, or the dual-MOBI+KF8 wrapper. The output is readable on modern Kindle devices but may not pass strict validators. For full-featured AZW3, use Calibre's ebook-convert." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom title and author metadata. (4) Three chapter modes (page / heading / single). (5) Custom cover page text. (6) Stats — record count, word count, character count. (7) Chapter detection (splits at headings, generates <h1> tags). (8) Configurable text encoding (UTF-8 / CP1252). (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and AZW3 generation happens in your browser. File contents never leave your device." },
      { q: "Why use AZW3 instead of MOBI?", a: "AZW3 supports richer formatting (CSS, fonts, drop caps) and is the recommended format for modern Kindle devices (post-2012). MOBI is older but works on every Kindle ever made. Use AZW3 for modern Kindles, MOBI for legacy compatibility, or EPUB (which Amazon's Send-to-Kindle service auto-converts to AZW3)." },
    ],
  },
  status: "done",
};
