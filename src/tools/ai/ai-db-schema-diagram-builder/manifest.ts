import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-db-schema-diagram-builder",
  name: "AI DB Schema Diagram Builder (Mermaid.js)",
  description:
    "Describe your tables in plain English or paste SQL DDL and get Mermaid.js erDiagram code with entities, typed columns, PK/FK/UK markers, and crow's-foot 1:1 / 1:N / N:M relationships. Live preview, copy, export SVG/PNG via mermaid.live, DBML export, schema validation, and FK inference from naming conventions. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "er diagram", "mermaid erdiagram", "database schema",
    "sql to mermaid", "db schema generator", "er diagram generator",
    "dbml", "dbdiagram alternative", "drawsql alternative",
    "schema diagram", "crow's foot", "entity relationship",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "AI DB Schema Diagram Builder — Mermaid erDiagram Generator | UnQTools",
    faq: [
      {
        q: "How does the DB schema diagram builder work?",
        a: "Describe your tables in plain English ('Table users has columns: id (pk), email, name; users has many posts') or paste SQL DDL (CREATE TABLE statements with PRIMARY KEY, FOREIGN KEY ... REFERENCES, UNIQUE constraints). The parser extracts entities, columns, types, and keys, then generates portable Mermaid.js erDiagram code with crow's-foot cardinality for 1:1, 1:N, and N:M relationships. The code renders live in the preview panel and is also ready to paste into mermaid.live or any Mermaid renderer.",
      },
      {
        q: "What SQL dialects are supported?",
        a: "The parser is dialect-tolerant: it handles Postgres, MySQL, and SQLite CREATE TABLE statements, inline REFERENCES clauses, table-level FOREIGN KEY ... REFERENCES constraints, PRIMARY KEY and UNIQUE markers, NOT NULL and DEFAULT modifiers, and CHECK constraints (kept as notes). Foreign keys are parsed from both inline column definitions and table-level constraint clauses.",
      },
      {
        q: "How are relationships inferred from naming conventions?",
        a: "If you describe columns but don't spell out the relationships, the inferRelationships() helper looks for columns matching the pattern <table>_id (e.g., posts.user_id → users.id) and auto-creates a 1:N relationship from the referenced table to the one holding the foreign-key column. Junction tables (tables whose name suggests a join, or tables with exactly two *_id columns) are promoted to N:M relationships.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Plain-English schema description parser. (2) SQL DDL parser (Postgres/MySQL/SQLite). (3) Mermaid erDiagram code generator with PK/FK/UK markers and crow's-foot cardinality. (4) 1:1, 1:N, N:M relationship support. (5) DBML export for dbdiagram.io. (6) FK auto-inference from <table>_id naming. (7) Schema validator with field-level errors. (8) mermaid.live deep link for instant SVG/PNG export. (9) CSV export of all columns. (10) Local history (last 20). (11) Shareable URL with the schema encoded. (12) 12+ type presets (int, varchar, text, boolean, decimal, uuid, json, etc.). (13) Per-entity notes. (14) Copy / download .mmd / download .dbml. (15) Honesty disclaimers (verify against real schema).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, generation, validation, and inference run locally in your browser. Your schema never leaves this device. The only outbound link is to mermaid.live when you click 'Open in mermaid.live' — that opens in a new tab and is the standard Mermaid playground; we don't send your code there automatically.",
      },
    ],
  },
  status: "done",
};
