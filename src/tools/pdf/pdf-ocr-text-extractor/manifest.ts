import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-ocr-text-extractor",
  name: "PDF Text Extractor",
  description:
    "Extract embedded text from PDF pages with multi-format export (text, JSON, CSV, Markdown). Includes page-range selection, text statistics, keyword frequency, reading-time estimate, language detection, in-content search, empty-page filter, history, and shareable URL. 100% client-side — your PDF never leaves your browser.",
  category: "pdf",
  keywords: [
    "pdf text extractor",
    "extract text from pdf",
    "pdf to text",
    "pdf to json",
    "pdf to csv",
    "pdf to markdown",
    "pdf content extractor",
    "pdf text mining",
    "read pdf text",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF Text Extractor — Extract PDF Text to TXT / JSON / CSV / MD | UnQTools",
    faq: [
      {
        q: "How does the PDF Text Extractor work?",
        a: "It parses each PDF page's content stream in your browser and pulls out embedded text from text-showing operators (Tj, TJ, ', \"). If the PDF only contains scanned images (no embedded text layer), the tool reports the page as empty and explains that real OCR would require a heavy dependency like Tesseract.js.",
      },
      {
        q: "What output formats are supported?",
        a: "Four formats: plain text (one section per page), JSON (page → text mapping), CSV (one row per page: page, charCount, wordCount, text), and Markdown (with page headings and fenced blocks).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser (1-3, 5, 8-). (2) Four output formats (text/JSON/CSV/MD). (3) Page-number headers. (4) Line-break preserver. (5) Text statistics (chars/words/lines/paragraphs). (6) Page separator generator. (7) Empty-page detector. (8) Text quality scorer. (9) Multi-format renderers. (10) Copy + download. (11) History (localStorage, last 20). (12) Shareable URL. (13) Summary stats (pages, extracted chars, avg/page). (14) In-content text search. (15) Keyword frequency analyzer (top 20). (16) Reading-time estimator. (17) Basic language detector. (18) Empty-page filter.",
      },
      {
        q: "Why can't I get text from a scanned PDF?",
        a: "Scanned PDFs store only raster images — there is no text layer to extract. True OCR (recognizing characters in images) needs a large (~10 MB+) ML model such as Tesseract.js. This tool focuses on instant, private extraction of the embedded text layer. For scanned documents, you'll see 'no embedded text' notes per page.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. PDF parsing, text extraction, formatting, statistics, and downloads all run locally in your browser. No file or extracted text is ever uploaded. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
