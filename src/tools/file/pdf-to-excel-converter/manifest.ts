import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-excel-converter",
  name: "PDF to Excel Converter",
  description:
    "Convert PDF files to XLSX (Microsoft Excel) in the browser — pure JavaScript PDF text extractor + SpreadsheetML generator. Extracts text lines from each page, treats each line as a row, splits by delimiter, and packages as an .xlsx ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "pdf to excel", "pdf to xlsx", "convert pdf to excel",
    "pdf data extractor", "pdf table extractor", "pdf spreadsheet",
    "pdf-to-excel-converter", "pdf xlsx", "pdf to office",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF to Excel Converter — Convert PDF to XLSX in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts PDF files to XLSX (Microsoft Excel 2007+) entirely in your browser. We load the PDF using pdf-lib, extract text from each page's content stream, split each line by a delimiter (comma, tab, semicolon, pipe, or custom), and generate a SpreadsheetML .xlsx ZIP. No external API, no upload — everything runs in JavaScript." },
      { q: "Will the XLSX look like the PDF tables?", a: "Only if the PDF has clear text-based tables with consistent delimiters. PDF is a fixed-layout format — text is positioned with absolute x/y coordinates, not in tabular form. We extract the visible text and split by your chosen delimiter. For PDFs with complex tables (merged cells, multi-line rows), the result will be imperfect. For best results: (1) ensure your PDF has text-based content (not scanned images), (2) choose a delimiter that matches your data, (3) consider using Tabula (desktop Java app) for complex tables." },
      { q: "What PDF features are supported?", a: "We support: text in standard content streams (Tj/TJ/'/\" operators), text in compressed streams (FlateDecode decompressed via DecompressionStream), multiple pages (each page becomes a separate sheet by default, or all rows go into one sheet), page ranges, custom delimiters (comma, tab, semicolon, pipe, or custom string), custom sheet name, and basic cell type detection (numbers vs text). We do NOT support: scanned PDFs (need OCR), encrypted/password-protected PDFs, embedded images, charts, form fields, and merged cells." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector. (3) Custom delimiter (5 presets + custom). (4) Stats — page count, row count, column count, cell count. (5) Live preview of extracted rows. (6) Custom sheet name. (7) One sheet per page or all rows in one sheet. (8) Auto-detect cell types (numbers vs text). (9) History of recently converted PDFs (localStorage — last 10). (10) Shareable URL with conversion options." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and XLSX generation runs in your browser using pure JavaScript. File contents never leave your device. Only conversion summaries (filename + row count) are saved to local history." },
      { q: "Will Microsoft Excel open the generated .xlsx?", a: "Yes — we generate a standards-compliant SpreadsheetML package: [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels, xl/worksheets/sheet1.xml, xl/sharedStrings.xml, and xl/styles.xml. Excel, LibreOffice Calc, Google Sheets, and Apple Numbers all open the file without warnings. Numbers and dates are auto-detected and formatted appropriately." },
    ],
  },
  status: "done",
};
