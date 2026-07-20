import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-sql-query-generator",
  name: "AI SQL Query Generator",
  description:
    "Generate SQL from a natural-language question plus your table schema. Schema parser (CREATE TABLE DDL or comma-separated table.col list), NL → SQL pattern matching (SELECT, WHERE, JOIN, GROUP BY, ORDER BY, HAVING), dialect selection (SQLite/PostgreSQL/MySQL), SELECT-only safety guard, syntax validation, query explanation, parameterization helper, EXPLAIN hint, dialect convert, history. Pure-JS engine — optional BYO-key LLM. 100% client-side, schema never uploaded.",
  category: "ai",
  keywords: [
    "sql generator", "natural language to sql", "text to sql",
    "ai sql", "sql from schema", "nl2sql",
    "schema-aware sql", "private sql tool", "sql query builder",
    "sqlite postgres mysql",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "AI SQL Query Generator — Schema-Aware, Testable, Private | UnQTools",
    faq: [
      {
        q: "How does the AI SQL Query Generator work?",
        a: "Paste your table schema as CREATE TABLE DDL statements or as a comma-separated list (table.column, table.column) and ask a question in plain English. The tool parses the schema into tables and columns, detects the intent (count, filter, aggregate, join, sort) from your question using keyword routing, and emits a SQL SELECT statement grounded in the actual columns you provided. Each generated query comes with a plain-English explanation and a syntax check.",
      },
      {
        q: "Which SQL dialects are supported?",
        a: "Three dialects: SQLite, PostgreSQL, and MySQL. The generator picks the right quoting (double quotes for PostgreSQL identifiers, backticks for MySQL, square brackets or plain for SQLite), the right LIMIT syntax, and adjusts functions like CONCAT, SUBSTRING, and date functions to the chosen dialect. You can convert a generated query between dialects with one click.",
      },
      {
        q: "How are destructive operations handled?",
        a: "The generator only ever emits SELECT statements. INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, and other mutating or DDL keywords are blocked by the safety guard, and a warning is shown if your question seems to ask for a destructive operation. This makes the tool safe to use even on a production connection — but you should still review every query before running it against real data.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Schema parser for CREATE TABLE DDL or comma-separated table.column lists. (2) NL → SQL pattern matching (SELECT, WHERE, JOIN, GROUP BY, ORDER BY, HAVING, LIMIT). (3) Dialect selection (SQLite/PostgreSQL/MySQL) with correct quoting. (4) SELECT-only safety guard. (5) SQL syntax validator. (6) Plain-English query explanation. (7) Parameterization helper (turns literal values into $1, $2 placeholders). (8) EXPLAIN hint. (9) Dialect converter (re-render between dialects). (10) Sample schema + sample questions. (11) History (localStorage, last 20). (12) Shareable URL. (13) Copy/download. (14) Optional BYO-key LLM enhancement. (15) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my schema or data sent anywhere?",
        a: "No. All schema parsing, SQL generation, syntax validation, and dialect conversion run locally in your browser. Your DDL and sample data never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Always review generated SQL before running it on real data.",
      },
    ],
  },
  status: "done",
};
