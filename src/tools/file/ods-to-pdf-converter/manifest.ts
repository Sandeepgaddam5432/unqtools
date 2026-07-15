import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ods-to-pdf-converter",
  name: "ODS to PDF Converter",
  description:
    "Convert OpenDocument Spreadsheet (.ods) files to PDF in the browser — pure JavaScript ODS parser + pdf-lib renderer. Extracts tables and cells from content.xml, renders them as a formatted PDF table, and downloads a polished .pdf. 100% client-side.",
  category: "file",
  keywords: [
    "ods to pdf", "ods converter", "opendocument spreadsheet to pdf",
    "libreoffice calc to pdf", "openoffice calc to pdf", "ods viewer",
    "convert ods", "ods-to-pdf-converter", "ods pdf",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "ODS to PDF Converter — Convert .ods to PDF in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts OpenDocument Spreadsheet (.ods) files to PDF entirely in your browser. We unzip the .ods (which is a ZIP container), read content.xml, extract tables (table:table) and their rows/cells, then render each table to a PDF page using pdf-lib. No LibreOffice or OpenOffice is required. Output is a PDF with the spreadsheet data formatted as a table with column auto-sizing." },
      { q: "What ODS features are supported?", a: "We support: tables (table:table) with rows (table:table-row) and cells (table:table-cell), cell values (text and numbers), repeated cells (number-columns-repeated attribute), repeated rows (number-rows-repeated), multiple sheets per file, basic text formatting inherited from styles.xml (we don't apply inheritance — we render all cells in the same font), and column widths from table:table-column. Formulas, charts, images, conditional formatting, and merged cells are flattened to text. Empty cells are skipped (not rendered as blank)." },
      { q: "Does it work for password-protected .ods files?", a: "No. Encrypted .ods files use a Blowfish/AES wrapping that requires the user's password and a WASM crypto blob to decrypt. We surface a clear 'encrypted ODS — password required' error. Use LibreOffice on desktop to remove the encryption first." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Sheet selector (pick which sheet to render — defaults to all). (3) Cell formatting (auto-fit column widths, optional header row bold). (4) Stats — sheet count, row count, column count, cell count. (5) Live preview of extracted data as text. (6) Page orientation (portrait / landscape). (7) Custom margins. (8) History of recently converted .ods files (localStorage — last 10). (9) Shareable URL with conversion options. (10) Custom sheet name filter (regex)." },
      { q: "Is my .ods file uploaded anywhere?", a: "No. All ODS parsing and PDF rendering runs in your browser using pure JavaScript and pdf-lib. File contents never leave your device. Only conversion summaries (filename + row count) are saved to local history." },
      { q: "Why are very large spreadsheets cut off?", a: "We render each table on a single PDF page (portrait or landscape). If your sheet has more columns than fit on the page width, we truncate. For wide sheets, switch to landscape orientation, or split the sheet in LibreOffice first. We also cap the row count at 200 per sheet to keep rendering fast — beyond that, use LibreOffice's native PDF export." },
    ],
  },
  status: "done",
};
