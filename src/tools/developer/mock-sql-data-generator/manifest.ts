/**
 * Mock SQL Data Generator — Tool Manifest.
 * Tool #270 — Category 4 (Developer & Code).
 *
 * Generates realistic fake test data from a table schema (pasted CREATE TABLE
 * DDL or hand-defined fields) and emits ready-to-run INSERT statements, CSV,
 * or JSON. Supports FK-aware relational generation, deterministic seed,
 * locale-aware realistic data, weighted enums, regex patterns, blank %,
 * unique constraints, batched INSERTs and multi-dialect output. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mock-sql-data-generator",
  name: "Mock SQL Data Generator",
  description:
    "Generate realistic fake test data from a SQL schema and emit INSERT statements, CSV, or JSON. Parse CREATE TABLE DDL or define fields manually; per-column data types include names, emails, dates, numbers, addresses, UUIDs, IPs, ENUMs and regex patterns. FK-aware relational generation (child rows reference valid parent keys), deterministic seed for reproducible data, blank %, unique constraints, batched INSERTs, and per-dialect output (MySQL, PostgreSQL, SQLite, SQL Server). Unlimited rows, 100% client-side, no server.",
  category: "developer",
  keywords: [
    "mock sql data generator", "fake data for database", "generate test insert statements",
    "sql mock data", "faker sql", "test data generator", "ddl to insert",
    "create table to mock data", "synthetic data", "seed database",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Mock SQL Data Generator — INSERT/CSV/JSON, FK-aware, Seeded | UnQTools",
    faq: [
      {
        q: "How does the Mock SQL Data Generator produce data?",
        a: "Paste a CREATE TABLE statement (the tool parses columns, types, NOT NULL, defaults, ENUM values and inline foreign-key references) or define fields manually with a faker type per column. The generator then produces N rows of realistic mock data — names, emails, dates, numbers, addresses, UUIDs, IPs, ENUMs, regex-matched strings — and emits INSERT statements, CSV, or JSON. All generation is deterministic given the same seed.",
      },
      {
        q: "Does it handle foreign-key relationships?",
        a: "Yes. If your DDL declares inline REFERENCES clauses (or you define FK relationships manually), the generator produces parent tables first, collects the generated parent-key values, and then generates child rows whose FK columns reference one of those valid parent keys — preserving referential integrity. Composite foreign keys are supported, and circular dependencies are detected and reported.",
      },
      {
        q: "Is the generated data reproducible?",
        a: "Yes. The tool uses a deterministic, seedable PRNG (mulberry32). Enter the same seed and you get the identical dataset every time — useful for sharing test cases or for golden-file CI checks. Switch the seed to get a fresh dataset for the same schema.",
      },
      {
        q: "What data types are supported per column?",
        a: "30+ faker types: first_name, last_name, full_name, email, username, phone, street, city, state, country, zip, company, job_title, sentence, paragraph, url, ipv4, ipv6, uuid, date_past, date_future, date_recent, timestamp, boolean, int (with min/max), decimal (with precision), bigint, money, age, hex_color, enum (with weighted values), regex (with pattern), and constant. Each type produces type-appropriate realistic values.",
      },
      {
        q: "What extras does this tool offer versus Mockaroo and others?",
        a: "(1) Unlimited rows (no 1,000-row cap). (2) Fully offline — your schema never leaves the browser. (3) FK-aware relational generation. (4) Deterministic seed. (5) 30+ faker types. (6) Weighted ENUMs. (7) Regex-pattern column. (8) Blank % per column. (9) Unique constraint enforcement (collision-safe). (10) Batched INSERTs (configurable batch size). (11) Multi-dialect output (MySQL, PostgreSQL, SQLite, SQL Server). (12) CSV + JSON output. (13) Parse DDL or define fields manually. (14) localStorage history (max 20). (15) Shareable URL. (16) Copy / download .sql / .csv / .json.",
      },
    ],
  },
  status: "done",
};
