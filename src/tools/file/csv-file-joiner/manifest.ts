import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csv-file-joiner",
  name: "CSV File Joiner",
  description:
    "Merge multiple CSV files into one with header-aware alignment, column matching, dedup, and export. Supports inner/outer join modes, custom delimiters, column reorder, row sorting, filtering, and preview. 100% client-side.",
  category: "file",
  keywords: [
    "csv merge", "csv join", "csv combine", "csv concat", "csv append",
    "header aware", "column alignment", "csv dedup", "csv sort",
    "csv filter", "csv export", "csv file joiner",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "CSV File Joiner — Merge Multiple CSVs with Header Alignment | UnQTools",
    faq: [
      { q: "What does the CSV File Joiner do?", a: "It merges multiple CSV files into one. Headers are aligned automatically — files with different column orders or extra/missing columns are joined correctly using column-name matching. You can append (stack rows) or join (inner/outer) by a key column." },
      { q: "What is the difference between append and join mode?", a: "Append mode stacks all rows from all files under a unified header (union of all columns; missing cells become empty). Join mode merges files side-by-side using a shared key column — inner join keeps only matching rows, outer join keeps all rows from every file." },
      { q: "How are duplicate headers handled?", a: "When appending, only the first file's header row is kept; subsequent files' header rows are automatically skipped so they don't appear as data. You can toggle this off if your files have no headers." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple files. (2) Column reorder (drag columns to reorder before export). (3) Dedup rows (by full row or by key column). (4) Sort by any column (asc/desc, numeric-aware). (5) Filter rows by column value / substring. (6) Per-file stats (row count, column count, size). (7) Preview first N rows of merged output. (8) Custom delimiter (comma, tab, semicolon, pipe, custom char). (9) Encoding detection (basic BOM sniffing). (10) History (localStorage — last 10 merge configs)." },
      { q: "Are my CSV files uploaded anywhere?", a: "No. All parsing and merging happens in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum CSV size?", a: "There's no hard limit, but very large files (> 100MB) may slow the browser. We use efficient array operations and show progress for merges." },
    ],
  },
  status: "done",
};
