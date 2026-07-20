/**
 * ER Diagram Designer (Diagram to SQL) — Tool Manifest.
 * Tool #268 — Category 4 (Developer & Code).
 *
 * Visually design a database schema — add tables, columns, keys, and
 * relationships — and generate clean CREATE TABLE DDL per dialect
 * (Postgres, MySQL, SQLite, SQL Server) plus migration scripts by diffing
 * schema versions. Topological creation-order output (handles circular FKs),
 * reserved-word auto-quoting per dialect, DBML import, and round-trip with
 * the SQL DDL to ER Diagram Generator (#267).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "er-diagram-designer",
  name: "ER Diagram Designer (Diagram to SQL)",
  description:
    "Visually design a database schema in the browser — add entities, columns, primary/foreign keys, and relationships — and generate clean CREATE TABLE DDL for PostgreSQL, MySQL, SQLite, and SQL Server. Topological creation-order output (handles circular FKs), per-dialect reserved-word auto-quoting, migration scripts by diffing two schema versions, DBML import/export, and round-trip with the SQL DDL to ER Diagram Generator (#267). 100% client-side, no signup.",
  category: "developer",
  keywords: [
    "er diagram designer", "database schema designer online",
    "generate create table from diagram", "erd to sql", "visual schema designer",
    "dbml designer", "ddl generator", "migration script generator",
    "schema migration diff", "crow's foot designer",
  ],
  icon: "git-merge",
  requiresNetwork: false,
  seo: {
    title: "ER Diagram Designer — Visual Schema to SQL DDL + Migrations | UnQTools",
    faq: [
      {
        q: "How does the ER Diagram Designer work?",
        a: "Add entities (tables) with columns — name, type, nullable, default, primary key, unique. Connect columns with foreign-key relationships to model cardinality. The designer emits clean CREATE TABLE DDL for PostgreSQL, MySQL, SQLite, or SQL Server, with tables ordered by a topological sort of FK dependencies (circular FKs are detected and broken deterministically). Switch dialects instantly, share the schema via URL, and import DBML or a schema JSON from the companion SQL DDL to ER Diagram Generator (#267).",
      },
      {
        q: "Can it generate migration scripts by diffing two schema versions?",
        a: "Yes. Save the current schema as a baseline, then edit the working schema (add/remove tables, columns, FKs). The diff engine produces ALTER TABLE ADD COLUMN, DROP COLUMN, ADD CONSTRAINT, DROP CONSTRAINT, RENAME TABLE, and CREATE/DROP TABLE statements for the target dialect. Renames are heuristic — when in doubt the diff emits a DROP + CREATE pair rather than a destructive rename.",
      },
      {
        q: "Which dialect-specific behaviors does the DDL generator handle?",
        a: "Per-dialect identifier quoting (PostgreSQL double-quote, MySQL backtick, SQLite double-quote or backtick, SQL Server square bracket), reserved-word auto-quoting per dialect (a 200+ word list), per-dialect type canonicalization (SERIAL vs AUTOINCREMENT vs AUTO_INCREMENT vs IDENTITY(1,1)), per-dialect FK syntax, ON DELETE / ON UPDATE actions (CASCADE, SET NULL, RESTRICT, NO ACTION, SET DEFAULT), composite primary keys, composite foreign keys, named constraints, and CHECK constraints.",
      },
      {
        q: "Does this round-trip with the SQL DDL to ER Diagram Generator (#267)?",
        a: "Yes. Both tools share the same JSON schema model shape. In #267 you paste DDL and export the schema JSON; in #268 (this tool) you import that JSON to keep designing visually, then re-export DDL. You can also import DBML exported by dbdiagram.io. The round-trip is lossless for the common case (tables, columns, types, nullability, PKs, unique, FKs, indexes, defaults).",
      },
      {
        q: "What extras does this designer offer versus drawDB / dbdiagram.io / Lucidchart?",
        a: "(1) Four dialects (PostgreSQL, MySQL, SQLite, SQL Server) with one-click switching. (2) Topological creation-order output with circular-FK detection. (3) Per-dialect reserved-word auto-quoting (200+ words). (4) Migration script generation by diffing two schema versions. (5) DBML import and export. (6) Round-trip JSON schema model with the SQL DDL to ER Diagram Generator (#267). (7) ON DELETE / ON UPDATE FK actions. (8) Composite PK / composite FK. (9) Named constraints. (10) CHECK constraints. (11) Inline validation warnings (orphan FKs, missing PK, duplicate names, reserved words). (12) Three starter presets. (13) localStorage history (max 20). (14) Shareable URL with base64-encoded schema. (15) Copy / download .sql with auto-history. (16) 100% offline, no signup.",
      },
    ],
  },
  status: "done",
};
