/**
 * SQL to ORM Code Converter — Tool Manifest.
 * Tool #265 — Category 4 (Developer & Code).
 * Converts CREATE TABLE DDL into idiomatic ORM model definitions
 * (Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, Django) 100% offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-to-orm-code-converter",
  name: "SQL to ORM Code Converter",
  description:
    "Convert CREATE TABLE DDL into idiomatic ORM models for Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, and Django — fully offline in your browser. Maps types, nullability, defaults, primary/foreign keys, unique & index constraints, and enums, with snake_case ↔ camelCase field mapping via @map / column-name decorators. Unmappable constructs are flagged, never silently dropped.",
  category: "developer",
  keywords: [
    "sql to orm", "ddl to prisma", "ddl to sequelize", "ddl to typeorm",
    "ddl to drizzle", "ddl to sqlalchemy", "ddl to django",
    "sql to prisma", "create table to model", "generate orm from sql",
    "schema to orm", "ddl converter", "sql to model generator",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "SQL to ORM Code Converter — Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, Django | UnQTools",
    faq: [
      {
        q: "How does the SQL to ORM converter work?",
        a: "Paste your CREATE TABLE DDL (one or many statements) and the converter parses columns, types, nullability, defaults, primary keys, foreign keys, unique constraints, indexes, and enums. It then runs deterministic templates per target ORM — Prisma schema, Sequelize models, TypeORM entities, Drizzle tables, SQLAlchemy models, or Django models — generating idiomatic code with relations, mapping decorators, and inline notes where a construct cannot be mapped cleanly.",
      },
      {
        q: "Which ORMs are supported and how accurate are the mappings?",
        a: "Six targets: Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, and Django. A curated type-mapping table covers the common SQL types (int, bigint, varchar, char, text, decimal, numeric, float, double, bool, date, time, datetime, timestamp, json, blob, uuid, enum). Foreign keys become ORM relations with proper back-references; composite primary keys are supported; snake_case columns are mapped to camelCase fields with @map / column-name decorators so the underlying database column is preserved.",
      },
      {
        q: "Does the tool need a live database connection?",
        a: "No. Unlike `prisma db pull` or `sqlacodegen`, this converter works entirely offline from pasted DDL — no DB connection, no introspection, no credentials. Everything runs in your browser, and the same DDL always produces the same output (deterministic templates, no AI guessing).",
      },
      {
        q: "How are foreign keys, self-referential relations, and many-to-many handled?",
        a: "Each foreign key becomes a `@relation` / `hasMany` / `belongsTo` (or equivalent) with a back-reference on the parent table. Self-referential foreign keys are detected (e.g., `parent_id` referencing the same table) and labelled `@relation(\"self\")` or named explicitly. Many-to-many via an explicit join table renders as two belongsTo on the join model (no implicit Prisma m-n guessing). Check constraints and partial indexes are flagged in the notes rather than silently dropped.",
      },
      {
        q: "What extras does this converter offer versus others?",
        a: "(1) Six ORM targets from one DDL paste. (2) Curated type mapping (40+ types). (3) PK / FK / unique / index / enum detection. (4) Composite primary keys. (5) snake_case → camelCase field naming with @map decorators. (6) Self-referential FK detection. (7) Defaults preserved as raw expressions. (8) Per-target inline notes for unmappable constructs. (9) Naming-strategy toggle (preserve / camelCase). (10) Tabbed output per ORM with copy + download per file. (11) Relation summary preview. (12) Three DDL presets. (13) localStorage history (max 20). (14) Shareable URL with base64-encoded DDL + options. (15) Honesty banner: 'Always test generated models against your schema.'",
      },
    ],
  },
  status: "done",
};
