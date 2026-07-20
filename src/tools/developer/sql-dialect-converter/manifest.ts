/**
 * SQL Dialect Converter — Tool Manifest.
 * Tool #264 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-dialect-converter",
  name: "SQL Dialect Converter",
  description:
    "Convert SQL between MySQL, PostgreSQL, SQLite, SQL Server, and Oracle — deterministically, in your browser. Handles identifier quoting, LIMIT/TOP/ROWNUM, AUTO_INCREMENT/SERIAL/IDENTITY, string concat, date functions, and common data types. Side-by-side change notes; unconvertible constructs are flagged, never silently mistranslated.",
  category: "developer",
  keywords: [
    "sql dialect converter", "mysql to postgresql", "postgresql to mysql",
    "sql server to sqlite", "oracle to mysql", "sql translation",
    "convert sql", "sql migration", "dialect translation",
    "limit to top", "auto_increment to serial",
  ],
  icon: "git-compare",
  requiresNetwork: false,
  seo: {
    title: "SQL Dialect Converter — MySQL ↔ PostgreSQL ↔ SQLite ↔ SQL Server ↔ Oracle | UnQTools",
    faq: [
      {
        q: "Is this converter deterministic and offline?",
        a: "Yes. The converter is 100% client-side and deterministic — the same input + from/to dialect pair always produces the same output. There is no AI in the loop, no server call, and no telemetry. Your SQL never leaves the browser.",
      },
      {
        q: "What gets converted between dialects?",
        a: "Identifier quoting (MySQL backticks ↔ Postgres/Oracle double-quotes ↔ SQL Server square brackets ↔ SQLite double-quotes), LIMIT/OFFSET (TOP for SQL Server, ROWNUM for Oracle), AUTO_INCREMENT → SERIAL/AUTOINCREMENT/IDENTITY, string concatenation (CONCAT() ↔ ||), common date functions (NOW/CURDATE/GETDATE/SYSDATE), and a curated data-type mapping table for CREATE TABLE and CAST.",
      },
      {
        q: "What about constructs with no clean equivalent?",
        a: "Anything without a deterministic, safe translation is left in place and flagged in the change notes (severity 'manual review'). Stored procedures, vendor-specific functions, triggers, spatial types, ENUM/SET, and UNSIGNED are typical examples. The converter never silently mistranslates — it tells you exactly what to review.",
      },
      {
        q: "Why doesn't the converter parse SQL into a full AST?",
        a: "Most production converters that do AST-based translation are server-side (jOOQ, SQLines) or non-deterministic (AI tools). We chose a curated, rule-based approach that runs entirely in the browser and is auditable: each rule is a small, testable transformation with a documented mapping table you can inspect in the UI.",
      },
      {
        q: "What extras does this converter offer versus others?",
        a: "(1) Five dialects: MySQL, PostgreSQL, SQLite, SQL Server, Oracle. (2) Identifier quoting conversion. (3) LIMIT ↔ TOP ↔ ROWNUM. (4) AUTO_INCREMENT ↔ SERIAL/AUTOINCREMENT/IDENTITY. (5) String concat CONCAT ↔ ||. (6) Common date-function mapping. (7) Curated data-type mapping table (40+ types). (8) Per-conversion change log with severity (info/warning/manual). (9) Mapping reference table in UI. (10) Honesty banner with manual-review flags. (11) localStorage history (max 20). (12) Shareable URL. (13) Copy / download converted .sql. (14) Three preset conversions.",
      },
    ],
  },
  status: "done",
};
