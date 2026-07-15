import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-mobi-converter",
  name: "PDF to MOBI Converter",
  description:
    "Convert PDF text to MOBI ebook format in your browser. Generates a simplified PalmDB + MOBI header + text records structure. Pure JavaScript — no Calibre needed. Downloads a .mobi file readable by Kindle devices and apps.",
  category: "file",
  keywords: [
    "pdf to mobi", "convert pdf to mobi", "pdf to kindle",
    "pdf to mobi converter", "pdf to mobi online", "pdf to mobi free",
    "pdf ebook to kindle", "pdf to mobi text", "extract text from pdf to mobi",
    "palmdb mobi generator", "mobi ebook creator",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "PDF to MOBI Converter — Convert PDF to Kindle MOBI in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates a MOBI ebook file with a valid PalmDB header, PalmDOC header, MOBI header, optional EXTH metadata, and a series of text records (max 4096 bytes each). The result can be sideloaded to a Kindle device or opened in the Kindle app." },
      { q: "How does the MOBI structure work?", a: "A MOBI file starts with a PalmDB header (78 bytes) containing the book name, type ('BOOK'), creator ('MOBI'), and a record count. Then comes a record info table (8 bytes per record) listing each record's offset and unique ID. Record 0 contains the PalmDOC header (compression, text length, record count, record size, encryption), the MOBI header (identifier 'MOBI', text encoding, file version), and optional EXTH metadata (title, author, language). Records 1..N are the text records — chunks of HTML/text up to 4096 bytes each." },
      { q: "Is this a full MOBI implementation?", a: "No — it's a simplified subset. We generate uncompressed (compression=1=none) text records containing HTML-formatted paragraphs. We do NOT implement: PalmDOC RLE compression, HuffCDic compression, DRM, embedded fonts, images, KF8 (AZW3) layer, dictionaries, periodicals, or TOC via guide. The output is readable on most Kindle devices and apps but may not pass strict validators. For full-featured MOBI generation, use Calibre's ebook-convert." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom title and author metadata. (4) Three chapter modes (page / heading / single — same as our EPUB converter). (5) Configurable text encoding (CP1252 / UTF-8). (6) Stats — record count, word count, character count. (7) Chapter detection (splits at headings, generates <h1> tags). (8) Bookmark support (generates <mbp:pagebreak/> between chapters). (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and MOBI generation happens in your browser. File contents never leave your device." },
      { q: "Why use MOBI instead of AZW3 / KF8?", a: "MOBI is the older Mobipocket format — supported by every Kindle ever made. AZW3 (KF8) is the newer format with better formatting support (CSS, fonts, drop caps). Old Kindles (pre-2012) only read MOBI. Newer Kindles read both. Use MOBI for maximum compatibility, AZW3 for modern features." },
    ],
  },
  status: "done",
};
