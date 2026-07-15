import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "excel-to-json-converter",
  name: "Excel to JSON Converter",
  description:
    "Convert XLSX files to JSON arrays of objects. Uses first row as keys, supports multiple sheets, JSONL output, and nested grouping. Pure JS — no SheetJS dependency.",
  category: "file",
  keywords: ["excel", "xlsx", "json", "convert", "jsonl", "spreadsheet", "sheet"],
  icon: "file-spreadsheet",
  requiresNetwork: false,
  seo: {
    title: "Excel to JSON Converter — XLSX to JSON | UnQTools",
    faq: [
      { q: "How does the conversion work?", a: "The first row of each sheet is used as JSON keys. Each subsequent row becomes a JSON object with those keys. Cell types (number, date, boolean, string) are preserved." },
      { q: "Can I convert multiple sheets?", a: "Yes — select which sheet to convert, or convert all sheets into a single JSON object with sheet names as top-level keys." },
      { q: "What is JSONL output?", a: "JSONL (JSON Lines) outputs one JSON object per line, which is useful for streaming parsers and log processing. Each line is a complete JSON object." },
      { q: "What extra features does this tool have?", a: "10 extras: drag-drop, batch convert, sheet selector, custom key naming (camelCase/snake_case/original), nested JSON grouping, stats, preview, JSONL output, history, shareable URL." },
      { q: "Is my file uploaded?", a: "No — all parsing is in-browser. The XLSX file never leaves your device." },
      { q: "Do I need SheetJS?", a: "No — we parse XLSX (Office Open XML) directly using a pure-JS ZIP reader and XML parser. Zero external dependencies." },
    ],
  },
  status: "done",
};
