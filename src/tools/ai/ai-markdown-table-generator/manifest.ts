import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-markdown-table-generator",
  name: "AI Markdown Table Generator — CSV/TSV/JSON to GFM Tables",
  description:
    "Build GitHub-flavored Markdown tables from CSV, TSV, JSON, pasted spreadsheet data, or a manual grid. Alignment control (left/center/right), compact vs pretty mode, header detection, cell escaping, multi-row support, sort/transpose/dedupe, case transforms, line-break handling, HTML/CSV/JSON export, and round-trip import of existing Markdown tables. Pure-JS converter — optional BYO-key LLM polish. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "markdown table generator", "csv to markdown", "tsv to markdown",
    "json to markdown table", "gfm table", "github markdown table",
    "tablesgenerator alternative", "tableconvert alternative",
    "markdown table maker", "spreadsheet to markdown",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "AI Markdown Table Generator — CSV/TSV/JSON to GFM, Private | UnQTools",
    faq: [
      {
        q: "How does the Markdown Table Generator work?",
        a: "Paste CSV, TSV, JSON, spreadsheet cells (tab-separated), or a Markdown table to import. The parser auto-detects the delimiter, treats the first row as headers by default, and renders a clean GitHub-flavored Markdown (GFM) table. You choose per-column alignment (left/center/right), compact or pretty padding, header bolding, line-break handling (newlines become <br>), and apply transforms (sort ascending/descending, transpose, dedupe rows, UPPERCASE/lowercase/Title Case). Copy the Markdown, download .md, or export as HTML/CSV/JSON. Round-trip an existing Markdown table back to editable form for tweak-and-repaste workflows.",
      },
      {
        q: "What input formats and alignments are supported?",
        a: "Inputs: CSV (comma, with quoted-field handling), TSV (tab), JSON (array of objects or array of arrays), pasted spreadsheet cells (tab + newline), and existing GFM Markdown tables. Alignments: left (:-), center (:-:), right (-:), and default (no marker). Output modes: compact (minimal padding) and pretty (padded to the widest cell in each column). Header row is required for GFM and is auto-detected from the first non-empty row unless you toggle it off.",
      },
      {
        q: "How are pipes, newlines, and special characters handled in cells?",
        a: "Pipes (|) inside cells are auto-escaped as \\| so they render as literal pipes. Newlines inside a cell are converted to <br> tags (GFM convention) so multi-line cells render correctly. Backslashes are preserved. HTML entities in the source are left intact. Empty cells render as spaces and padding is preserved. The escape function is exposed so you can unit-test it.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format import — CSV/TSV/JSON/spreadsheet paste/Markdown round-trip. (2) Per-column alignment (left/center/right/default). (3) Compact vs pretty padding modes. (4) Header detection + bold toggle. (5) Sort ascending/descending by column. (6) Transpose rows↔columns. (7) Dedupe rows. (8) Case transforms (upper/lower/title). (9) Line-break handling (<br>). (10) Pipe auto-escape. (11) HTML/CSV/JSON export. (12) Number formatting (decimal places). (13) Save tables locally (last 20). (14) Shareable URL with the input + settings encoded. (15) Copy / download .md. (16) Optional BYO-key LLM polish (OpenAI). (17) Honesty disclaimers (GFM is the default flavor; rendering varies slightly across Markdown flavors).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, alignment, transforms, and Markdown serialization run locally in your browser. Your spreadsheet data never leaves this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI.",
      },
    ],
  },
  status: "done",
};
