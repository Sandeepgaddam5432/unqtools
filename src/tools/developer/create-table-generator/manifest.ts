/**
 * CREATE TABLE Generator — Tool Manifest.
 * Tool #269 — Category 4 (Developer & Code).
 *
 * Visual form-based table designer that emits correct CREATE TABLE DDL for
 * MySQL, PostgreSQL, SQLite and SQL Server. Pure-JS, 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "create-table-generator",
  name: "CREATE TABLE Generator",
  description:
    "Design a SQL table visually and generate correct CREATE TABLE DDL for MySQL, PostgreSQL, SQLite, and SQL Server. Add columns, types, defaults, primary keys (single/composite), unique, foreign keys with ON DELETE/UPDATE, indexes, CHECK constraints, ENUMs and comments. Includes CSV/JSON column inference, IF NOT EXISTS, matching DROP TABLE, seed INSERT scaffolding, MySQL engine/charset, SQLite WITHOUT ROWID, reserved-word auto-quoting and per-dialect identifier limits. 100% client-side.",
  category: "developer",
  keywords: [
    "create table generator", "sql table creator", "ddl generator",
    "generate create table statement", "mysql create table", "postgres create table",
    "sqlite create table", "sql server create table", "table schema generator",
    "foreign key generator", "primary key generator", "ddl designer",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "CREATE TABLE Generator — MySQL, PostgreSQL, SQLite, SQL Server DDL | UnQTools",
    faq: [
      {
        q: "Which SQL dialects does the CREATE TABLE Generator support?",
        a: "Four dialects: MySQL / MariaDB, PostgreSQL, SQLite, and SQL Server (T-SQL). Each dialect has its own identifier quoting (backtick / double-quote / square bracket), type list, auto-increment syntax (AUTO_INCREMENT / GENERATED AS IDENTITY / AUTOINCREMENT / IDENTITY), and table options (MySQL ENGINE/CHARSET, SQLite WITHOUT ROWID). Switch dialects at any time and the DDL is regenerated instantly.",
      },
      {
        q: "Can it generate primary keys, foreign keys, unique constraints and indexes?",
        a: "Yes. Single and composite primary keys, UNIQUE constraints (single or composite), foreign keys with ON DELETE / ON UPDATE actions (CASCADE, SET NULL, SET DEFAULT, RESTRICT, NO ACTION) referencing composite parent keys in the correct order, CHECK constraints, and INDEX / KEY declarations with optional method hints (BTREE, HASH for dialects that support it).",
      },
      {
        q: "Can I infer columns from a pasted CSV or JSON sample?",
        a: "Yes. Paste a CSV header row + a few sample rows (or paste a JSON array of objects) and the inference module scans the values to pick a sensible SQL type per column — INTEGER, BIGINT, DECIMAL, BOOLEAN, DATE, TIMESTAMP, VARCHAR(n) with detected max length. The inferred columns are added to the form for review before generating DDL.",
      },
      {
        q: "Does the generator emit DROP TABLE and sample INSERT statements?",
        a: "Yes. Alongside CREATE TABLE it can emit a matching DROP TABLE IF EXISTS (per-dialect syntax) and a configurable number of seed INSERT statements that respect NOT NULL columns, defaults, and enum value lists — useful for bootstrapping a new schema. All three are produced from a single model.",
      },
      {
        q: "What extras does this tool offer versus other DDL generators?",
        a: "(1) Four dialects with per-dialect identifier quoting and limits. (2) Single/composite primary keys, unique, FK with ON DELETE/UPDATE. (3) CHECK constraints, ENUM (where supported), column and table comments. (4) Indexes with method hints. (5) CSV/JSON column inference. (6) IF NOT EXISTS toggle. (7) Matching DROP TABLE + seed INSERT scaffolding. (8) MySQL ENGINE/CHARSET, SQLite WITHOUT ROWID. (9) Reserved-word auto-quoting. (10) Default-expression vs literal detection. (11) Three preset schemas. (12) localStorage history (max 20). (13) Shareable URL. (14) Copy / download .sql. (15) Live validation with severity-tagged issues.",
      },
    ],
  },
  status: "done",
};
