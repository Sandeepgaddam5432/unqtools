import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-powerpoint-converter",
  name: "PDF to PowerPoint Converter",
  description:
    "Convert PDF pages into presentation slides — one slide per page — and export as a minimal valid .pptx (OOXML ZIP), a navigable HTML slide deck, or Marp-compatible Markdown. Choose from 4 slide layouts, preserve PDF aspect ratio, extract speaker notes from page text, and auto-generate slide titles from headings. Includes a pure-JS ZIP builder, copy + download, history, and shareable URL. 100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "pdf to powerpoint",
    "pdf to pptx",
    "pdf to slides",
    "pdf presentation",
    "pdf to ppt",
    "convert pdf to powerpoint",
    "pdf slide maker",
    "pdf to html slides",
    "pdf to marp",
    "pdf to markdown slides",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "PDF to PowerPoint Converter — PPTX / HTML / Markdown Slides | UnQTools",
    faq: [
      {
        q: "How does the PDF to PowerPoint converter work?",
        a: "It parses each PDF page's content stream, extracts the text layer, detects headings via font-size analysis, and packages everything as one slide per page. The .pptx output is a minimal OOXML package (a ZIP of XML parts) built in-browser — no external libraries. HTML and Marp Markdown decks are also available for web-only or text-only workflows.",
      },
      {
        q: "Is the generated .pptx a real PowerPoint file?",
        a: "Yes — it's a minimal OOXML package containing [Content_Types].xml, _rels/.rels, presentation.xml, and one slideN.xml per page, packaged as a ZIP with proper CRC-32 checksums. PowerPoint, Keynote, LibreOffice Impress, and Google Slides can all open it. Because no external library is used, advanced effects (transitions, animations, embedded media) are not generated — focus is on text content, titles, and speaker notes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) Four slide layouts (full-page, title-content, two-content, blank). (3) Content extractor (text + headings per page). (4) Slide-title generator (first heading or 'Page N'). (5) Slide-content formatter (bullets from paragraphs). (6) Speaker-notes extractor (all non-heading text). (7) Aspect-ratio calculator (PDF page → PPT slide dimensions in EMU). (8) Minimal PPTX XML generator (valid OOXML). (9) Pure-JS ZIP builder (CRC-32 + store mode). (10) HTML slides generator with prev/next navigation. (11) Marp-compatible Markdown slides generator. (12) Copy + download (PPTX/HTML/MD). (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (total slides, total text, by layout). (16) Slide-count calculator. (17) Title-extraction quality scorer. (18) Speaker-notes length validator.",
      },
      {
        q: "Why is the formatting of the converted PowerPoint simple?",
        a: "This tool ships zero heavy dependencies (no python-pptx, no officegen) — it builds the PPTX XML by hand from the PDF's text layer and font-size metadata. Things like embedded images, complex tables, custom fonts, and colors are not preserved. For text-focused PDFs (reports, contracts, articles) the output is clean and editable; for design-heavy PDFs, expect plain structured slides.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, slide generation, OOXML packaging, and ZIP building happen 100% locally in your browser. No file is ever uploaded. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
