/**
 * SQL Result to CSV/JSON Exporter — Tool Manifest.
 * Tool #275 — Category 4 (Developer & Code).
 *
 * Parses pasted SQL result grids (tab / pipe / comma / whitespace aligned),
 * INSERT statements (single + multi-row), and Markdown tables — then exports
 * to CSV, JSON (array-of-objects), NDJSON, TSV, Markdown, or HTML table — with
 * type inference (int/decimal/boolean/date/NULL), BigInt-safe numerics,
 * per-column rename/reorder/select, configurable CSV quoting + delimiter, and
 * round-trip with #274 (CSV→SQL). 100% client-side, no upload.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-result-to-csv-json-exporter",
  name: "SQL Result to CSV / JSON Exporter",
  description:
    "Convert SQL query results (pasted result grids, INSERT statements, or Markdown tables) to CSV, JSON, NDJSON, TSV, Markdown, or HTML. Smart type inference (int/decimal/boolean/date/NULL), BigInt-safe numerics, escaped quotes, per-column rename/reorder/select, configurable CSV delimiter + quoting. Round-trips with CSV→SQL. 100% client-side.",
  category: "developer",
  keywords: [
    "sql to csv", "sql to json", "sql result to csv",
    "sql result to json", "convert sql to csv", "convert insert to csv",
    "insert statements to csv", "sql to ndjson", "sql to markdown",
    "sql to html table", "sql result export", "sql grid to csv",
  ],
  icon: "file-output",
  requiresNetwork: false,
  seo: {
    title: "SQL Result to CSV / JSON Exporter — Type-Safe Multi-Format | UnQTools",
    faq: [
      {
        q: "What input formats does the SQL Result Exporter accept?",
        a: "Three: (1) pasted result grids (tab-separated from DBeaver/psql, pipe-separated like MySQL CLI, comma-separated, or whitespace-aligned); (2) INSERT statements — single-row ('INSERT INTO t (a,b) VALUES (1,2)') or multi-row ('VALUES (1,2),(3,4)'); and (3) Markdown tables. The input format is auto-detected, with a manual override.",
      },
      {
        q: "How does the tool preserve data types?",
        a: "For each column we sample every non-NULL value and check whether it consistently looks like an integer (including BigInt-safe integers up to 2^53), a decimal, a boolean (true/false/0/1), a date (YYYY-MM-DD or ISO datetime), or NULL. Otherwise we treat it as text. Inferred types drive the JSON output: numbers stay numbers, booleans stay booleans, NULLs become null, dates can be reformatted, and strings stay strings.",
      },
      {
        q: "How are NULL vs 'NULL' string handled?",
        a: "The literal token 'NULL' (case-insensitive, unquoted) is interpreted as a true NULL — emitted as null in JSON, empty in CSV (configurable), and \\N in TSV by default. The quoted token 'NULL' (i.e. 'NULL' wrapped in single quotes inside an INSERT) is treated as the literal string 'NULL'. You can configure the NULL token (e.g. '\\\\N' for PostgreSQL COPY) and toggle whether empty cells become NULL or empty strings.",
      },
      {
        q: "What output formats are supported?",
        a: "Six: CSV (RFC 4180 with configurable delimiter and quoting), JSON (array of objects — types preserved), NDJSON (one JSON object per line), TSV (tab-separated), Markdown table, and HTML table. All formats round-trip cleanly downstream and respect per-column rename/reorder/select.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Multi-format input — grids, INSERTs, Markdown. (2) Six output formats — CSV/JSON/NDJSON/TSV/Markdown/HTML. (3) Smart per-column type inference with BigInt safety. (4) NULL vs 'NULL'-string disambiguation. (5) Per-column rename / reorder / select. (6) Configurable CSV delimiter (comma/semicolon/tab/pipe) and quoting (always/never/auto). (7) Optional date reformatting. (8) RFC 4180-correct CSV with embedded-quote/comma/newline escaping. (9) Round-trip with #274 (CSV→SQL). (10) Live preview grid with type badges. (11) localStorage history (max 20). (12) Shareable URL config. (13) Copy / download. 100% offline — no upload.",
      },
    ],
  },
  status: "done",
};
