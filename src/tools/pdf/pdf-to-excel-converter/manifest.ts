import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-excel-converter",
  name: "PDF to Excel Converter",
  description:
    "Extract tables from PDF and convert to Excel (.xlsx), CSV, HTML, or JSON in your browser. Detects tables by clustering text on a y/x grid, handles multiple tables per page, detects headers, infers cell types (number/date/text/currency), and builds a minimal valid .xlsx (OOXML ZIP) entirely client-side. Includes history, shareable URL, summary stats, and table quality scoring. 100% private — no uploads.",
  category: "pdf",
  keywords: [
    "pdf to excel",
    "pdf to xlsx",
    "pdf table extractor",
    "extract pdf table",
    "pdf to csv",
    "pdf to html table",
    "pdf to json",
    "convert pdf table",
    "spreadsheet from pdf",
    "pdf data extractor",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "PDF to Excel Converter — XLSX / CSV / HTML / JSON | UnQTools",
    faq: [
      {
        q: "How does the PDF to Excel converter work?",
        a: "It parses each PDF page's content stream, extracts text fragments along with their x/y positions, clusters them into rows by y-coordinate, then into columns by x-coordinate gaps. The resulting grid is rendered as CSV, HTML, JSON, or packaged as a minimal valid .xlsx (a ZIP of OOXML XML files). All in your browser — no server-side processing.",
      },
      {
        q: "Is the generated .xlsx a real Excel file?",
        a: "Yes — it's a minimal OOXML package containing [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/worksheets/sheet1.xml, and xl/sharedStrings.xml, packaged as a ZIP with proper CRC-32 checksums. Excel, LibreOffice, Numbers, and Google Sheets can all open it. Because no external xlsx library is used, advanced features (formulas, charts, styling beyond headers/bold) are limited — focus is on clean tabular data.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) Three table-detection methods (auto-detect, by-position, by-text-grid). (3) Table detector that clusters text by y-coordinate for rows and x-coordinate for columns. (4) Row/column builder. (5) Header detector (first row / bold / repeated pattern). (6) Four output formats (XLSX, CSV, HTML, JSON). (7) Minimal XLSX XML generator (valid OOXML with shared strings). (8) Pure-JS ZIP file builder (CRC-32 + store mode). (9) CSV/HTML/JSON generators. (10) Copy + download (multi-format). (11) History (localStorage, last 20). (12) Shareable URL. (13) Summary stats (tables/cells/rows/columns). (14) Table quality scorer (0-100 based on grid alignment). (15) Multi-table extractor (multiple tables per page). (16) Cell type detector (number/date/text/currency). (17) Column-width auto-fit calculator. (18) Empty-cell handler.",
      },
      {
        q: "Why might the converted table look imperfect?",
        a: "PDFs don't store table structure — text is just positioned glyphs. This tool infers rows and columns from x/y coordinates, so borders, merged cells, multi-line cell text, and rotated headers can confuse detection. For best results: use PDFs with clear column gaps, single-line cells, and consistent row spacing. Scanned PDFs (images) won't work because they have no text layer — OCR them first.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, table detection, XLSX/CSV/HTML/JSON generation, and ZIP packaging happen locally in your browser. No file is ever uploaded. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
