/**
 * CSV to SQL INSERT Converter — Tool Manifest.
 * Tool #274 — Category 4 (Developer & Code).
 *
 * Converts CSV (or pasted tabular data) into SQL — CREATE TABLE (with
 * inferred types) plus INSERT statements — for the chosen dialect, with
 * delimiter auto-detection, NULL handling, batched multi-row inserts, and
 * UPSERT support. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csv-to-sql-insert-converter",
  name: "CSV to SQL INSERT Converter",
  description:
    "Convert CSV or TSV data into SQL INSERT statements with smart type inference (int/decimal/boolean/date/text), NULL vs empty-string handling, RFC 4180-correct parsing, batched multi-row inserts, optional CREATE TABLE, and UPSERT (ON CONFLICT / DUPLICATE KEY / MERGE). Multi-dialect (ANSI/MySQL/PostgreSQL/SQLite/T-SQL). 100% client-side.",
  category: "developer",
  keywords: [
    "csv to sql", "csv to insert", "csv to sql insert",
    "convert csv to sql", "csv to sql converter", "csv import sql",
    "tsv to sql", "csv to insert statements", "batch insert generator",
  ],
  icon: "file-code-2",
  requiresNetwork: false,
  seo: {
    title: "CSV to SQL INSERT Converter — Type Inference + Batched UPSERT | UnQTools",
    faq: [
      {
        q: "How does the CSV to SQL converter handle quoting?",
        a: "We use an RFC 4180-compliant parser that correctly handles fields wrapped in double quotes, embedded commas inside quoted fields, doubled-quote escapes (\"\"), and embedded newlines. A leading BOM is stripped automatically and CRLF, lone CR, and LF line endings are all accepted.",
      },
      {
        q: "How are column types inferred?",
        a: "For each column we sample every non-NULL value and check whether it consistently looks like an integer (no leading zeros), a decimal, a boolean (true/false), or a date (YYYY-MM-DD or ISO datetime). Otherwise we fall back to TEXT. Inferred types drive both the CREATE TABLE column type and the INSERT literal format (numeric values unquoted, strings escaped and quoted, NULLs emitted as NULL).",
      },
      {
        q: "How are NULLs handled?",
        a: "By default, the literal token 'NULL' (case-insensitive) and empty cells are emitted as SQL NULL. You can configure the NULL token (e.g. '\\\\N' for PostgreSQL COPY style) and toggle whether empty cells become NULL or empty strings. NULLs are never quoted, so the generated SQL loads cleanly without type errors.",
      },
      {
        q: "What insert modes are supported?",
        a: "Three: single-row INSERTs (one statement per row), batched multi-row INSERTs (configurable batch size, default 100 — much faster for large imports), and UPSERT. UPSERT emits ON CONFLICT … DO UPDATE (PostgreSQL/SQLite), ON DUPLICATE KEY UPDATE (MySQL), or MERGE INTO (SQL Server) using the column you designate as the conflict key.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) RFC 4180-correct CSV parser (quotes, embedded commas/quotes/newlines, BOM, mixed line endings). (2) Delimiter auto-detect (comma/semicolon/tab/pipe). (3) Smart per-column type inference (int/decimal/boolean/date/text). (4) NULL vs empty-string handling with configurable token. (5) Three insert modes — single, batched, upsert. (6) Optional CREATE TABLE with typed columns. (7) Five-dialect support (ANSI/MySQL/PostgreSQL/SQLite/T-SQL). (8) Optional identifier quoting per dialect. (9) SQL-injection-safe string escaping. (10) Live preview with type badges. (11) localStorage history (max 20). (12) Shareable URL config. (13) Copy / download .sql. 100% offline — no upload.",
      },
    ],
  },
  status: "done",
};
