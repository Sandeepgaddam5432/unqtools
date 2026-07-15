import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "odt-to-pdf-converter",
  name: "ODT to PDF Converter",
  description:
    "Convert OpenDocument Text (.odt) files to PDF in the browser — pure JavaScript ODT parser + pdf-lib renderer. Extracts paragraphs, headings, and lists from content.xml, applies custom font size / page size / margins, and downloads a polished .pdf. 100% client-side.",
  category: "file",
  keywords: [
    "odt to pdf", "odt converter", "opendocument to pdf",
    "libreoffice to pdf", "openoffice to pdf", "odt viewer",
    "convert odt", "odt-to-pdf-converter", "odt pdf",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "ODT to PDF Converter — Convert .odt to PDF in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts OpenDocument Text (.odt) files to PDF entirely in your browser. We unzip the .odt (which is a ZIP container), read content.xml, extract paragraphs / headings / lists / preformatted blocks, then render them to a new PDF using pdf-lib. No LibreOffice or OpenOffice is required. Output is a polished PDF with selectable text and configurable page size, font size, and margins." },
      { q: "What ODT features are supported?", a: "We support: paragraphs (text:p), headings (text:h with outline-level attribute), ordered and unordered lists (text:list with text:list-item), line breaks within paragraphs (text:line-break), tabs (text:tab), hyperlinks (text:a with xlink:href), basic bold/italic via text:span style hints, and preformatted text blocks (text:p with style indicating monospace). Tables, images, footnotes, comments, tracked changes, embedded fonts, and complex style inheritance are flattened to plain paragraphs — the text content is preserved but layout fidelity is reduced." },
      { q: "Does it work for password-protected .odt files?", a: "No. Encrypted .odt files use a Blowfish/AES wrapping that requires the user's password and a WASM crypto blob to decrypt. We surface a clear 'encrypted ODT — password required' error. Use LibreOffice on desktop to remove the encryption first (File → Save As → uncheck 'Encrypt'). The same applies to ODS and ODP files." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Custom font size (8–24 pt). (3) Custom page size (A4 / Letter / Legal). (4) Custom margins (20–80 pt). (5) Stats — paragraph count, heading count, list count, page count. (6) Live preview of extracted text. (7) Custom PDF title (overrides ODT title from meta.xml). (8) Metadata extraction from meta.xml (title, author, subject, keywords, creation date). (9) History of recently converted .odt files (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my .odt file uploaded anywhere?", a: "No. All ODT parsing and PDF rendering runs in your browser using pure JavaScript and pdf-lib. File contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Why are some characters missing in the PDF?", a: "pdf-lib's StandardFonts (Helvetica, Times, Courier) only cover Latin-1 + Latin Extended. Cyrillic, Greek, CJK, and emoji characters in your ODT may be silently dropped. For full Unicode support, your .odt would need to embed the font in its ZIP — we don't extract embedded fonts (would add 50KB+ of font parsing). Use LibreOffice for documents with non-Latin scripts." },
    ],
  },
  status: "done",
};
