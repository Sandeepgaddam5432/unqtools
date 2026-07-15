import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "json-to-excel-converter",
  name: "JSON to Excel Converter",
  description:
    "Convert JSON data to XLSX format — supports flat JSON, nested objects (dot-notation flattening), and JSONL (JSON Lines). Auto-detects columns from the first object, infers cell types (string, number, boolean, date), and generates XLSX with typed cells. Batch convert multiple JSON files into a multi-sheet workbook. 100% client-side.",
  category: "file",
  keywords: [
    "json to excel", "json to xlsx", "convert json", "excel from json",
    "json to spreadsheet", "jsonl to xlsx", "json lines to excel",
    "flatten json", "nested json to excel", "json-to-excel-converter",
  ],
  icon: "file-spreadsheet",
  requiresNetwork: false,
  seo: {
    title: "JSON to Excel Converter — Flatten JSON to XLSX | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It converts JSON data into XLSX (Microsoft Excel Open XML) spreadsheets. It supports three input shapes: (1) a JSON array of objects — each object becomes a row, (2) a single JSON object — converted to a 2-row sheet (key + value), (3) JSONL (JSON Lines) — one JSON object per line, each becomes a row. Nested objects are flattened using dot notation (e.g. {address: {city: 'NYC'}} → 'address.city' = 'NYC')." },
      { q: "How are columns detected?", a: "By default, we scan the first object and use its keys (after flattening) as column headers. You can change the detection mode: 'first' (first object's keys), 'union' (all unique keys across all objects), or 'intersection' (only keys present in every object). For sparse data, 'union' captures all fields but may produce many empty cells." },
      { q: "How are cell types inferred?", a: "For each cell value: (1) booleans → 'boolean' cell, (2) numbers (int or float, not NaN) → 'number', (3) ISO date strings (YYYY-MM-DD or full ISO datetime) → 'date' (converted to Excel serial), (4) null/undefined → empty cell, (5) everything else → shared string. You can force all cells to text with the 'Force text cells' toggle." },
      { q: "Can I batch convert multiple JSON files?", a: "Yes. Drag-drop multiple .json / .jsonl files and they become multiple sheets in one workbook. Each file's name (without extension) becomes the sheet name. You can also rename sheets before conversion." },
      { q: "What's the maximum JSON size?", a: "There's no hard limit, but very large files (>50MB) will use lots of memory because we parse the whole JSON at once. For most use cases (under 100K rows) conversion takes under a second. We use shared-strings deduplication to keep XLSX size reasonable for text-heavy data." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop multiple JSON/JSONL files. (2) Batch convert — multiple JSONs into one multi-sheet XLSX. (3) Custom sheet name per file. (4) Flatten depth control — limit how deep nesting is flattened (default unlimited). (5) Column selection — pick detection mode (first/union/intersection). (6) Stats — rows, columns, sheet count, file size. (7) Preview first 10 rows per sheet. (8) Header row styling (bold + light fill). (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my JSON uploaded anywhere?", a: "No. All parsing and XLSX generation runs in your browser. The JSON contents never leave your device. Only conversion summaries (filename, row count, sheet count) are saved to local history." },
      { q: "How does it handle JSONL (JSON Lines)?", a: "JSONL is one JSON object per line — common for log files and streaming data. We split the input by newlines (skipping blank lines), parse each line as a JSON object, and treat the result as a row array. The first object's keys become column headers. If any line fails to parse, we skip it and report the error count." },
    ],
  },
  status: "done",
};
