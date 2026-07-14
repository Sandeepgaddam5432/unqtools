import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csv-file-splitter",
  name: "CSV File Splitter",
  description:
    "Split a large CSV file into smaller files by row count, file size (MB), column value (group-by), or a fixed number of output files. Header preservation, custom filename templates, dedup, column selection, ZIP export. 100% client-side.",
  category: "file",
  keywords: [
    "csv split", "csv splitter", "csv chunker", "split csv", "divide csv",
    "csv by row count", "csv by size", "csv group by", "csv batch",
    "csv zip", "csv export", "csv file splitter",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "CSV File Splitter — Split CSV by Rows, Size, or Column | UnQTools",
    faq: [
      { q: "What does the CSV File Splitter do?", a: "It splits one large CSV into many smaller CSVs. You can split by row count (e.g. 1000 rows per file), by target file size (e.g. 1MB per file), by column value (each unique value becomes its own file), or by number of output files (split into N roughly equal parts)." },
      { q: "How is the header handled?", a: "By default, the first row (header) is preserved at the top of every split file. You can turn this off if your CSV has no header row." },
      { q: "How do I name the output files?", a: "Use the filename template with placeholders: {base} (original filename without extension), {index} (zero-padded split number), {total} (total split count), {group} (column value when grouping), and {date} (current date). Example: '{base}_part{index}_of_{total}.csv' → 'sales_part01_of_05.csv'." },
      { q: "Can I download all splits as one ZIP?", a: "Yes. Click 'Download as ZIP' to get a single .zip containing every split. Or download individual files one at a time." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop input. (2) Preview first N rows of each split. (3) Live stats (total rows, estimated split count, per-split row counts). (4) Custom delimiter (comma, tab, semicolon, pipe, or custom char). (5) Encoding detection (BOM sniffing). (6) Progress bar during split. (7) Split by number of output files (divide into N equal parts). (8) Column selection (keep or drop columns before splitting). (9) Dedup rows inside each split. (10) History (localStorage — last 10 split configs)." },
      { q: "Is my CSV uploaded anywhere?", a: "No. All parsing, splitting, and ZIP packaging happen in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum CSV size?", a: "There's no hard limit, but very large files (> 100MB) may slow the browser. We use efficient array operations and show a progress bar." },
    ],
  },
  status: "done",
};
