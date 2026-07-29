import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-word-converter-pdf",
  name: "PDF to Word Converter",
  description:
    "Convert PDF to DOCX, HTML, Markdown, or plain text in your browser. Extracts text and structure, detects headings via font-size analysis, preserves paragraphs and page breaks, and builds a minimal valid .docx (OOXML ZIP) entirely client-side. Includes history, shareable URL, summary stats, and document-structure analyzer. 100% private — no uploads.",
  category: "pdf",
  keywords: [
    "pdf to word",
    "pdf to docx",
    "pdf converter",
    "convert pdf",
    "pdf to html",
    "pdf to markdown",
    "pdf to text",
    "docx generator",
    "extract pdf structure",
  ],
  icon: "file-type",
  requiresNetwork: false,
  seo: {
    title: "PDF to Word Converter — DOCX / HTML / Markdown / Text | UnQTools",
    faq: [
      {
        q: "How does the PDF to Word converter work?",
        a: "It parses each PDF page's content stream, extracts text along with font-size information, detects headings (text larger than the body size), and reconstructs paragraphs. The result is packaged as a minimal valid .docx (a ZIP of OOXML XML files) — all in your browser. HTML, Markdown, and plain-text exports are also available.",
      },
      {
        q: "Is the generated .docx a real Word file?",
        a: "Yes — it's a minimal OOXML package containing [Content_Types].xml, _rels/.rels, and word/document.xml, packaged as a ZIP with proper CRC-32 checksums. Word, LibreOffice, Pages, and Google Docs can all open it. Because no external docx library is used, advanced formatting (tables, complex styles, headers/footers) is limited — focus is on text, headings, and page breaks.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) Heading detector via font size. (3) Four output formats (DOCX, HTML, Markdown, text). (4) Minimal DOCX XML generator (valid OOXML). (5) HTML/Markdown/text generators. (6) Page-break inserter. (7) Paragraph detector (line-spacing analysis). (8) Font-size analyzer (finds body + heading sizes). (9) Text-structure analyzer (paragraphs/sentences/words). (10) Pure-JS ZIP file builder (CRC-32 + store mode). (11) Copy + download (multi-format). (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (pages/paragraphs/headings/words). (15) Document-structure analyzer. (16) Heading-level classifier (H1/H2/H3). (17) Bold/italic style detection (basic). (18) Basic table detector.",
      },
      {
        q: "Why is the formatting of the converted Word file simple?",
        a: "This tool ships zero heavy dependencies (no Mammoth, no docx-libs) — it builds OOXML XML by hand from the PDF's text layer and font-size metadata. Things like embedded images, complex tables, custom fonts, and colors are not preserved. For text-focused PDFs (reports, contracts, articles) the output is clean and editable; for design-heavy PDFs, expect plain structured text.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, structure analysis, DOCX/HTML/MD generation, and ZIP packaging happen locally in your browser. No file is ever uploaded. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
