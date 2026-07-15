import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-djvu-converter",
  name: "PDF to DjVu Converter",
  description:
    "Convert PDF text to a simplified DjVu format in your browser. Pure JavaScript — extracts text from each PDF page, generates a simplified DjVu MRP-style binary with text chunks and page breaks. Downloads a .djvu file. Honest disclaimer: this is a text-only simplified format, not a full DjVu image-based file.",
  category: "file",
  keywords: [
    "pdf to djvu", "convert pdf to djvu", "pdf to djvu online",
    "pdf to djvu free", "pdf to djvu text", "extract text from pdf to djvu",
    "djvu generator", "pdf to djvu converter", "djvu text layer",
    "simplified djvu",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to DjVu Converter — Convert PDF to Simplified DjVu in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates a simplified DjVu-format binary file. The output is a text-only DjVu — it does NOT contain wavelet-compressed images of the PDF pages. Each page is represented as a text chunk with the extracted text content." },
      { q: "Is this a real DjVu file?", a: "No. We are honest about this: real DjVu files use wavelet compression for images and an embedded text layer. We generate only the text layer (a simplified DjVu MRP-style structure with text chunks and page breaks). The output is NOT readable by DjView, Okular, or other standard DjVu viewers. If you need a real DjVu file, use a desktop tool like pdf2djvu (Linux), DjVuLibre, or AnyDjVu (Windows)." },
      { q: "Why offer a simplified DjVu then?", a: "Three reasons: (1) The text layer is the most useful part for search and accessibility. (2) A pure-JS full DjVu encoder would require wavelet transforms (10MB+ of WASM) which would violate our 50KB-island budget. (3) Some users want a text-only archival format that's smaller than the original PDF. We're upfront about the limitations — please don't use this if you need image fidelity." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom document metadata (title, author). (4) Stats — page count, word count, character count. (5) Configurable text encoding (UTF-8 / Latin-1). (6) Page break markers between PDF pages. (7) Live preview of the generated binary structure (hex view). (8) Text compression note (we use STORE method). (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and DjVu generation happens in your browser. File contents never leave your device." },
      { q: "What is DjVu anyway?", a: "DjVu is a file format developed at AT&T Labs in 1996. It's optimized for scanned documents — it separates the text (foreground) from images (background) and compresses each with different algorithms. The text layer uses a custom arithmetic coder (z-coder); images use IW44 wavelet compression. DjVu files are typically 5-10× smaller than equivalent PDFs for scanned documents. Use it if you need: archival of scanned books, distribution of academic papers, or library digitization." },
    ],
  },
  status: "done",
};
