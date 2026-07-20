/**
 * SQL Dialect Converter — pure logic.
 *
 * Deterministic, rule-based SQL dialect translation across MySQL,
 * PostgreSQL, SQLite, SQL Server, and Oracle. 100% client-side — no DOM,
 * no network, no AI. Each rule is a small, testable transformation with a
 * documented mapping table.
 *
 * Design principles:
 *  - Same input + from/to pair → same output, every time.
 *  - String literals ('...') and comments (double-dash line comments,
 *    slash-star block comments, MySQL hash comments) are extracted as opaque
 *    placeholders and restored verbatim; they are never modified by the rules.
 *  - Unconvertible constructs are flagged (severity 'manual'), never
 *    silently mistranslated.
 *  - Identifier quoting styles are converted between dialect conventions:
 *    MySQL backticks, Postgres/SQLite/Oracle double-quotes, SQL Server
 *    square brackets.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SqlDialect =
  | "mysql"
  | "postgresql"
  | "sqlite"
  | "sqlserver"
  | "oracle";

export type ChangeSeverity = "info" | "warning" | "manual";

export interface ConversionChange {
  severity: ChangeSeverity;
  description: string;
  before?: string;
  after?: string;
}

export interface ConversionResult {
  ok: true;
  output: string;
  changes: ConversionChange[];
}

export interface ConversionError {
  ok: false;
  error: string;
}

export type ConversionOutcome = ConversionResult | ConversionError;

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const SQL_DIALECTS: ReadonlyArray<{ value: SqlDialect; label: string }> = [
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server (T-SQL)" },
  { value: "oracle", label: "Oracle" },
];

/** Per-dialect identifier-quote chars. Empty means "no quoting". */
export const IDENTIFIER_QUOTE: Record<SqlDialect, { open: string; close: string }> = {
  mysql: { open: "`", close: "`" },
  postgresql: { open: '"', close: '"' },
  sqlite: { open: '"', close: '"' },
  sqlserver: { open: "[", close: "]" },
  oracle: { open: '"', close: '"' },
};

// ---------------------------------------------------------------------------
// Curated data-type mapping table
// ---------------------------------------------------------------------------
// Each entry is keyed by lowercase source type name (without args).
// The value maps target dialect → target type template (use {p} for precision,
// {s} for scale if provided). Undefined means "no clean equivalent — flag manual".

export interface TypeMappingEntry {
  /** Target type template; {p} and {s} placeholders are substituted if present. */
  template: string;
  /** Severity: 'info' for clean conversion, 'warning' for lossy. */
  severity: ChangeSeverity;
  note?: string;
}

export const TYPE_MAPPINGS: Record<string, Partial<Record<SqlDialect, TypeMappingEntry>>> = {
  // Integer family
  tinyint: {
    postgresql: { template: "SMALLINT", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "TINYINT", severity: "info" },
    oracle: { template: "NUMBER(3)", severity: "info" },
  },
  smallint: {
    postgresql: { template: "SMALLINT", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "SMALLINT", severity: "info" },
    oracle: { template: "NUMBER(5)", severity: "info" },
  },
  mediumint: {
    mysql: { template: "MEDIUMINT", severity: "info" },
    postgresql: { template: "INTEGER", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "INT", severity: "info" },
    oracle: { template: "NUMBER(7)", severity: "info" },
  },
  int: {
    postgresql: { template: "INTEGER", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "INT", severity: "info" },
    oracle: { template: "NUMBER(10)", severity: "info" },
  },
  integer: {
    postgresql: { template: "INTEGER", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "INT", severity: "info" },
    oracle: { template: "NUMBER(10)", severity: "info" },
  },
  bigint: {
    postgresql: { template: "BIGINT", severity: "info" },
    sqlite: { template: "INTEGER", severity: "info" },
    sqlserver: { template: "BIGINT", severity: "info" },
    oracle: { template: "NUMBER(19)", severity: "info" },
  },
  // Booleans
  bool: {
    mysql: { template: "TINYINT(1)", severity: "warning", note: "MySQL has no native BOOLEAN" },
    postgresql: { template: "BOOLEAN", severity: "info" },
    sqlite: { template: "INTEGER", severity: "warning", note: "SQLite stores boolean as 0/1" },
    sqlserver: { template: "BIT", severity: "info" },
    oracle: { template: "NUMBER(1)", severity: "warning" },
  },
  boolean: {
    mysql: { template: "TINYINT(1)", severity: "warning", note: "MySQL has no native BOOLEAN" },
    postgresql: { template: "BOOLEAN", severity: "info" },
    sqlite: { template: "INTEGER", severity: "warning", note: "SQLite stores boolean as 0/1" },
    sqlserver: { template: "BIT", severity: "info" },
    oracle: { template: "NUMBER(1)", severity: "warning" },
  },
  // Floats
  float: {
    postgresql: { template: "REAL", severity: "info" },
    sqlite: { template: "REAL", severity: "info" },
    sqlserver: { template: "REAL", severity: "info" },
    oracle: { template: "BINARY_FLOAT", severity: "info" },
  },
  double: {
    postgresql: { template: "DOUBLE PRECISION", severity: "info" },
    sqlite: { template: "REAL", severity: "warning" },
    sqlserver: { template: "FLOAT(53)", severity: "info" },
    oracle: { template: "BINARY_DOUBLE", severity: "info" },
  },
  decimal: {
    postgresql: { template: "DECIMAL({p},{s})", severity: "info" },
    sqlite: { template: "NUMERIC({p},{s})", severity: "info" },
    sqlserver: { template: "DECIMAL({p},{s})", severity: "info" },
    oracle: { template: "NUMBER({p},{s})", severity: "info" },
  },
  numeric: {
    postgresql: { template: "NUMERIC({p},{s})", severity: "info" },
    sqlite: { template: "NUMERIC({p},{s})", severity: "info" },
    sqlserver: { template: "NUMERIC({p},{s})", severity: "info" },
    oracle: { template: "NUMBER({p},{s})", severity: "info" },
  },
  // Strings
  varchar: {
    postgresql: { template: "VARCHAR({p})", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning", note: "SQLite ignores length" },
    sqlserver: { template: "VARCHAR({p})", severity: "info" },
    oracle: { template: "VARCHAR2({p})", severity: "info" },
  },
  char: {
    postgresql: { template: "CHAR({p})", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning" },
    sqlserver: { template: "CHAR({p})", severity: "info" },
    oracle: { template: "CHAR({p})", severity: "info" },
  },
  text: {
    mysql: { template: "TEXT", severity: "info" },
    postgresql: { template: "TEXT", severity: "info" },
    sqlite: { template: "TEXT", severity: "info" },
    sqlserver: { template: "VARCHAR(MAX)", severity: "info" },
    oracle: { template: "CLOB", severity: "info" },
  },
  mediumtext: {
    mysql: { template: "MEDIUMTEXT", severity: "info" },
    postgresql: { template: "TEXT", severity: "info" },
    sqlite: { template: "TEXT", severity: "info" },
    sqlserver: { template: "VARCHAR(MAX)", severity: "info" },
    oracle: { template: "CLOB", severity: "info" },
  },
  longtext: {
    mysql: { template: "LONGTEXT", severity: "info" },
    postgresql: { template: "TEXT", severity: "info" },
    sqlite: { template: "TEXT", severity: "info" },
    sqlserver: { template: "VARCHAR(MAX)", severity: "info" },
    oracle: { template: "CLOB", severity: "info" },
  },
  // Binary
  blob: {
    postgresql: { template: "BYTEA", severity: "info" },
    sqlite: { template: "BLOB", severity: "info" },
    sqlserver: { template: "VARBINARY(MAX)", severity: "info" },
    oracle: { template: "BLOB", severity: "info" },
  },
  // Date/time
  date: {
    mysql: { template: "DATE", severity: "info" },
    postgresql: { template: "DATE", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning", note: "SQLite stores date as TEXT" },
    sqlserver: { template: "DATE", severity: "info" },
    oracle: { template: "DATE", severity: "info" },
  },
  time: {
    postgresql: { template: "TIME", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning" },
    sqlserver: { template: "TIME", severity: "info" },
    oracle: { template: "TIMESTAMP", severity: "warning" },
  },
  datetime: {
    postgresql: { template: "TIMESTAMP", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning" },
    sqlserver: { template: "DATETIME2", severity: "info" },
    oracle: { template: "TIMESTAMP", severity: "info" },
  },
  timestamp: {
    mysql: { template: "TIMESTAMP", severity: "info" },
    postgresql: { template: "TIMESTAMP", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning" },
    sqlserver: { template: "DATETIME2", severity: "info" },
    oracle: { template: "TIMESTAMP", severity: "info" },
  },
  // JSON / UUID
  json: {
    postgresql: { template: "JSON", severity: "info" },
    sqlite: { template: "TEXT", severity: "warning" },
    sqlserver: { template: "NVARCHAR(MAX)", severity: "warning" },
    oracle: { template: "CLOB", severity: "warning" },
  },
  uuid: {
    postgresql: { template: "UUID", severity: "info" },
    sqlite: { template: "TEXT", severity: "info" },
    sqlserver: { template: "UNIQUEIDENTIFIER", severity: "info" },
    oracle: { template: "RAW(16)", severity: "info" },
  },
  // MySQL-specific
  enum: {
    postgresql: { template: "TEXT", severity: "manual", note: "Postgres has no ENUM type by default; use CREATE TYPE or CHECK constraint" },
    sqlite: { template: "TEXT", severity: "manual", note: "SQLite has no ENUM; use CHECK constraint" },
    sqlserver: { template: "NVARCHAR(255)", severity: "manual", note: "SQL Server has no ENUM; use CHECK constraint" },
    oracle: { template: "VARCHAR2(255)", severity: "manual", note: "Oracle has no ENUM; use CHECK constraint" },
  },
  set: {
    postgresql: { template: "TEXT[]", severity: "manual", note: "MySQL SET has no direct equivalent; consider array or junction table" },
    sqlite: { template: "TEXT", severity: "manual" },
    sqlserver: { template: "NVARCHAR(255)", severity: "manual" },
    oracle: { template: "VARCHAR2(255)", severity: "manual" },
  },
};

// ---------------------------------------------------------------------------
// Curated function mapping table (lowercase function name → per-dialect target)
// ---------------------------------------------------------------------------

export const FUNCTION_MAPPINGS: Record<string, Partial<Record<SqlDialect, string>>> = {
  now: {
    mysql: "NOW()",
    postgresql: "CURRENT_TIMESTAMP",
    sqlite: "datetime('now')",
    sqlserver: "GETDATE()",
    oracle: "SYSDATE",
  },
  curdate: {
    mysql: "CURDATE()",
    postgresql: "CURRENT_DATE",
    sqlite: "date('now')",
    sqlserver: "CAST(GETDATE() AS DATE)",
    oracle: "TRUNC(SYSDATE)",
  },
  current_date: {
    mysql: "CURDATE()",
    postgresql: "CURRENT_DATE",
    sqlite: "date('now')",
    sqlserver: "CAST(GETDATE() AS DATE)",
    oracle: "TRUNC(SYSDATE)",
  },
  curtime: {
    mysql: "CURTIME()",
    postgresql: "CURRENT_TIME",
    sqlite: "time('now')",
    sqlserver: "CAST(GETDATE() AS TIME)",
    oracle: "TO_CHAR(SYSDATE, 'HH24:MI:SS')",
  },
  unix_timestamp: {
    mysql: "UNIX_TIMESTAMP()",
    postgresql: "EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)",
    sqlite: "strftime('%s', 'now')",
    sqlserver: "DATEDIFF(second, '1970-01-01', GETUTCDATE())",
    oracle: "(SYSDATE - DATE '1970-01-01') * 86400",
  },
  getdate: {
    mysql: "NOW()",
    postgresql: "CURRENT_TIMESTAMP",
    sqlite: "datetime('now')",
    sqlserver: "GETDATE()",
    oracle: "SYSDATE",
  },
  sysdate: {
    mysql: "NOW()",
    postgresql: "CURRENT_TIMESTAMP",
    sqlite: "datetime('now')",
    sqlserver: "GETDATE()",
    oracle: "SYSDATE",
  },
  date_format: {
    mysql: "DATE_FORMAT({a})",
    postgresql: "TO_CHAR({a})",
    sqlite: "strftime({a})",
    sqlserver: "FORMAT({a})",
    oracle: "TO_CHAR({a})",
  },
  ifnull: {
    mysql: "IFNULL({a})",
    postgresql: "COALESCE({a})",
    sqlite: "IFNULL({a})",
    sqlserver: "ISNULL({a})",
    oracle: "COALESCE({a})",
  },
  isnull: {
    mysql: "IFNULL({a})",
    postgresql: "COALESCE({a})",
    sqlite: "IFNULL({a})",
    sqlserver: "ISNULL({a})",
    oracle: "COALESCE({a})",
  },
  substr: {
    mysql: "SUBSTRING({a})",
    postgresql: "SUBSTRING({a})",
    sqlite: "SUBSTR({a})",
    sqlserver: "SUBSTRING({a})",
    oracle: "SUBSTR({a})",
  },
  length: {
    mysql: "CHAR_LENGTH({a})",
    postgresql: "LENGTH({a})",
    sqlite: "LENGTH({a})",
    sqlserver: "LEN({a})",
    oracle: "LENGTH({a})",
  },
};

// ---------------------------------------------------------------------------
// String literal & comment extraction (placeholders, restore verbatim)
// ---------------------------------------------------------------------------

export interface Placeholder {
  key: string;
  value: string;
}

/** Extract single-quoted strings and SQL comments, replace with placeholders. */
export function extractLiteralsAndComments(sql: string): { sql: string; tokens: Placeholder[] } {
  const tokens: Placeholder[] = [];
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Single-quote string literal (escape '' inside).
    if (ch === "'") {
      let end = i + 1;
      while (end < sql.length) {
        if (sql[end] === "'") {
          if (sql[end + 1] === "'") { end += 2; continue; }
          end += 1; break;
        }
        end += 1;
      }
      const value = sql.slice(i, end);
      const key = `\u0000S${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    // Double-quoted string literal — only MySQL/SQLServer treat "..." as string
    // (default). For Postgres/Oracle/SQLite "..." is an identifier. We treat
    // double-quotes as opaque tokens here so the quoting rule can handle them.
    if (ch === '"') {
      let end = i + 1;
      while (end < sql.length && sql[end] !== '"') end += 1;
      if (end < sql.length) end += 1;
      const value = sql.slice(i, end);
      const key = `\u0000D${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    // Backtick identifier (MySQL).
    if (ch === "`") {
      let end = i + 1;
      while (end < sql.length && sql[end] !== "`") end += 1;
      if (end < sql.length) end += 1;
      const value = sql.slice(i, end);
      const key = `\u0000B${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    // Square bracket identifier (SQL Server).
    if (ch === "[") {
      let end = i + 1;
      while (end < sql.length && sql[end] !== "]") end += 1;
      if (end < sql.length) end += 1;
      const value = sql.slice(i, end);
      const key = `\u0000Q${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    // Line comment -- ... or # ... (MySQL).
    if (ch === "-" && sql[i + 1] === "-") {
      let end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
      const value = sql.slice(i, end);
      const key = `\u0000L${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    if (ch === "#") {
      let end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
      const value = sql.slice(i, end);
      const key = `\u0000L${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    // Block comment slash-star ... star-slash.
    if (ch === "/" && sql[i + 1] === "*") {
      let end = sql.indexOf("*/", i + 2);
      if (end === -1) end = sql.length; else end += 2;
      const value = sql.slice(i, end);
      const key = `\u0000C${tokens.length}\u0000`;
      tokens.push({ key, value });
      out += key;
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { sql: out, tokens };
}

/** Restore placeholders in the converted SQL back to their original literal/comment text. */
export function restoreLiteralsAndComments(sql: string, tokens: Placeholder[]): string {
  let out = sql;
  for (const t of tokens) {
    out = out.split(t.key).join(t.value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Individual conversion rules (each is pure and testable)
// ---------------------------------------------------------------------------

interface RuleContext {
  from: SqlDialect;
  to: SqlDialect;
}

interface RuleResult {
  sql: string;
  changes: ConversionChange[];
}

/**
 * Rule 1: convert identifier quoting between dialect conventions.
 * Backtick (MySQL) ↔ Double-quote (Postgres/SQLite/Oracle/ANSI) ↔
 * Square bracket (SQL Server).
 *
 * Operates on placeholder-tagged SQL: D-prefixed tokens hold double-quoted
 * identifiers, B-prefixed tokens hold backtick identifiers, Q-prefixed tokens
 * hold bracketed identifiers. We rewrite each to the target's quote style.
 */
export function applyIdentifierQuoting(
  sql: string,
  tokens: Placeholder[],
  ctx: RuleContext,
): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const target = IDENTIFIER_QUOTE[ctx.to];
  const changes: ConversionChange[] = [];
  let changedCount = 0;
  const newTokens = tokens.map((t) => {
    const first = t.value[0];
    const last = t.value[t.value.length - 1];
    let kind: "double" | "backtick" | "bracket" | null = null;
    if (first === "`" && last === "`") kind = "backtick";
    else if (first === '"' && last === '"') kind = "double";
    else if (first === "[" && last === "]") kind = "bracket";
    if (!kind) return t;
    const isFromStyle =
      (kind === "backtick" && ctx.from === "mysql") ||
      (kind === "bracket" && ctx.from === "sqlserver") ||
      (kind === "double" && (ctx.from === "postgresql" || ctx.from === "sqlite" || ctx.from === "oracle"));
    if (!isFromStyle) return t;
    const inner = t.value.slice(1, -1);
    const escaped = target.close === "]"
      ? inner.replace(/]/g, "]]")
      : inner.split(target.close).join(target.close + target.close);
    changedCount += 1;
    return { ...t, value: `${target.open}${escaped}${target.close}` };
  });
  if (changedCount > 0) {
    changes.push({
      severity: "info",
      description: `Converted ${changedCount} identifier quote(s) from ${ctx.from} to ${ctx.to} style.`,
    });
  }
  // Mutate the caller's tokens array so the restore step picks up the new quotes.
  for (let i = 0; i < tokens.length; i++) tokens[i] = newTokens[i];
  return { sql, changes };
}

/**
 * Rule 2: convert data types. Matches TYPE_NAME(p,s) or TYPE_NAME
 * case-insensitively at word boundaries, but only when followed by a non-name
 * char (so VARCHAR2 doesn't match VARCHAR, etc.).
 */
export function convertTypes(sql: string, ctx: RuleContext): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const changes: ConversionChange[] = [];
  let out = sql;
  // Sort by length desc so longer names win (e.g. "longtext" before "text").
  const typeNames = Object.keys(TYPE_MAPPINGS).sort((a, b) => b.length - a.length);
  for (const typeName of typeNames) {
    const mapping = TYPE_MAPPINGS[typeName][ctx.to];
    if (!mapping) continue;
    // Match `TYPE_NAME` optionally followed by (p,s) or (p). Negative
    // lookahead after the type name prevents `int` from matching inside
    // `integer` or `varchar` from matching inside `varchar2`. We deliberately
    // do NOT consume trailing whitespace so the replacement preserves the
    // space between the type and any following tokens (e.g. `INT NOT NULL`).
    const re = new RegExp(`\\b${escapeRegex(typeName)}(?![A-Za-z0-9_$])(\\((\\d+)(?:\\s*,\\s*(\\d+))?\\))?`, "gi");
    out = out.replace(re, (full, parens: string | undefined, p: string | undefined, s: string | undefined) => {
      // Special case: MySQL TINYINT(1) is conventionally a boolean.
      let mapping = TYPE_MAPPINGS[typeName][ctx.to];
      if (typeName === "tinyint" && p === "1" && TYPE_MAPPINGS["boolean"][ctx.to]) {
        mapping = TYPE_MAPPINGS["boolean"][ctx.to];
      }
      if (!mapping) return full;
      let template = mapping.template;
      if (p !== undefined) {
        template = template.replace(/\{p\}/g, p);
        if (s !== undefined) template = template.replace(/\{s\}/g, s);
        else template = template.replace(/,\{s\}/g, "").replace(/\{s\}/g, "");
      } else {
        // No args given — strip {p},{s} placeholders.
        template = template
          .replace(/\(\{p\},\{s\}\)/g, "")
          .replace(/\(\{p\}\)/g, "")
          .replace(/\{p\}/g, "")
          .replace(/\{s\}/g, "");
      }
      changes.push({
        severity: mapping.severity,
        description: mapping.note
          ? `Type ${full} → ${template}. ${mapping.note}`
          : `Type ${full} → ${template}.`,
        before: full,
        after: template,
      });
      return template;
    });
  }
  return { sql: out, changes };
}

/**
 * Rule 3: convert date / scalar functions.
 *  - Functions whose target template contains `{a}` take args: we replace
 *    only the function name and preserve the user's argument list verbatim.
 *  - Functions whose target template has no `{a}` are no-arg: we match
 *    `FUNC_NAME(...)` with no nested parens and replace the whole call
 *    with the target (which may itself contain parens, e.g. `datetime('now')`).
 */
export function convertFunctions(sql: string, ctx: RuleContext): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const changes: ConversionChange[] = [];
  let out = sql;
  // Sort by name length desc so e.g. `current_date` is processed before `curdate`.
  const funcNames = Object.keys(FUNCTION_MAPPINGS).sort((a, b) => b.length - a.length);
  for (const funcName of funcNames) {
    const target = FUNCTION_MAPPINGS[funcName][ctx.to];
    if (!target) continue;
    const takesArgs = target.includes("{a}");
    if (takesArgs) {
      const newName = target.replace(/\{a\}/g, "").replace(/\(\s*\)\s*$/, "").trim();
      const re = new RegExp(`\\b${escapeRegex(funcName)}\\s*\\(`, "gi");
      out = out.replace(re, (match) => {
        changes.push({
          severity: "info",
          description: `Function ${match.replace(/\s*\($/, "").trim()} → ${newName} (args preserved).`,
          before: match.replace(/\s*\($/, "").trim(),
          after: newName,
        });
        return `${newName}(`;
      });
    } else {
      const re = new RegExp(`\\b${escapeRegex(funcName)}\\s*\\(([^()]*)\\)`, "gi");
      out = out.replace(re, (full, args: string) => {
        const trimmed = (args as string).trim();
        if (trimmed !== "") {
          changes.push({
            severity: "warning",
            description: `Function ${funcName}(${args}) → ${target}. Original args ignored; review if needed.`,
            before: full,
            after: target,
          });
        } else {
          changes.push({
            severity: "info",
            description: `Function ${funcName}() → ${target}.`,
            before: full,
            after: target,
          });
        }
        return target;
      });
    }
  }
  return { sql: out, changes };
}

/**
 * Rule 4: convert string concatenation.
 *  - Source uses CONCAT(...) and target prefers || → rewrite CONCAT(a, b, c) → a || b || c
 *  - Source uses || and target is MySQL → rewrite a || b → CONCAT(a, b)
 *  - Source uses || and target is SQL Server → rewrite a || b → CONCAT(a, b)
 *    (SQL Server 2012+ supports CONCAT; safer than + which is type-ambiguous.)
 */
export function convertStringConcat(sql: string, ctx: RuleContext): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const changes: ConversionChange[] = [];
  let out = sql;

  // Target prefers || : postgres, sqlite, oracle.
  const targetUsesPipes = ctx.to === "postgresql" || ctx.to === "sqlite" || ctx.to === "oracle";
  if (targetUsesPipes) {
    // Convert CONCAT(a, b, c) → a || b || c (only top-level, no nested parens).
    const re = /\bCONCAT\s*\(([^()]+)\)/gi;
    let matched = false;
    out = out.replace(re, (_m, args: string) => {
      matched = true;
      const parts = splitTopLevelCommas(args);
      return parts.map((p) => p.trim()).join(" || ");
    });
    if (matched) {
      changes.push({
        severity: "info",
        description: `Converted CONCAT(...) to || string concatenation (${ctx.to} style).`,
      });
    }
  }

  // Source uses || and target is MySQL or SQL Server.
  const sourceUsesPipes = ctx.from === "postgresql" || ctx.from === "sqlite" || ctx.from === "oracle";
  const targetUsesConcat = ctx.to === "mysql" || ctx.to === "sqlserver";
  if (sourceUsesPipes && targetUsesConcat) {
    // Convert a || b → CONCAT(a, b). Naive: split on || outside parens.
    // This is conservative — only simple cases; flagged as warning.
    const re = /([^()\s,]+)\s*\|\|\s*([^()\s,]+)/g;
    let matched = false;
    let prev = out;
    let next = prev.replace(re, (_m, a: string, b: string) => {
      matched = true;
      return `CONCAT(${a.trim()}, ${b.trim()})`;
    });
    // Repeat for chains like a || b || c.
    let iter = 0;
    while (iter < 5 && next !== prev) {
      prev = next;
      next = prev.replace(re, (_m, a: string, b: string) => {
        matched = true;
        return `CONCAT(${a.trim()}, ${b.trim()})`;
      });
      iter += 1;
    }
    out = next;
    if (matched) {
      changes.push({
        severity: "warning",
        description: `Converted || to CONCAT() for ${ctx.to}. Review complex expressions; chained || may need manual rework.`,
      });
    }
  }

  return { sql: out, changes };
}

/**
 * Rule 5: convert AUTO_INCREMENT family.
 *  - MySQL: AUTO_INCREMENT
 *  - Postgres: SERIAL (in column def) or GENERATED AS IDENTITY
 *  - SQLite: AUTOINCREMENT
 *  - SQL Server: IDENTITY(1,1)
 *  - Oracle: GENERATED BY DEFAULT AS IDENTITY
 */
export function convertAutoIncrement(sql: string, ctx: RuleContext): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const changes: ConversionChange[] = [];
  let out = sql;

  // Source MySQL AUTO_INCREMENT → target.
  if (ctx.from === "mysql" && /AUTO_INCREMENT\b/i.test(out)) {
    let replacement = "";
    switch (ctx.to) {
      case "postgresql":
        // Suggest SERIAL — note that the column TYPE must also change to SERIAL.
        replacement = "/* review: use SERIAL or GENERATED BY DEFAULT AS IDENTITY */";
        changes.push({
          severity: "manual",
          description: "AUTO_INCREMENT detected. Postgres uses SERIAL (integer type with implicit sequence) or GENERATED BY DEFAULT AS IDENTITY. Manual column-type review required.",
        });
        break;
      case "sqlite":
        replacement = "AUTOINCREMENT";
        changes.push({ severity: "info", description: "AUTO_INCREMENT → AUTOINCREMENT (SQLite)." });
        break;
      case "sqlserver":
        replacement = "IDENTITY(1,1)";
        changes.push({ severity: "info", description: "AUTO_INCREMENT → IDENTITY(1,1) (SQL Server)." });
        break;
      case "oracle":
        replacement = "GENERATED BY DEFAULT AS IDENTITY";
        changes.push({ severity: "info", description: "AUTO_INCREMENT → GENERATED BY DEFAULT AS IDENTITY (Oracle)." });
        break;
      default:
        replacement = "AUTO_INCREMENT";
    }
    out = out.replace(/\bAUTO_INCREMENT\b/gi, replacement);
  }

  // Source SQLite AUTOINCREMENT → target.
  if (ctx.from === "sqlite" && /\bAUTOINCREMENT\b/i.test(out)) {
    let replacement = "AUTOINCREMENT";
    switch (ctx.to) {
      case "mysql": replacement = "AUTO_INCREMENT"; break;
      case "sqlserver": replacement = "IDENTITY(1,1)"; break;
      case "oracle": replacement = "GENERATED BY DEFAULT AS IDENTITY"; break;
      case "postgresql":
        replacement = "/* review: use SERIAL */";
        break;
    }
    if (replacement !== "AUTOINCREMENT") {
      changes.push({
        severity: ctx.to === "postgresql" ? "manual" : "info",
        description: `AUTOINCREMENT → ${replacement}.`,
      });
      out = out.replace(/\bAUTOINCREMENT\b/gi, replacement);
    }
  }

  // Source SQL Server IDENTITY(1,1) → target.
  if (ctx.from === "sqlserver" && /\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/i.test(out)) {
    let replacement = "IDENTITY(1,1)";
    switch (ctx.to) {
      case "mysql": replacement = "AUTO_INCREMENT"; break;
      case "sqlite": replacement = "AUTOINCREMENT"; break;
      case "oracle": replacement = "GENERATED BY DEFAULT AS IDENTITY"; break;
      case "postgresql":
        replacement = "/* review: use SERIAL */";
        break;
    }
    if (replacement !== "IDENTITY(1,1)") {
      changes.push({
        severity: ctx.to === "postgresql" ? "manual" : "info",
        description: `IDENTITY(...) → ${replacement}.`,
      });
      out = out.replace(/\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, replacement);
    }
  }

  return { sql: out, changes };
}

/**
 * Rule 6: convert LIMIT/OFFSET.
 *  - Source has LIMIT n [OFFSET m] (mysql, postgres, sqlite)
 *  - Target SQL Server: SELECT TOP n ... ; OFFSET requires ORDER BY + OFFSET/FETCH.
 *  - Target Oracle: wrap with ROWNUM <= n in WHERE; OFFSET requires subquery.
 *
 * Conservative: only handles simple `LIMIT n` and `LIMIT n OFFSET m` at end of
 * statement. Complex cases (subqueries, expressions) are flagged manual.
 */
export function convertLimit(sql: string, ctx: RuleContext): RuleResult {
  if (ctx.from === ctx.to) return { sql, changes: [] };
  const changes: ConversionChange[] = [];
  let out = sql;

  // Target SQL Server.
  if (ctx.to === "sqlserver" && /\bLIMIT\b/i.test(out)) {
    // Convert `LIMIT n` (no OFFSET) → `TOP n` right after SELECT.
    const limitRe = /\bLIMIT\s+(\d+|\?|:[\w$]+)\s*$/i;
    const limitOffsetRe = /\bLIMIT\s+(\d+|\?|:[\w$]+)\s+OFFSET\s+(\d+|\?|:[\w$]+)\s*$/i;
    const mOff = out.match(limitOffsetRe);
    const mSimple = out.match(limitRe);
    if (mOff) {
      const n = mOff[1];
      const offsetVal = mOff[2];
      // Replace trailing LIMIT n OFFSET m with OFFSET m ROWS FETCH NEXT n ROWS ONLY.
      out = out.slice(0, mOff.index) + `OFFSET ${offsetVal} ROWS FETCH NEXT ${n} ROWS ONLY`;
      changes.push({
        severity: "warning",
        description: `LIMIT ${n} OFFSET ${offsetVal} → OFFSET ${offsetVal} ROWS FETCH NEXT ${n} ROWS ONLY (SQL Server 2012+; requires ORDER BY clause).`,
      });
    } else if (mSimple) {
      const n = mSimple[1];
      // Insert TOP n after the first SELECT keyword.
      out = out.slice(0, mSimple.index).replace(/(\bSELECT\b\s*)(DISTINCT\s*)?/i, (full, sel, dist) => {
        return `${sel}${dist ?? ""}TOP ${n} `;
      });
      changes.push({
        severity: "info",
        description: `LIMIT ${n} → TOP ${n} (SQL Server).`,
      });
    } else {
      changes.push({
        severity: "manual",
        description: "Complex LIMIT expression detected; review manually for SQL Server TOP / OFFSET-FETCH conversion.",
      });
    }
  }

  // Target Oracle.
  if (ctx.to === "oracle" && /\bLIMIT\b/i.test(out)) {
    const limitRe = /\bLIMIT\s+(\d+|\?|:[\w$]+)\s*$/i;
    const limitOffsetRe = /\bLIMIT\s+(\d+|\?|:[\w$]+)\s+OFFSET\s+(\d+|\?|:[\w$]+)\s*$/i;
    const mOff = out.match(limitOffsetRe);
    const mSimple = out.match(limitRe);
    if (mOff) {
      changes.push({
        severity: "manual",
        description: `LIMIT ${mOff[1]} OFFSET ${mOff[2]} requires a subquery in Oracle (ROWNUM cannot express offset). Review manually.`,
      });
      // Leave the LIMIT clause in place but commented.
      out = out.slice(0, mOff.index) + `/* original: LIMIT ${mOff[1]} OFFSET ${mOff[2]} — review for Oracle ROWNUM subquery */`;
    } else if (mSimple) {
      const n = mSimple[1];
      // Append `AND ROWNUM <= n` if WHERE exists, else `WHERE ROWNUM <= n`.
      const beforeLimit = out.slice(0, mSimple.index);
      if (/\bWHERE\b/i.test(beforeLimit)) {
        out = `${beforeLimit} AND ROWNUM <= ${n}`;
      } else {
        out = `${beforeLimit} WHERE ROWNUM <= ${n}`;
      }
      changes.push({
        severity: "warning",
        description: `LIMIT ${n} → WHERE ROWNUM <= ${n} (Oracle). Note: ROWNUM applies before ORDER BY; use a subquery if ordering matters.`,
      });
    } else {
      changes.push({
        severity: "manual",
        description: "Complex LIMIT expression detected; review manually for Oracle ROWNUM conversion.",
      });
    }
  }

  return { sql: out, changes };
}

/**
 * Rule 7: detect unsupported constructs that have no clean dialect mapping.
 * Flags them with severity 'manual' but does not modify the SQL.
 */
export function detectUnsupportedConstructs(sql: string, ctx: RuleContext): ConversionChange[] {
  if (ctx.from === ctx.to) return [];
  const changes: ConversionChange[] = [];
  // Stored procedures / functions / triggers.
  if (/\b(CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|TRIGGER))\b/i.test(sql)) {
    changes.push({
      severity: "manual",
      description: "Stored procedure / function / trigger body cannot be safely auto-converted between dialects. Manual review required.",
    });
  }
  // Spatial types.
  if (/\b(GEOMETRY|POINT|POLYGON|GEOGRAPHY)\b/i.test(sql)) {
    changes.push({
      severity: "manual",
      description: "Spatial types differ significantly across dialects (PostGIS vs. SQL Server geography vs. Oracle SDO). Manual review required.",
    });
  }
  // UNSIGNED integer (MySQL-specific).
  if (/\bUNSIGNED\b/i.test(sql) && ctx.to !== "mysql") {
    changes.push({
      severity: "warning",
      description: "UNSIGNED is MySQL-specific. Other dialects lack it — the column will accept negative values. Consider adding a CHECK constraint.",
    });
  }
  // MySQL-specific SHOW commands.
  if (/^\s*SHOW\s+/im.test(sql)) {
    changes.push({
      severity: "manual",
      description: "MySQL SHOW commands have no direct equivalent in other dialects. Manual review required.",
    });
  }
  // Oracle PL/SQL blocks.
  if (/\bBEGIN\s+/i.test(sql) && /\bEND\s*;/i.test(sql) && ctx.to !== "oracle") {
    changes.push({
      severity: "manual",
      description: "PL/SQL anonymous blocks cannot be safely auto-converted. Manual review required.",
    });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function convertSql(input: string, from: SqlDialect, to: SqlDialect): ConversionOutcome {
  if (!input || !input.trim()) {
    return { ok: false, error: "Input SQL is empty." };
  }
  if (from === to) {
    return { ok: true, output: input, changes: [] };
  }

  // 1. Extract literals / comments → placeholders.
  const { sql: stripped, tokens } = extractLiteralsAndComments(input);
  let sql = stripped;
  const allChanges: ConversionChange[] = [];

  // 2. Identifier quoting (mutates tokens array in place).
  const q = applyIdentifierQuoting(sql, tokens, { from, to });
  allChanges.push(...q.changes);

  // 3. Type conversions.
  const t = convertTypes(sql, { from, to });
  sql = t.sql;
  allChanges.push(...t.changes);

  // 4. Function conversions.
  const f = convertFunctions(sql, { from, to });
  sql = f.sql;
  allChanges.push(...f.changes);

  // 5. String concat.
  const sc = convertStringConcat(sql, { from, to });
  sql = sc.sql;
  allChanges.push(...sc.changes);

  // 6. AUTO_INCREMENT.
  const ai = convertAutoIncrement(sql, { from, to });
  sql = ai.sql;
  allChanges.push(...ai.changes);

  // 7. LIMIT / OFFSET.
  const lim = convertLimit(sql, { from, to });
  sql = lim.sql;
  allChanges.push(...lim.changes);

  // 8. Unsupported-construct detection.
  const unsupported = detectUnsupportedConstructs(input, { from, to });
  allChanges.push(...unsupported);

  // 9. Restore literals / comments.
  const output = restoreLiteralsAndComments(sql, tokens);

  return { ok: true, output, changes: allChanges };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a comma-separated arg list at top-level commas (not inside parens). */
export function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() || out.length > 0) out.push(cur);
  return out;
}

/** Count how many manual-review changes a result has. */
export function countManualReviews(changes: ConversionChange[]): number {
  return changes.filter((c) => c.severity === "manual").length;
}

/** Render change log as plain text for download / copy. */
export function renderChangeLog(changes: ConversionChange[]): string {
  const lines: string[] = ["# Conversion change log", ""];
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    lines.push(`${i + 1}. [${c.severity.toUpperCase()}] ${c.description}`);
    if (c.before) lines.push(`   before: ${c.before}`);
    if (c.after) lines.push(`   after:  ${c.after}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface ConversionPreset {
  id: string;
  label: string;
  from: SqlDialect;
  to: SqlDialect;
  sql: string;
}

export const PRESETS: ConversionPreset[] = [
  {
    id: "mysql-to-postgres-ddl",
    label: "MySQL → PostgreSQL DDL",
    from: "mysql",
    to: "postgresql",
    sql:
`CREATE TABLE \`users\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`email\` VARCHAR(255) NOT NULL,
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`created_at\` DATETIME DEFAULT NOW(),
  \`bio\` TEXT,
  PRIMARY KEY (\`id\`)
);
SELECT * FROM \`users\` WHERE \`created_at\` > NOW() - INTERVAL 7 DAY LIMIT 10;`,
  },
  {
    id: "postgres-to-sqlserver",
    label: "PostgreSQL → SQL Server",
    from: "postgresql",
    to: "sqlserver",
    sql:
`SELECT "u"."name", COUNT("o"."id") AS "order_count"
FROM "users" "u"
LEFT JOIN "orders" "o" ON "u"."id" = "o"."user_id"
WHERE "u"."created_at" > NOW()
GROUP BY "u"."name"
ORDER BY "order_count" DESC
LIMIT 50;`,
  },
  {
    id: "mysql-to-oracle",
    label: "MySQL → Oracle DML",
    from: "mysql",
    to: "oracle",
    sql:
`SELECT \`id\`, \`name\`, CONCAT(\`first\`, ' ', \`last\`) AS \`full_name\`
FROM \`users\`
WHERE \`status\` = 'active' AND \`id\` < 1000
ORDER BY \`id\` DESC
LIMIT 100;`,
  },
];

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-dialect-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  from: SqlDialect;
  to: SqlDialect;
  inputPreview: string;
  outputPreview: string;
  changeCount: number;
  manualReviewCount: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (fragment-encoded from/to + input)
// ---------------------------------------------------------------------------

export function encodeState(input: string, from: SqlDialect, to: SqlDialect): string {
  const json = JSON.stringify({ i: input, f: from, t: to });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeState(encoded: string): { input: string; from: SqlDialect; to: SqlDialect } | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || typeof data.i !== "string") return null;
    return {
      input: data.i,
      from: data.f as SqlDialect,
      to: data.t as SqlDialect,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(input: string, from: SqlDialect, to: SqlDialect): string {
  const encoded = encodeState(input, from, to);
  const params = new URLSearchParams();
  params.set("c", encoded);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; from: SqlDialect; to: SqlDialect } | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const c = params.get("c");
  if (!c) return null;
  return decodeState(c);
}
