import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-text-converter",
  name: "PDF to Text Converter",
  description:
    "Extract plain text from PDF files in the browser — pure JavaScript PDF content-stream parser. Reads each page's text operators (Tj, TJ, ', \"), joins text with configurable separators, and downloads a .txt file. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to text", "extract text from pdf", "pdf text extractor",
    "pdf to txt", "convert pdf to text", "pdf reader",
    "pdf-to-text-converter", "pdf text", "pdf plaintext",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to Text Converter — Extract Text from PDF in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts plain text from PDF files entirely in your browser. We load the PDF using pdf-lib, walk each page's content stream looking for text-showing operators (Tj, TJ, ', \"), decode the string operands (literal and hex strings), and join them into a .txt file. No external API, no upload — everything runs in JavaScript." },
      { q: "What PDF features are supported?", a: "We support: text in standard content streams (Tj/TJ/'/\" operators), text in compressed streams (FlateDecode is decompressed via DecompressionStream), multiple pages, page ranges, custom line separators, whitespace trimming, empty-line removal, line numbering, and basic font-based character decoding. We do NOT support: scanned PDFs (images of text — needs OCR which requires a 5MB+ WASM blob), encrypted/password-protected PDFs (pdf-lib throws — we surface a clear error), embedded fonts with custom encodings (we treat strings as UTF-16BE or PDFDocEncoding heuristically), right-to-left scripts, and form fields with appearances." },
      { q: "Why is the extracted text sometimes garbled?", a: "PDF text strings can use one of several encodings: PDFDocEncoding (Latin-1-like), UTF-16BE (with BOM), or custom font-specific encodings (Type1/CIDFont with custom CMaps). We heuristically detect UTF-16BE (strings starting with 0xFE 0xFF) and decode the rest as PDFDocEncoding (treated as Latin-1). For fonts with custom CMaps (common in CJK PDFs), the extracted bytes will not map to readable characters without the CMap data. Use pdftotext (poppler-utils) on desktop for those cases." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector (e.g. '1-3,5,7-9'). (3) Custom line separator (\\n, \\r\\n, or custom). (4) Trim whitespace per line. (5) Remove empty lines. (6) Stats — page count, word count, character count, line count. (7) Output encoding (UTF-8 with/without BOM). (8) Line numbers prepended. (9) History of recently converted PDFs (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and text extraction runs in your browser using pure JavaScript and pdf-lib. File contents never leave your device. Only conversion summaries (filename + page count) are saved to local history." },
      { q: "Why does my PDF say 'encrypted' or 'password-protected'?", a: "PDFs can be encrypted with a user password (required to open) or an owner password (required to remove restrictions like copy/print). pdf-lib cannot decrypt password-protected PDFs in pure JavaScript — that requires a native crypto library. Use qpdf --decrypt (command-line) or Adobe Acrobat to remove the encryption first, then upload the decrypted PDF here." },
    ],
  },
  status: "done",
};
