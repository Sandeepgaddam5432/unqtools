import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lit-to-epub-converter",
  name: "LIT to EPUB Converter",
  description:
    "Convert Microsoft Reader (.lit) ebooks to EPUB format in your browser. Parses the LIT header (signature ITOLITLS), extracts text sections, splits into chapters, generates a complete EPUB with NCX + NAV TOC, and packages as a .epub ZIP. 100% client-side. DRM-free LIT files only.",
  category: "file",
  keywords: [
    "lit to epub", "convert lit to epub", "microsoft reader to epub",
    "lit ebook converter", "lit to epub online", "lit to epub free",
    "lit to kindle", "lit to ereader", "lit file converter",
    "ms reader to epub", "lit to epub converter",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "LIT to EPUB Converter — Convert Microsoft Reader .lit to EPUB | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Microsoft Reader .lit files by reading the ITOLITLS signature, extracting the section table, decoding each text section, splitting the content into chapters (by heading detection), and generating a valid EPUB 3 archive with both NCX (EPUB 2) and NAV (EPUB 3) tables of contents. The result opens in Apple Books, Calibre, Kobo, Nook, and most e-readers." },
      { q: "Does it support DRM-protected LIT files?", a: "No. DRM-protected LIT files are encrypted and cannot be decoded without the original Microsoft Reader software (which has been discontinued). This tool only works with DRM-free LIT files. If your file is DRM-protected, you would need to remove the DRM first using a tool you legally own access to." },
      { q: "How does chapter detection work?", a: "After extracting text from each section, we run a heading detector that looks for Markdown-style headings (# / ##), 'Chapter N' patterns, 'Part N' patterns, and ALL CAPS heading lines (5+ chars). A new chapter starts at each detected heading. You can also choose 'one chapter per section' or 'single chapter' modes." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Custom title and author metadata. (3) Three chapter-splitting modes (section / heading / single). (4) Stats — sections, chapters, words, characters. (5) Live preview of the first chapter's XHTML. (6) Custom CSS injection into the EPUB stylesheet. (7) Configurable base font size (10–36pt). (8) Conversion history in localStorage (last 10). (9) Shareable URL with conversion options. (10) Both NCX (EPUB 2) and NAV (EPUB 3) tables of contents for maximum reader compatibility." },
      { q: "Is my LIT file uploaded anywhere?", a: "No. All LIT parsing, section extraction, EPUB XML generation, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "Will the EPUB preserve images from the LIT?", a: "No. We currently extract text only. LIT images (covers, illustrations) are not extracted and embedded in the EPUB. This keeps the converter pure-JS and lightweight. For image extraction, use a desktop tool like Calibre." },
    ],
  },
  status: "done",
};
