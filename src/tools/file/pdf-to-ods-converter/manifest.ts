import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-ods-converter",
  name: "PDF to ODS Converter",
  description:
    "Convert PDF text to ODS (OpenDocument Spreadsheet) in your browser. Extracts text from each PDF page, splits each line into cells by delimiter, and generates a valid ODS ZIP (mimetype, META-INF/manifest.xml, content.xml, styles.xml, meta.xml). Opens in LibreOffice Calc, OpenOffice Calc, Google Sheets.",
  category: "file",
  keywords: [
    "pdf to ods", "convert pdf to ods", "pdf to opendocument spreadsheet",
    "pdf to libreoffice calc", "pdf to openoffice calc",
    "pdf to spreadsheet", "pdf to ods converter", "pdf to ods online",
    "pdf to ods free", "extract text from pdf to spreadsheet",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "PDF to ODS Converter — Convert PDF to OpenDocument Spreadsheet in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, splits each text line into cells using your chosen delimiter (tab, comma, semicolon, pipe, or one cell per line), and generates a valid ODS (OpenDocument Spreadsheet) file — a ZIP containing mimetype, META-INF/manifest.xml, content.xml, styles.xml, and meta.xml. The result opens in LibreOffice Calc, OpenOffice Calc, and Google Sheets." },
      { q: "How are PDF pages mapped to sheets?", a: "Two modes: (1) 'single-sheet' — all PDF pages are merged into one sheet (default). (2) 'multi-sheet' — each PDF page becomes its own sheet (named 'Page 1', 'Page 2', etc.). You can also choose to make the first row of each sheet a header row (bold + frozen)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Five delimiter choices (tab, comma, semicolon, pipe, one-cell-per-line). (4) Two sheet modes (single vs multi-sheet). (5) Custom sheet name. (6) Header row toggle (bold + frozen first row). (7) Stats — row count, column count, sheet count. (8) Live preview of the first sheet's rows. (9) Conversion history in localStorage (last 10). (10) Shareable URL with conversion options." },
      { q: "What PDF features are supported?", a: "We extract text from PDF content streams. We don't extract tables-as-tables — PDF doesn't have a table concept. We split each text line into cells by your chosen delimiter. If the PDF has actual tables rendered with lines/borders, our text extraction preserves the row/line structure, but you may need to choose a delimiter that matches the column separator (often tab or multiple spaces)." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and ODS generation happens in your browser. File contents never leave your device." },
      { q: "Why use ODS instead of XLSX?", a: "ODS is an open ISO standard (ISO/IEC 26300). It's preferred by governments and organizations that require open formats. ODS files are typically smaller than equivalent XLSX files (less XML overhead), and they render more consistently across LibreOffice / OpenOffice / Google Sheets. Use XLSX if you need maximum Microsoft Excel compatibility." },
    ],
  },
  status: "done",
};
