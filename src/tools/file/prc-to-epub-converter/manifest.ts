import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "prc-to-epub-converter",
  name: "PRC to EPUB Converter",
  description:
    "Convert Mobipocket PRC ebooks to EPUB format in your browser. Parses the PalmDB header, extracts text records, decodes PalmDOC compression, splits into chapters, generates a complete EPUB with NCX + NAV TOC, and packages as a .epub ZIP. 100% client-side. DRM-free PRC files only.",
  category: "file",
  keywords: [
    "prc to epub", "convert prc to epub", "mobipocket to epub",
    "prc ebook converter", "prc to epub online", "prc to epub free",
    "palmdoc to epub", "prc to kindle", "prc to ereader",
    "prc file converter", "mobipocket prc to epub",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "PRC to EPUB Converter — Convert Mobipocket PRC to EPUB | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Mobipocket .prc files by reading the PalmDB header (78 bytes), walking the record info table, decoding PalmDOC RLE compression (method 1) or uncompressed text (method 0), detecting chapters via <h1>/<h2>/mbp:pagebreak tags, and generating a valid EPUB 3 archive with both NCX (EPUB 2) and NAV (EPUB 3) tables of contents. The result opens in Apple Books, Calibre, Kobo, Nook, and most e-readers." },
      { q: "What is the difference between PRC and MOBI?", a: "PRC and MOBI are nearly identical — both use the PalmDB container with a PalmDOC + MOBI header. The file extension .prc was used for PalmDOC books (creator 'TEXt') while .mobi was used for Mobipocket books (creator 'MOBI'). This tool accepts both creator codes. HuffCDic compression (method 2) is not supported." },
      { q: "Does it support DRM-protected PRC files?", a: "No. DRM-protected PRC files are encrypted and cannot be decoded without the original Mobipocket Reader software. This tool only works with DRM-free PRC files. If your file is DRM-protected, you would need to remove the DRM first using a tool you legally own access to." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Custom title and author metadata. (3) Auto-detected encoding (CP1252 / UTF-8). (4) Stats — records, text records, words, characters. (5) Live preview of the first chapter's XHTML. (6) Custom CSS injection into the EPUB stylesheet. (7) Configurable base font size (10–36pt). (8) Conversion history in localStorage (last 10). (9) Shareable URL with conversion options. (10) Both NCX (EPUB 2) and NAV (EPUB 3) tables of contents for maximum reader compatibility." },
      { q: "Is my PRC file uploaded anywhere?", a: "No. All PRC parsing, record extraction, PalmDOC decompression, EPUB XML generation, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "Will the EPUB preserve images from the PRC?", a: "No. We currently extract text only. PRC image records are not extracted and embedded in the EPUB. This keeps the converter pure-JS and lightweight. For image extraction, use a desktop tool like Calibre." },
    ],
  },
  status: "done",
};
