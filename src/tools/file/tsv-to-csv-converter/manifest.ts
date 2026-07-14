import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tsv-to-csv-converter",
  name: "TSV to CSV Converter",
  description:
    "Convert TSV (tab-separated) to CSV (comma-separated) with RFC 4180 compliant output and proper quoting. Custom input/output delimiters, batch convert multiple files, trim whitespace, remove empty rows, skip header, and preview. 100% client-side.",
  category: "file",
  keywords: [
    "tsv to csv", "tsv converter", "csv converter", "tab to comma",
    "tsv parse", "csv export", "delimiter conversion", "tsv to csv",
    "rfc 4180", "tsv to csv converter",
  ],
  icon: "arrow-left-right",
  requiresNetwork: false,
  seo: {
    title: "TSV to CSV Converter — RFC 4180 Compliant Output | UnQTools",
    faq: [
      { q: "What does the TSV to CSV Converter do?", a: "It parses a TSV file (tab-separated) and re-emits it as RFC 4180 compliant CSV — fields containing commas, quotes, or newlines are properly wrapped in double-quotes with embedded quotes escaped (\" → \"\"). You can also pick a custom input delimiter (semicolon, pipe, etc.) and a custom output delimiter." },
      { q: "Is the output RFC 4180 compliant?", a: "Yes. Any field that contains a comma, double-quote, carriage return, or line feed is wrapped in double-quotes. Embedded double-quotes are escaped by doubling them (\" → \"\"). This is the format expected by Excel, Google Sheets, and every CSV library." },
      { q: "Can I batch convert multiple files?", a: "Yes. Drop multiple TSV files at once and each is converted to CSV. You can copy or download each output individually or download all as a ZIP." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop input. (2) Batch convert multiple files. (3) Stats (rows, columns, input/output size). (4) Encoding detection (BOM sniffing for UTF-8 / UTF-16). (5) Trim whitespace on every field. (6) Remove empty rows. (7) Skip header option. (8) Custom output delimiter (comma, tab, semicolon, pipe, or custom char). (9) History (localStorage — last 10 conversions). (10) Shareable URL with conversion settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All parsing and conversion happen in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but very large files (> 100MB) may slow the browser. We use efficient array operations." },
    ],
  },
  status: "done",
};
