import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "excel-to-csv-converter",
  name: "Excel to CSV Converter",
  description:
    "Convert XLSX files to CSV — pure-JS minimal XLSX parser (Office Open XML), no SheetJS dependency. Reads sharedStrings.xml, sheetN.xml, and styles.xml. Supports multiple sheets (select or convert all), cell types (string, number, date, boolean), and outputs CSV with proper RFC 4180 quoting. Download all sheets as a ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "excel to csv", "xlsx to csv", "convert xlsx", "excel converter",
    "xlsx parser", "open xml", "office open xml", "spreadsheet to csv",
    "xlsx reader", "excel-to-csv-converter",
  ],
  icon: "file-spreadsheet",
  requiresNetwork: false,
  seo: {
    title: "Excel to CSV Converter — Pure JS XLSX Parser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses XLSX (Microsoft Excel Open XML) files and converts each worksheet to CSV (RFC 4180). The parser reads the underlying ZIP container, then parses sharedStrings.xml (text cells), sheetN.xml (cell data), and styles.xml (number formats for dates). Cell types are preserved: strings, numbers, booleans, dates (formatted as ISO), and formulas (the cached value is read)." },
      { q: "Does it use SheetJS or any external library?", a: "No. We wrote a minimal pure-JS XLSX parser that reads the Office Open XML format directly. It parses the ZIP container, then walks the SpreadsheetML XML for shared strings and per-sheet cell data. The entire parser is ~400 lines and ships in the tool's bundle — no third-party dependency. ZIP entries using DEFLATE compression are decompressed via the browser's native DecompressionStream API." },
      { q: "How are dates handled?", a: "Excel stores dates as serial numbers (days since 1900-01-01, with the famous 1900-leap-year bug). We read the cell's style index, look up the number format in styles.xml, and if the format looks like a date (contains 'yyyy', 'mm', 'dd', 'hh', etc.), we convert the serial back to an ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)." },
      { q: "What about formulas?", a: "When a cell contains a formula, Excel stores both the formula and the last-calculated value. We read the cached value and output it as the cell content. The formula itself is not included in the CSV (CSV doesn't support formulas). If you need formulas, use a spreadsheet editor like Excel or LibreOffice." },
      { q: "Can I convert multiple sheets at once?", a: "Yes. The sheet selector lets you pick which sheet to convert (defaults to the first). Or click 'Convert all sheets' to download every sheet as a separate CSV file, bundled into a single ZIP. Each CSV is named '<workbook>_<sheet>.csv'." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Batch convert multiple XLSX files. (3) Sheet selector — pick which sheet to convert. (4) Stats — rows, columns, sheet count per file. (5) Preview first 10 rows before converting. (6) Custom CSV delimiter (comma, tab, semicolon, pipe). (7) Encoding detection (UTF-8 BOM). (8) Download all sheets as separate CSVs in ZIP. (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my XLSX uploaded anywhere?", a: "No. All parsing and CSV generation runs in your browser using pure JavaScript. The XLSX contents never leave your device. Only conversion summaries (filename, row count, sheet count) are saved to local history." },
      { q: "Why are some numbers shown in scientific notation?", a: "Excel stores numbers as IEEE 754 doubles and renders them per the cell's number format. We output the raw numeric value (which JavaScript may serialize in exponential notation for very large or very small numbers). If you need fixed-point formatting, you'll need to apply it after conversion." },
    ],
  },
  status: "done",
};
