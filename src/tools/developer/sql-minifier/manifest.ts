/**
 * SQL Minifier — Tool Manifest.
 * Tool #262 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-minifier",
  name: "SQL Minifier",
  description:
    "Minify and compress SQL queries into a single line — removes comments and redundant whitespace while preserving string literals and quoted identifiers exactly. Dialect-aware (--, #, /* */). 100% client-side.",
  category: "developer",
  keywords: [
    "sql", "sql minifier", "minify sql", "compress sql",
    "sql compressor", "sql single line", "sql compact",
    "strip sql comments", "sql minify online",
  ],
  icon: "minimize-2",
  requiresNetwork: false,
  seo: {
    title: "SQL Minifier — Compress SQL, Remove Comments, Single-Line | UnQTools",
    faq: [
      {
        q: "How does the SQL minifier protect string literals?",
        a: "We tokenize the SQL before stripping whitespace, so string literals ('…', \"…\", `…`, [bracket]) are treated as atomic units. Their contents — including any spaces, --, #, /* */ sequences, or semicolons inside them — are preserved verbatim. Only whitespace between tokens is collapsed.",
      },
      {
        q: "What comment syntaxes are supported?",
        a: "Three styles: SQL standard '--' line comments (ANSI/PostgreSQL/SQLite/T-SQL/MySQL), MySQL '#' line comments, and '/* … */' block comments (with PostgreSQL-style nesting). Toggle comment removal on/off; when off, comments are kept in their minified form.",
      },
      {
        q: "Can I keep newlines between multiple statements?",
        a: "Yes. By default the minifier outputs a single line, but switch 'Newlines' to 'Keep newlines between statements' and each semicolon-terminated statement goes on its own line. Consecutive semicolons can optionally be normalized to one.",
      },
      {
        q: "What output modes are available?",
        a: "Plain minified SQL (default), or a JS/JSON string-escaped variant for embedding SQL inside JavaScript code — useful for query builders, test fixtures, and configuration files. The escaped mode wraps the result in double quotes and escapes \", \\, and newlines.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Five-dialect tokenizer (ANSI/MySQL/PostgreSQL/SQLite/T-SQL). (2) Toggle comment removal (-- # /* */). (3) Single-line or keep-newlines-between-statements mode. (4) Semicolon normalization. (5) JS/JSON string-escaped output for embedding. (6) String-literal safety (single, double, backtick, bracket). (7) Live byte + percentage savings meter. (8) Statement counter. (9) localStorage history (max 20). (10) Shareable-URL config. (11) Copy / download .sql. (12) One-click sample SQL. Pairs reversibly with the SQL Formatter.",
      },
    ],
  },
  status: "done",
};
