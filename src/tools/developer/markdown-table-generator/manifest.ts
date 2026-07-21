/**
 * Markdown Table Generator — Tool Manifest.
 * Tool #342 — Category 4 (Developer & Code).
 *
 * A visual, spreadsheet-like grid that outputs valid GFM Markdown tables, with
 * paste-from-CSV/Excel import, per-column alignment (L/C/R), header-row
 * toggle, transpose/sort/dedupe, compact vs padded output, multi-format
 * export (Markdown, HTML, CSV, JSON, Jira), and pipe/newline escaping. 100%
 * client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-table-generator",
  name: "Markdown Table Generator",
  description:
    "Build a markdown table visually — add/remove rows & columns, edit cells, set per-column alignment (L/C/R), toggle the header row, then export valid GFM. Import from CSV/TSV or paste an existing markdown table to round-trip edit it. Also export HTML, CSV, JSON, or Jira. Pipes and newlines in cells are escaped automatically. 100% client-side.",
  category: "developer",
  keywords: [
    "markdown table generator", "markdown table maker", "github table",
    "gfm table", "csv to markdown table", "excel to markdown",
    "table to markdown", "jira table to markdown", "table editor",
    "alignment markdown table", "pipe escape markdown",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "Markdown Table Generator — Visual Grid, CSV Import, GFM Export | UnQTools",
    faq: [
      {
        q: "How do I create a markdown table?",
        a: "Click + Row and + Column to size your grid, type into each cell, choose an alignment (left/center/right) per column, and the GFM markdown is generated live in the output panel. Toggle the header row off to emit a header-less table (a blank first row is still emitted so GitHub parses it as a table).",
      },
      {
        q: "How does CSV / Excel paste import work?",
        a: "Paste CSV or TSV into the import box and click Import. The parser handles quoted fields with embedded commas, newlines, and doubled quotes (RFC 4180). When pasting from Excel or Google Sheets, cells are usually tab-separated (TSV) — the importer auto-detects tabs vs commas. The first row becomes the table header.",
      },
      {
        q: "What happens to pipes (|) and newlines inside cells?",
        a: "Pipes are escaped as \\| (a literal backslash-pipe) so they don't break the table structure. Multi-line cell content is converted to <br> tags in the markdown output, which GitHub renders as a line break inside the cell. Leading and trailing whitespace is trimmed per cell.",
      },
      {
        q: "Can I re-edit an existing markdown table?",
        a: "Yes. Paste your existing markdown table into the import box (it must contain a header row and a separator row like | --- |) and click Import. The tool parses it back into the visual grid with the original alignments preserved, so you can edit and re-export.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Visual grid editor with add/remove row & column. (2) Per-column alignment (L/C/R). (3) Header-row toggle. (4) Live GFM output with compact or padded formatting. (5) CSV/TSV import (RFC 4180, quoted fields, embedded commas/newlines). (6) Round-trip markdown-table import. (7) Transpose rows ↔ columns. (8) Sort rows by any column (asc/desc). (9) Dedupe rows. (10) Bold first/last row helper. (11) Multi-format export: Markdown, HTML, CSV, JSON, Jira. (12) Automatic pipe & newline escaping. (13) History (localStorage, last 20). (14) Shareable URL with the table encoded. 100% client-side — your data never leaves the browser.",
      },
    ],
  },
  status: "done",
};
