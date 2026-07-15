import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lrf-to-epub-converter",
  name: "LRF to EPUB Converter",
  description:
    "Convert Sony BroadBook (.lrf) ebooks to EPUB format in your browser. Parses the LRF header (signature LRF), extracts text objects from the BroadBook structure, splits into chapters, generates a complete EPUB with NCX + NAV TOC, and packages as a .epub ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "lrf to epub", "convert lrf to epub", "sony broadbook to epub",
    "lrf ebook converter", "lrf to epub online", "lrf to epub free",
    "sony reader to epub", "lrf to kindle", "lrf to ereader",
    "broadbook to epub", "lrf file converter",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "LRF to EPUB Converter — Convert Sony BroadBook .lrf to EPUB | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Sony BroadBook .lrf files by reading the LRF signature, walking the object table, decoding text objects (BookAttr + PageAttr + TextObj), splitting the content into chapters by heading detection, and generating a valid EPUB 3 archive with both NCX (EPUB 2) and NAV (EPUB 3) tables of contents. The result opens in Apple Books, Calibre, Kobo, Nook, and most e-readers." },
      { q: "What is the LRF format?", a: "LRF (BroadBook) is Sony's proprietary ebook format used by the Sony Reader (PRS-500, PRS-505, etc.). It uses a binary object-oriented structure with a header, object table, and typed objects (PageList, PageAttr, BookAttr, TextObj, ImageObj). Sony discontinued the format in 2010 in favor of EPUB, but many old LRF files remain in personal libraries." },
      { q: "Does it support LRS or LRX files?", a: "No. LRS is the XML source format (we don't parse XML here — use a general XML-to-text tool), and LRX is the DRM-protected version of LRF (we cannot decrypt DRM). This tool only works with plain, DRM-free .lrf binary files." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Custom title and author metadata. (3) Stats — objects, text objects, words, characters. (4) Live preview of the first chapter's XHTML. (5) Custom CSS injection into the EPUB stylesheet. (6) Configurable base font size (10–36pt). (7) Conversion history in localStorage (last 10). (8) Shareable URL with conversion options. (9) Chapter detection by heading. (10) Both NCX (EPUB 2) and NAV (EPUB 3) tables of contents for maximum reader compatibility." },
      { q: "Is my LRF file uploaded anywhere?", a: "No. All LRF parsing, object extraction, EPUB XML generation, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "Will the EPUB preserve images from the LRF?", a: "No. We currently extract text only. LRF ImageObj entries are not extracted and embedded in the EPUB. This keeps the converter pure-JS and lightweight. For image extraction, use a desktop tool like Calibre." },
    ],
  },
  status: "done",
};
