/**
 * In-Browser SQL Playground — Tool Manifest.
 * Tool #276 — Category 4 (Developer & Code).
 *
 * A pure-JavaScript SQL engine that runs entirely in the browser — no
 * external database, no network. Supports CREATE TABLE (with INTEGER/TEXT/
 * REAL/NUMERIC/BLOB types), INSERT (single + multi-row), and SELECT with
 * WHERE (=, !=, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL, AND, OR, NOT),
 * INNER/LEFT JOIN, GROUP BY (COUNT/SUM/AVG/MIN/MAX), HAVING, ORDER BY,
 * LIMIT/OFFSET, DISTINCT, scalar functions (UPPER/LOWER/LENGTH/ABS/ROUND/
 * COALESCE/TRIM/CONCAT), and multi-statement execution. Results can be
 * exported as CSV / JSON / Markdown. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "in-browser-sql-playground",
  name: "In-Browser SQL Playground",
  description:
    "Run SQL entirely in your browser — no server, no signup, no data leaving the device. A pure-JS SQL engine executes CREATE TABLE, INSERT, and SELECT (WHERE, JOIN, GROUP BY, HAVING, ORDER BY, LIMIT, DISTINCT) against in-memory tables. Export results as CSV/JSON/Markdown. Schema browser, sample datasets, query history, shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "sql playground", "online sql", "run sql in browser",
    "sqlite online", "in browser sql", "sql editor",
    "sql sandbox", "sql tester", "sql executor",
    "duckdb wasm", "pure js sql", "sql query runner",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "In-Browser SQL Playground — Pure-JS SQL Engine, No Server | UnQTools",
    faq: [
      {
        q: "Does this tool use a real database like SQLite or DuckDB?",
        a: "No — this is a small pure-JavaScript SQL engine built from scratch that runs entirely in your browser. It implements CREATE TABLE, INSERT, and SELECT (with WHERE, JOIN, GROUP BY, HAVING, ORDER BY, LIMIT, DISTINCT) over in-memory tables. It's designed for teaching, ad-hoc analysis, and quick experimentation — not as a replacement for a full database. For very large datasets or transactional guarantees, use sql.js (SQLite WASM) or DuckDB-Wasm.",
      },
      {
        q: "What SQL features are supported?",
        a: "DDL: CREATE TABLE (with INTEGER, TEXT, REAL, NUMERIC, BLOB types; PRIMARY KEY; NOT NULL; DEFAULT; IF NOT EXISTS) and DROP TABLE. DML: INSERT (single and multi-row). Queries: SELECT with column projection (including * and alias.*), WHERE (=, !=, <, >, <=, >=, LIKE with % and _, IN, NOT IN, BETWEEN, IS NULL, IS NOT NULL, AND, OR, NOT), INNER and LEFT JOIN, GROUP BY with COUNT/SUM/AVG/MIN/MAX aggregates, HAVING, ORDER BY (ASC/DESC), LIMIT and OFFSET, DISTINCT, and scalar functions (UPPER, LOWER, LENGTH, ABS, ROUND, COALESCE, TRIM, CONCAT). Multi-statement scripts are supported (semicolon-separated).",
      },
      {
        q: "How are NULLs and types handled?",
        a: "NULL is a first-class value. SQL three-valued logic is honored: any comparison (=, <, >, etc.) with a NULL operand returns NULL (treated as false in WHERE), and NULL = NULL is NULL — use IS NULL or IS NOT NULL to test for NULL. Arithmetic with NULL propagates NULL. Column types are declared in CREATE TABLE; values are coerced on INSERT (e.g. TRUE stored as a boolean for NUMERIC columns, integers truncated for INTEGER). The literal NULL, TRUE, and FALSE are recognized in INSERT and SELECT.",
      },
      {
        q: "Can I save or share my queries and data?",
        a: "Yes. The schema + data can be exported to a JSON file and re-imported later (full round-trip). Query results can be exported as CSV, JSON, or Markdown. Your recent 20 queries are kept in localStorage history. And the current SQL can be shared via a URL — the entire query is encoded in the URL hash so the recipient sees exactly what you wrote.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Pure-JS SQL engine — no WASM, no server, instant load. (2) Multi-statement script execution with per-statement timing. (3) WHERE with full operator set (=, !=, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL, AND, OR, NOT). (4) INNER + LEFT JOIN. (5) GROUP BY with COUNT/SUM/AVG/MIN/MAX + HAVING. (6) ORDER BY (ASC/DESC) on source columns, output aliases, or aggregates. (7) LIMIT / OFFSET / DISTINCT. (8) Scalar functions: UPPER/LOWER/LENGTH/ABS/ROUND/COALESCE/TRIM/CONCAT. (9) Three bundled sample datasets. (10) Schema browser sidebar. (11) Results export as CSV/JSON/Markdown. (12) Database export/import (full round-trip). (13) localStorage query history (max 20). (14) Shareable URL with embedded SQL. 100% offline — no upload.",
      },
    ],
  },
  status: "done",
};
