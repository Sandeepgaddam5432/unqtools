import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csv-to-excel-converter",
  name: "CSV to Excel Converter",
  description:
    "Convert CSV files to XLSX with typed cells (text, number, date, boolean) — pure JS, no SheetJS. Batch convert multiple CSVs into one multi-sheet workbook. Auto-fit column widths, header styling, custom delimiters. 100% client-side.",
  category: "file",
  keywords: [
    "csv to excel", "csv to xlsx", "convert csv", "excel converter",
    "xlsx generator", "spreadsheet maker", "csv spreadsheet", "open xml",
    "office open xml", "csv-to-excel-converter",
  ],
  icon: "file-spreadsheet",
  requiresNetwork: false,
  seo: {
    title: "CSV to Excel Converter — Pure JS XLSX Writer | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts CSV (comma-separated values) files into XLSX (Microsoft Excel Open XML) spreadsheets. Each CSV becomes one sheet in the workbook. Cells are auto-typed as numbers, dates, booleans, or text. The output opens in Excel, LibreOffice, Google Sheets, and Numbers." },
      { q: "Does it use SheetJS or any external library?", a: "No. We wrote a minimal pure-JS XLSX writer that emits the Office Open XML format directly — XML files for sheets, shared strings, and workbook structure, packaged in a ZIP (STORE method, no compression). The entire writer is ~300 lines and ships in the tool's bundle, no third-party dependency." },
      { q: "How are cell types detected?", a: "For each cell value we try: (1) boolean (true/false/yes/no), (2) integer / decimal / scientific notation, (3) ISO date (YYYY-MM-DD), (4) date with slashes, (5) time, (6) anything else becomes text. The first match wins. You can also force all cells to text with a toggle." },
      { q: "What's the maximum CSV size?", a: "There's no hard limit, but very large CSVs (1M+ rows) will use lots of memory since we parse the whole file. For most use cases (under 100K rows) conversion takes under a second. We use shared strings deduplication to keep XLSX size reasonable for text-heavy data." },
      { q: "Can I convert multiple CSVs at once?", a: "Yes. Drag-drop multiple CSV files and they become multiple sheets in one workbook. Each CSV's filename (without extension) becomes the sheet name. You can also rename sheets before conversion." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop multiple CSVs. (2) Batch convert — multiple CSVs into one multi-sheet XLSX. (3) Custom sheet names per CSV. (4) Header row styling (bold + light fill). (5) Auto-fit column widths based on content. (6) Stats panel — rows, columns, file size, sheet count. (7) Preview first 10 rows of each CSV before converting. (8) Custom delimiter (comma, tab, semicolon, pipe, auto-detect). (9) Encoding detection (UTF-8 BOM handling). (10) History of recent conversions (localStorage)." },
      { q: "Is my CSV uploaded anywhere?", a: "No. All parsing and XLSX generation runs in your browser. The CSV contents never leave your device. Only conversion summaries (filename, row count) are saved to local history — never the actual data." },
      { q: "Why is the output XLSX larger than my CSV?", a: "XLSX is a ZIP containing XML — for small datasets the XML overhead exceeds the compression savings. For large text-heavy datasets, our shared-strings deduplication usually makes XLSX smaller than CSV. For pure-number data, CSV is almost always smaller." },
    ],
  },
  status: "done",
};
