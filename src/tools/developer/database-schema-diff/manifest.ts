/**
 * Database Schema Diff — Tool Manifest.
 * Tool #273 — Category 4 (Developer & Code).
 *
 * Compares two DDL dumps and produces a structural diff plus a
 * dependency-ordered, bidirectional migration script. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "database-schema-diff",
  name: "Database Schema Diff",
  description:
    "Compare two database schemas (DDL dumps) and generate a structural diff plus a dependency-ordered ALTER TABLE migration script. Detects added/dropped/changed tables, columns, types, constraints, and indexes; flags data-loss operations. Multi-dialect (ANSI/MySQL/PostgreSQL/SQLite/T-SQL). 100% client-side.",
  category: "developer",
  keywords: [
    "schema diff", "database schema diff", "ddl diff",
    "sql compare online", "migration generator", "alter table generator",
    "schema compare", "ddl compare", "schema migration",
  ],
  icon: "git-compare-arrows",
  requiresNetwork: false,
  seo: {
    title: "Database Schema Diff — Compare DDL & Generate ALTER Migration | UnQTools",
    faq: [
      {
        q: "How does the schema diff tool work?",
        a: "Paste two DDL scripts (source and target). The tool parses every CREATE TABLE and CREATE INDEX statement into a normalized schema model — tables, columns (type, nullability, default), primary/foreign/unique/check constraints, and indexes. It then diffs the two models and emits an ALTER TABLE migration script that brings source in line with target, in correct dependency order.",
      },
      {
        q: "What kinds of changes are detected?",
        a: "Added/removed tables, added/removed columns, column type changes, nullability changes, default-value changes, added/removed primary/foreign/unique/check constraints, and added/removed indexes. Each change is color-coded (green for added, red for removed, amber for modified) and destructive operations get a data-loss warning badge.",
      },
      {
        q: "How are foreign-key dependencies ordered in the migration?",
        a: "We topologically sort tables by their foreign-key references. Tables are created in dependency order (referenced tables first) and dropped in reverse order. Foreign-key constraints are added after both endpoints exist, and indexes are created last — so the generated script runs cleanly without 'table does not exist' errors.",
      },
      {
        q: "Does it flag data-loss operations?",
        a: "Yes. Dropping a table, dropping a column, narrowing a type (e.g. VARCHAR(255) → VARCHAR(50), INT → SMALLINT), making a NOT-NULL column without a default, and dropping a default all produce a warning badge in the diff view and a `-- ⚠ DATA LOSS` comment in the generated migration script.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-dialect DDL parsing (ANSI/MySQL/PostgreSQL/SQLite/T-SQL). (2) Bidirectional migration (source→target and target→source). (3) Topological FK dependency ordering. (4) Data-loss warnings on destructive ops. (5) Type-widening vs narrowing detection. (6) Ignore options (case, column order, whitespace). (7) Diff summary stats (added/removed/changed counts). (8) Filter by object type (table/column/constraint/index). (9) Copy / download .sql migration. (10) localStorage history (max 20). (11) Shareable URL. (12) Side-by-side change tree with color coding. No DB connection required.",
      },
    ],
  },
  status: "done",
};
