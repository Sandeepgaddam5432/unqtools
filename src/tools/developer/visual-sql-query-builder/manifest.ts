/**
 * Visual SQL Query Builder — Tool Manifest.
 * Tool #263 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "visual-sql-query-builder",
  name: "Visual SQL Query Builder",
  description:
    "Build SQL SELECT queries visually — pick tables, choose columns, add WHERE filters, JOINs, GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET — and generate clean, dialect-correct SQL live. No DB connection, 100% client-side. Supports MySQL, PostgreSQL, SQLite, SQL Server, ANSI.",
  category: "developer",
  keywords: [
    "sql query builder", "visual sql", "sql generator",
    "build sql without code", "query generator", "select builder",
    "drag and drop sql", "sql designer", "where builder",
    "join builder", "group by builder",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Visual SQL Query Builder — Build SELECT Queries Online | UnQTools",
    faq: [
      {
        q: "Do I need a database connection to use this builder?",
        a: "No. This is a 100% offline, client-side builder. You type your table names and column names directly (or import a JSON schema) and the builder generates SELECT SQL on the fly. Nothing is ever sent to a server — there is no live DB connection, no execution, and no credentials to enter.",
      },
      {
        q: "Which SQL clauses can I build visually?",
        a: "SELECT (with DISTINCT and column aliases), FROM (with table aliases), INNER/LEFT/RIGHT/FULL JOIN with ON conditions, WHERE (multiple predicates joined by AND/OR with operators =, !=, <, >, <=, >=, LIKE, IN, IS NULL, IS NOT NULL, BETWEEN), GROUP BY, HAVING, ORDER BY (ASC/DESC), LIMIT and OFFSET.",
      },
      {
        q: "Which SQL dialects are supported and how does quoting change?",
        a: "ANSI (double-quotes), MySQL/MariaDB (backticks), PostgreSQL (double-quotes), SQLite (double-quotes), and SQL Server (square brackets). The builder auto-quotes reserved words and identifiers containing spaces. LIMIT/OFFSET is emitted as standard SQL for all supported dialects.",
      },
      {
        q: "Can I use aggregates like COUNT, SUM, AVG, MIN, MAX?",
        a: "Yes. Every selected column supports an optional aggregate function and alias. When aggregates are present, non-aggregated columns are automatically included in the GROUP BY clause so the generated SQL is valid. HAVING predicates let you filter on aggregate results.",
      },
      {
        q: "What extras does this builder offer versus others?",
        a: "(1) Five dialect presets with auto-quoting. (2) Aggregates + automatic GROUP BY inference. (3) Multi-predicate WHERE with AND/OR. (4) Four JOIN types with ON-condition editor. (5) ORDER BY multi-column. (6) DISTINCT, LIMIT, OFFSET. (7) Reserved-word detection. (8) Schema JSON import. (9) Live validation with inline warnings. (10) localStorage history (max 20). (11) Shareable URL. (12) Copy / download .sql. (13) Three example query presets.",
      },
    ],
  },
  status: "done",
};
