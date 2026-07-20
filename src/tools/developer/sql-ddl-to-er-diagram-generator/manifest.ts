/**
 * SQL DDL to ER Diagram Generator — Tool Manifest.
 * Tool #267 — Category 4 (Developer & Code).
 *
 * Parses CREATE TABLE / ALTER TABLE DDL across dialects and renders an
 * editable Entity-Relationship diagram (Mermaid erDiagram + ASCII crow's-foot
 * + DBML) — tables as boxes, columns with types/keys, FK relationships as
 * crow's-foot connectors, with auto-layout, topological ordering, composite
 * and self-referential FK support, and shareable schema JSON.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-ddl-to-er-diagram-generator",
  name: "SQL DDL to ER Diagram Generator",
  description:
    "Paste any-dialect SQL DDL (CREATE TABLE / ALTER TABLE) and instantly render an ER diagram as Mermaid erDiagram code, ASCII crow's-foot diagram, and DBML. Detects PKs, UNIQUE, composite keys, inline and table-level foreign keys, ALTER TABLE ADD FOREIGN KEY, and self-referencing FKs. Auto-layout, topological ordering (handles circular FKs), naming-based relationship inference when FKs are absent. 100% client-side, no signup.",
  category: "developer",
  keywords: [
    "sql to er diagram", "ddl to erd", "generate database diagram from sql",
    "er diagram generator", "mermaid erdiagram", "dbml", "schema diagram",
    "crow's foot notation", "foreign key diagram", "create table to erd",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "SQL DDL to ER Diagram Generator — Mermaid erDiagram + DBML + ASCII | UnQTools",
    faq: [
      {
        q: "How does the SQL DDL to ER Diagram Generator work?",
        a: "Paste your CREATE TABLE / ALTER TABLE DDL (MySQL, PostgreSQL, SQLite, SQL Server, or ANSI-compatible) and the tool parses it into an in-memory schema model — tables, columns with types/nullability, primary keys, unique constraints, indexes, and foreign keys (inline REFERENCES, table-level FOREIGN KEY, or ALTER TABLE ADD FOREIGN KEY). From that model it emits a Mermaid erDiagram, an ASCII crow's-foot diagram, and DBML, plus a topologically-sorted creation order. Everything runs in your browser; no DDL is uploaded.",
      },
      {
        q: "Which SQL features and edge cases are supported?",
        a: "Composite primary keys, composite foreign keys, self-referencing FKs (categories.parent_id → categories.id), circular FK chains (topological sort falls back gracefully), inline and table-level FK declarations, ALTER TABLE ADD FOREIGN KEY, named and inline constraints, multi-word types (CHARACTER VARYING, DOUBLE PRECISION, TIMESTAMP WITHOUT TIME ZONE), and quoted identifiers (`backtick`, \"double-quote\", [bracket]). CHECK constraints are detected and flagged but not interpreted. Naming-based relationship inference (e.g. user_id → users.id) can be enabled to draw FK edges when explicit REFERENCES are missing.",
      },
      {
        q: "What output formats can I export?",
        a: "Mermaid erDiagram code (paste into any Mermaid renderer, GitHub, Notion, or the live editor), a plain-text ASCII crow's-foot diagram, DBML (for dbdiagram.io), and a JSON schema model that round-trips with our companion ER Diagram Designer (#268). You can copy or download any of these, and a shareable URL encodes the entire schema in the fragment so you can send the diagram to a colleague without uploading anything.",
      },
      {
        q: "Does this work offline and without an account?",
        a: "Yes. Parsing, layout, and all export formats are 100% client-side. There is no signup, no API key, and no upload — your DDL never leaves the browser. History (last 20 parses) is stored in localStorage on your device only. The tool is installable as a PWA.",
      },
      {
        q: "What extras does this generator offer versus dbdiagram.io / drawDB / DrawSQL?",
        a: "(1) Multi-dialect DDL parsing (MySQL, PostgreSQL, SQLite, SQL Server, ANSI). (2) Mermaid erDiagram + ASCII crow's-foot + DBML exports from one parse. (3) Composite PK / composite FK / self-ref FK / circular FK support. (4) Naming-based relationship inference (user_id → users.id) when explicit FKs are absent. (5) Auto-layout with table coordinates. (6) Topological sort with cycle detection. (7) Reserved-word detection per dialect. (8) Inline validation warnings (orphan FK targets, missing PK, etc.). (9) JSON schema model export that round-trips with the ER Diagram Designer. (10) Shareable URL with base64-encoded schema. (11) Three DDL presets (blog, e-commerce, m2m). (12) localStorage history (max 20). (13) Copy / download every format. (14) 100% offline, no signup.",
      },
    ],
  },
  status: "done",
};
