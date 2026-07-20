/**
 * SQL Formatter / Beautifier — Tool Manifest.
 * Tool #261 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-formatter-beautifier",
  name: "SQL Formatter / Beautifier",
  description:
    "Format and beautify SQL queries with dialect awareness (MySQL, PostgreSQL, SQLite, SQL Server, ANSI), keyword casing, indentation, comma style, and SELECT-column alignment. Pure in-browser; no network. 100% client-side.",
  category: "developer",
  keywords: [
    "sql", "sql formatter", "beautify sql", "format sql",
    "sql beautifier", "prettify sql", "sql indent", "pretty print sql",
    "mysql formatter", "postgres formatter", "tsql formatter",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "SQL Formatter / Beautifier — MySQL, PostgreSQL, SQLite, T-SQL | UnQTools",
    faq: [
      {
        q: "Which SQL dialects does this formatter support?",
        a: "ANSI SQL (the standard baseline), MySQL/MariaDB, PostgreSQL, SQLite, and SQL Server (T-SQL). Dialect selection mainly controls how quoted identifiers (backticks, double-quotes, [brackets]) and vendor comments (--, #, /* */) are tokenized so the formatter never corrupts your code.",
      },
      {
        q: "What style options can I control?",
        a: "Keyword case (UPPER / lower / preserve), identifier case (preserve / upper / lower), indent style (spaces or tabs) and width, comma placement (trailing or leading), newline before major clauses (SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, etc.), and SELECT-column alignment. Presets ship for popular styles (dbt, Poor-Man's-TSQL, pgcrypto-friendly).",
      },
      {
        q: "Does the formatter change the meaning of my SQL?",
        a: "No. We never reorder, add, or remove tokens. String literals ('…', \"…\", `…`, […]) and comments (-- line, # MySQL, /* block */) are preserved verbatim. Only whitespace, newlines, indentation, and keyword casing change. Run it through the in-tool diff to verify before/after are semantically identical.",
      },
      {
        q: "Are my queries uploaded to a server?",
        a: "Never. This is a 100% client-side formatter — your SQL never leaves the browser. History (last 20 operations) is stored in localStorage on this device only, and a shareable URL encodes your options in the fragment (after #), which browsers never send to servers.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Five dialect presets. (2) Keyword + identifier case control. (3) Spaces or tabs indent with custom width. (4) Leading or trailing comma style. (5) SELECT-column alignment. (6) Comment preservation (-- # /* */). (7) String-literal safety (single, double, backtick, bracket). (8) Live before/after stats (chars, lines, tokens). (9) Saveable named presets + shareable-URL config. (10) localStorage history (max 20). (11) Copy / download .sql. (12) One-click sample SQL.",
      },
    ],
  },
  status: "done",
};
