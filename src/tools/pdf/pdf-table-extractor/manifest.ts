import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-table-extractor",
  name: "PDF Table Extractor",
  description:
    "Detect and extract tables from PDF pages — auto-detect, by grid lines, by text alignment, or by user rules. 5 output formats (CSV / Excel XLSX / HTML table / JSON / Markdown table), header detection, merged-cell detection, cell-type detection (number / date / text / currency), confidence scorer (0-1), table boundary calculator, column/row width+height calculators, multi-table extractor, table quality scorer, page-range parser, history (localStorage, last 20), shareable URL. 100% client-side — your PDF never leaves your device.",
  category: "pdf",
  keywords: [
    "pdf table extractor", "extract tables pdf", "pdf to csv",
    "pdf to excel", "pdf to xlsx", "table detection",
    "pdf table", "extract data pdf", "pdf to markdown table",
    "pdf to json", "pdf to html table", "pdf grid detect",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "PDF Table Extractor — Extract Tables to CSV / XLSX / Markdown Free | UnQTools",
    faq: [
      {
        q: "How does the PDF Table Extractor work?",
        a: "Load a PDF, choose a detection method (auto-detect, by grid lines, by text alignment, or by user rules), pick an output format (CSV, Excel XLSX, HTML, JSON, or Markdown), and click Extract. The tool parses each page's content stream, clusters text items into rows and columns, detects headers and merged cells, scores confidence, and renders the result — all in your browser via pdf-lib, no server.",
      },
      {
        q: "What detection method should I use?",
        a: "Start with 'auto-detect' — it adapts tolerance to the page. If the PDF has visible ruled tables (with horizontal/vertical lines), 'by-grid-lines' aligns cells to the rule lines. For un-ruled tables where columns are aligned by whitespace, 'by-text-alignment' clusters items by x-coordinate. 'by-rules' lets you specify exact column-x boundaries and row-y tolerances via a simple JSON / CSV rule syntax.",
      },
      {
        q: "Does it handle multi-page tables and tables spanning multiple pages?",
        a: "Each table is detected per page. Tables on consecutive pages are extracted as separate tables (with a page label). Use the page-range field to limit extraction. If a single table spans two pages, the tool produces two tables — you can merge them downstream in your spreadsheet.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) 4 detection methods (auto / grid-lines / text-alignment / rules). (3) Grid-line detector. (4) Text clusterer (rows by y, columns by x). (5) Cell extractor. (6) Header detector. (7) Merged-cell detector. (8) Confidence scorer (0-1). (9) Table boundary calculator. (10) Column/row width + height calculators. (11) 5 output renderers (CSV / XLSX / HTML / JSON / Markdown). (12) Minimal OOXML XLSX generator. (13) Pure-JS ZIP builder (store mode + CRC-32). (14) History (localStorage, last 20). (15) Shareable URL. (16) Summary stats. (17) Multi-table extractor. (18) Table quality scorer. (19) Cell-type detector (number / date / text / currency).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All PDF parsing, table detection, and output rendering run entirely in your browser via pdf-lib. The .xlsx is a minimal SpreadsheetML package built in-browser (no external libraries). History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
