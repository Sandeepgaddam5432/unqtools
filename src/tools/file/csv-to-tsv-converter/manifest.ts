import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csv-to-tsv-converter",
  name: "CSV to TSV Converter",
  description:
    "Convert CSV (comma-separated) to TSV (tab-separated) with RFC 4180 compliant parsing and proper quote handling. Custom input/output delimiters, batch convert multiple files, trim whitespace, remove empty rows, skip header, and preview. 100% client-side.",
  category: "file",
  keywords: [
    "csv to tsv", "csv converter", "tsv converter", "comma to tab",
    "csv parse", "tsv export", "delimiter conversion", "csv to tab",
    "rfc 4180", "csv to tsv converter",
  ],
  icon: "arrow-right-left",
  requiresNetwork: false,
  seo: {
    title: "CSV to TSV Converter — RFC 4180 Compliant | UnQTools",
    faq: [
      { q: "What does the CSV to TSV Converter do?", a: "It parses a CSV file (RFC 4180 compliant — handles quoted fields, escaped quotes, embedded newlines) and re-emits it with a tab delimiter instead of a comma. You can also pick a custom input delimiter (semicolon, pipe, etc.) and a custom output delimiter (not just tab)." },
      { q: "Is the parsing RFC 4180 compliant?", a: "Yes. We correctly handle quoted fields containing delimiters, escaped double-quotes (\"\" → \"), and embedded newlines inside quoted fields. Field extraction is quote-aware — no naive split on delimiter." },
      { q: "Can I batch convert multiple files?", a: "Yes. Drop multiple CSV files at once and each is converted to TSV. You can copy or download each output individually or download all as a ZIP." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop input. (2) Batch convert multiple files. (3) Stats (rows, columns, input/output size). (4) Encoding detection (BOM sniffing for UTF-8 / UTF-16). (5) Trim whitespace on every field. (6) Remove empty rows. (7) Skip header option. (8) Custom output delimiter (tab, comma, semicolon, pipe, or custom char). (9) History (localStorage — last 10 conversions). (10) Shareable URL with conversion settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All parsing and conversion happen in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but very large files (> 100MB) may slow the browser. We use efficient array operations." },
    ],
  },
  status: "done",
};
