/**
 * SQL DDL to ER Diagram Generator — pure logic.
 *
 * Parses CREATE TABLE / ALTER TABLE DDL across dialects (MySQL, PostgreSQL,
 * SQLite, SQL Server, ANSI) into a SchemaModel and renders it as a Mermaid
 * erDiagram, ASCII crow's-foot diagram, and DBML.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Dialect = "ansi" | "mysql" | "postgres" | "sqlite" | "sqlserver";

export const DIALECTS: Dialect[] = [
  "ansi", "mysql", "postgres", "sqlite", "sqlserver",
];

export const DIALECT_LABELS: Record<Dialect, string> = {
  ansi: "ANSI SQL",
  mysql: "MySQL / MariaDB",
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  sqlserver: "SQL Server",
};

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue: string | null;
  /** Inline REFERENCES clause on this column (table-level FKs go on Table.foreignKeys). */
  references?: { table: string; column: string };
  /** True if the column was declared inline UNIQUE. */
  inlineUnique?: boolean;
  /** Inline CHECK expression (text inside the parens). */
  check?: string;
}

export interface ForeignKey {
  /** Stable id like `fk_posts_author_id_users_id`. */
  id: string;
  /** Optional constraint name. */
  name?: string;
  /** The table that owns this FK (set when attached to a Table). */
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  /** Detected in the parser — used to skip emitting it twice (inline + table-level). */
  inline?: boolean;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  indexes: TableIndex[];
  uniqueConstraints: { name?: string; columns: string[] }[];
  checks: { name?: string; expr: string }[];
  rawComment?: string;
}

export interface SchemaModel {
  tables: Table[];
  /** Dialect hint detected from the DDL (best-effort). */
  dialectHint?: Dialect;
}

/** Cardinality for one side of a relationship (Mermaid erDiagram notation). */
export type Cardinality =
  | "||"
  | "o|"
  | "}o"
  | "}|"
  | "|o"
  | "o{"
  | "|{";
// (Kept as a string union for flexibility — Mermaid accepts these tokens.)

export type CardinalitySide =
  | "one"
  | "zero-or-one"
  | "zero-or-more"
  | "one-or-more";

export interface Relationship {
  id: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  /** Inferred from nullability + uniqueness of the FK columns. */
  fromCardinality: CardinalitySide;
  toCardinality: CardinalitySide;
  /** Source: explicit FK or naming-inference. */
  source: "explicit" | "inferred";
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  table?: string;
}

export interface ParseOptions {
  /** Infer FK relationships from `<singular>_id` column naming when no explicit FK exists. */
  inferFromNaming?: boolean;
  /** Override dialect detection. */
  dialect?: Dialect;
}

export interface ParseResult {
  model: SchemaModel;
  issues: ValidationIssue[];
  /** Number of statements parsed. */
  statementCount: number;
}

export interface MermaidErdOptions {
  /** Show column types. */
  showTypes?: boolean;
  /** Show FK labels on edges. */
  showLabels?: boolean;
}

// ---------------------------------------------------------------------------
// Comment stripping & statement splitting
// ---------------------------------------------------------------------------

/**
 * Strip SQL comments. Handles double-dash line comments, MySQL hash
 * comments, and block comments (including nested ones for Postgres).
 * String literals ('...') and quoted identifiers ("..." / `...` / [...])
 * are preserved verbatim.
 */
export function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1] ?? "";
    // Single-quote string
    if (ch === "'") {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === "'") {
          // doubled quote = escaped
          if (sql[i] === "'") { out += sql[i]; i++; continue; }
          break;
        }
      }
      continue;
    }
    // Double-quote identifier (could be a string in MySQL — treat as identifier here)
    if (ch === '"') {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === '"') {
          if (sql[i] === '"') { out += sql[i]; i++; continue; }
          break;
        }
      }
      continue;
    }
    // Backtick identifier
    if (ch === "`") {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === "`") {
          if (sql[i] === "`") { out += sql[i]; i++; continue; }
          break;
        }
      }
      continue;
    }
    // Bracket identifier [foo]
    if (ch === "[") {
      out += ch; i++;
      while (i < n && sql[i] !== "]") { out += sql[i]; i++; }
      if (i < n) { out += sql[i]; i++; }
      continue;
    }
    // Line comment --
    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    // MySQL hash comment
    if (ch === "#") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    // Block comment (with nesting support)
    if (ch === "/" && next === "*") {
      let depth = 1; i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") { depth++; i += 2; }
        else if (sql[i] === "*" && sql[i + 1] === "/") { depth--; i += 2; }
        else { i++; }
      }
      out += " ";
      continue;
    }
    out += ch; i++;
  }
  return out;
}

/** Split DDL into top-level statements on semicolons (string/identifier-aware). */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      buf += ch; i++;
      while (i < n) {
        buf += sql[i];
        if (sql[i] === "'") {
          i++;
          if (sql[i] === "'") { buf += sql[i]; i++; continue; }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === '"') {
      buf += ch; i++;
      while (i < n) {
        buf += sql[i];
        if (sql[i] === '"') {
          i++;
          if (sql[i] === '"') { buf += sql[i]; i++; continue; }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "`") {
      buf += ch; i++;
      while (i < n) {
        buf += sql[i];
        if (sql[i] === "`") {
          i++;
          if (sql[i] === "`") { buf += sql[i]; i++; continue; }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "[") {
      buf += ch; i++;
      while (i < n && sql[i] !== "]") { buf += sql[i]; i++; }
      if (i < n) { buf += sql[i]; i++; }
      continue;
    }
    if (ch === ";") {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = ""; i++;
      continue;
    }
    buf += ch; i++;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

/** Strip surrounding quotes / brackets from an identifier. */
export function normalizeIdentifier(s: string): string {
  if (!s) return s;
  const t = s.trim();
  if (t.length >= 2) {
    if (t[0] === '"' && t[t.length - 1] === '"') return t.slice(1, -1).split('""').join('"');
    if (t[0] === "`" && t[t.length - 1] === "`") return t.slice(1, -1).split("``").join("`");
    if (t[0] === "[" && t[t.length - 1] === "]") return t.slice(1, -1).split("]]").join("]");
  }
  return t;
}

/** Split `schema.table` into its parts (both normalized). */
export function splitQualified(s: string): { schema?: string; name: string } {
  const parts = s.split(".");
  if (parts.length === 1) return { name: normalizeIdentifier(parts[0]) };
  if (parts.length === 2) return { schema: normalizeIdentifier(parts[0]), name: normalizeIdentifier(parts[1]) };
  // >2 parts: keep all but first as the name (best-effort)
  return { schema: normalizeIdentifier(parts[0]), name: parts.slice(1).map(normalizeIdentifier).join(".") };
}

// ---------------------------------------------------------------------------
// CREATE TABLE parsing
// ---------------------------------------------------------------------------

const MULTI_WORD_TYPES: string[] = [
  "CHARACTER VARYING", "CHAR VARYING", "DOUBLE PRECISION",
  "TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP WITH TIME ZONE",
  "TIME WITHOUT TIME ZONE", "TIME WITH TIME ZONE",
  "BIT VARYING", "NATIONAL CHARACTER", "NATIONAL CHAR",
  "CHARACTER LARGE OBJECT", "BINARY LARGE OBJECT",
];

/** Match the column-type token at the start of `s` (after the column name). */
export function matchType(s: string): { type: string; rest: string } | null {
  const upper = s.toUpperCase();
  for (const t of MULTI_WORD_TYPES) {
    if (upper.startsWith(t + " ") || upper.startsWith(t + "(")) {
      const type = s.slice(0, t.length);
      const rest = s.slice(t.length);
      return { type, rest };
    }
    if (upper === t) return { type: s, rest: "" };
  }
  // Single-word type
  const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*\s*(?:\([^)]*\))?)/);
  if (!m) return null;
  // Strip trailing whitespace inside the type token
  return { type: m[1].trim(), rest: s.slice(m[1].length) };
}

/** Split a comma-separated column/constraint list at top-level commas. */
export function splitColumnList(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === "'") {
      buf += ch; i++;
      while (i < n) {
        buf += s[i];
        if (s[i] === "'") { i++; if (s[i] === "'") { buf += s[i]; i++; continue; } break; }
        i++;
      }
      continue;
    }
    if (ch === '"') {
      buf += ch; i++;
      while (i < n) {
        buf += s[i];
        if (s[i] === '"') { i++; if (s[i] === '"') { buf += s[i]; i++; continue; } break; }
        i++;
      }
      continue;
    }
    if (ch === "`") {
      buf += ch; i++;
      while (i < n) {
        buf += s[i];
        if (s[i] === "`") { i++; if (s[i] === "`") { buf += s[i]; i++; continue; } break; }
        i++;
      }
      continue;
    }
    if (ch === "[") {
      buf += ch; i++;
      while (i < n && s[i] !== "]") { buf += s[i]; i++; }
      if (i < n) { buf += s[i]; i++; }
      continue;
    }
    if (ch === "(") { depth++; buf += ch; i++; continue; }
    if (ch === ")") { depth--; buf += ch; i++; continue; }
    if (ch === "," && depth === 0) {
      const part = buf.trim();
      if (part) out.push(part);
      buf = ""; i++;
      continue;
    }
    buf += ch; i++;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

/** Find the matching closing paren for the open paren at position `start`. */
export function findMatchingParen(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const KEYWORD_PRIMARY_KEY = /^\s*PRIMARY\s+KEY\b/i;
const KEYWORD_FOREIGN_KEY = /^\s*(?:CONSTRAINT\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+)?FOREIGN\s+KEY\b/i;
const KEYWORD_UNIQUE = /^\s*(?:CONSTRAINT\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+)?UNIQUE\b/i;
const KEYWORD_CHECK = /^\s*(?:CONSTRAINT\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+)?CHECK\b/i;
const KEYWORD_INDEX = /^\s*(?:UNIQUE\s+)?(?:INDEX|KEY)\b/i;

interface ConstraintNameRef { name?: string; rest: string; }

/** Strip a leading CONSTRAINT <name> from `s` and return the name + remainder. */
export function stripConstraintName(s: string): ConstraintNameRef {
  const m = s.match(/^\s*CONSTRAINT\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+/i);
  if (m) return { name: normalizeIdentifier(m[1]), rest: s.slice(m[0].length) };
  return { rest: s };
}

/** Extract a column-list parenthesized group from `s` like `(a, b, c)`. */
export function extractColumnList(s: string): { columns: string[]; rest: string } | null {
  const m = s.match(/^\s*\(/);
  if (!m) return null;
  const start = s.indexOf("(");
  const end = findMatchingParen(s, start);
  if (end === -1) return null;
  const inside = s.slice(start + 1, end);
  const rest = s.slice(end + 1);
  const columns = splitColumnList(inside).map((p) => normalizeIdentifier(p.trim()));
  return { columns, rest };
}

/** Parse a column definition (the part inside the parens of CREATE TABLE). */
export function parseColumnDefinition(def: string): Column {
  // Match: <name> <type> ...rest (use [\s\S] to match newlines without the 's' flag, since target is ES2017)
  const headerMatch = def.match(
    /^\s*("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+([\s\S]*)$/,
  );
  const col: Column = {
    name: "",
    type: "UNKNOWN",
    nullable: true,
    primaryKey: false,
    unique: false,
    autoIncrement: false,
    defaultValue: null,
  };
  if (!headerMatch) {
    col.name = normalizeIdentifier(def.trim());
    return col;
  }
  col.name = normalizeIdentifier(headerMatch[1]);
  const typeAndRest = headerMatch[2];
  let rest: string;
  const typeMatch = matchType(typeAndRest);
  if (typeMatch) {
    col.type = typeMatch.type.trim();
    rest = typeMatch.rest;
  } else {
    // No type — unusual but tolerate
    rest = typeAndRest;
  }
  if (/PRIMARY\s+KEY/i.test(rest)) {
    col.primaryKey = true;
    col.nullable = false;
  }
  if (/\bUNIQUE\b/i.test(rest)) {
    // inline UNIQUE on the column (table-level UNIQUE constraints are parsed separately)
    col.unique = true;
    col.inlineUnique = true;
  }
  if (/\bNOT\s+NULL\b/i.test(rest)) col.nullable = false;
  if (/\bNULL\b/i.test(rest) && !/\bNOT\s+NULL\b/i.test(rest)) col.nullable = true;
  if (/\bAUTO_INCREMENT\b/i.test(rest) || /\bAUTOINCREMENT\b/i.test(rest)) {
    col.autoIncrement = true;
  }
  const defMatch = rest.match(/DEFAULT\s+('(?:''|[^'])*'|"[^"]*"|\w+(?:\([^)]*\))?)/i);
  if (defMatch) col.defaultValue = defMatch[1];
  // Inline CHECK — capture the parenthesized expression with findMatchingParen
  const checkIdx = rest.search(/\bCHECK\b/i);
  if (checkIdx !== -1) {
    const parenStart = rest.indexOf("(", checkIdx);
    if (parenStart !== -1) {
      const parenEnd = findMatchingParen(rest, parenStart);
      if (parenEnd !== -1) col.check = rest.slice(parenStart + 1, parenEnd);
    }
  }
  // Inline REFERENCES
  const refMatch = rest.match(/REFERENCES\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)\s*(\([^)]*\))?/i);
  if (refMatch) {
    const refTableRaw = refMatch[1];
    const refColRaw = refMatch[2] ?? "";
    const refTable = normalizeIdentifier(refTableRaw);
    let refCol = "id";
    if (refColRaw) {
      refCol = refColRaw.slice(1, -1).trim();
      refCol = normalizeIdentifier(refCol.split(",")[0].trim());
    } else {
      // Default to the same column name on the referenced table's PK (assume id)
      refCol = col.name.endsWith("_id") ? "id" : "id";
    }
    col.references = { table: refTable, column: refCol };
  }
  return col;
}

/** Parse a CREATE TABLE statement (the full statement). */
export function parseCreateTable(stmt: string): Table | null {
  // Header: CREATE TABLE [IF NOT EXISTS] [schema.]table ( ... )
  const headerRe = /^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)/i;
  const headerMatch = stmt.match(headerRe);
  if (!headerMatch) return null;
  const fullName = normalizeIdentifier(headerMatch[1]);
  const { schema, name } = splitQualified(fullName);
  const table: Table = {
    name,
    schema,
    columns: [],
    primaryKeys: [],
    foreignKeys: [],
    indexes: [],
    uniqueConstraints: [],
    checks: [],
  };
  // Find the first ( after the table name
  const parenStart = stmt.indexOf("(", headerMatch.index! + headerMatch[0].length);
  if (parenStart === -1) return table;
  const parenEnd = findMatchingParen(stmt, parenStart);
  if (parenEnd === -1) return table;
  const inside = stmt.slice(parenStart + 1, parenEnd);
  // Tail after ) may contain table-level options (ENGINE=, etc.) — ignore
  const parts = splitColumnList(inside);
  for (const part of parts) {
    const trimmed = part.trim();
    if (KEYWORD_PRIMARY_KEY.test(trimmed)) {
      const after = trimmed.replace(KEYWORD_PRIMARY_KEY, "");
      const cols = extractColumnList(after);
      if (cols) {
        table.primaryKeys.push(...cols.columns);
        for (const c of cols.columns) {
          const existing = table.columns.find((cc) => cc.name === c);
          if (existing) {
            existing.primaryKey = true;
            existing.nullable = false;
          }
        }
      }
      continue;
    }
    if (KEYWORD_FOREIGN_KEY.test(trimmed)) {
      const named = stripConstraintName(trimmed);
      const after = named.rest.replace(/^\s*FOREIGN\s+KEY\b/i, "");
      const cols = extractColumnList(after);
      if (!cols) continue;
      const refMatch = cols.rest.match(/REFERENCES\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)\s*(\([^)]*\))?/i);
      if (!refMatch) continue;
      const refTable = normalizeIdentifier(refMatch[1]);
      let refCols: string[] = ["id"];
      if (refMatch[2]) {
        refCols = refMatch[2].slice(1, -1).split(",").map((s) => normalizeIdentifier(s.trim()));
      } else if (cols.columns.length === 1) {
        refCols = [cols.columns[0].endsWith("_id") ? "id" : "id"];
      }
      table.foreignKeys.push({
        id: `fk_${table.name}_${cols.columns.join("_")}_${refTable}_${refCols.join("_")}`,
        name: named.name,
        fromTable: table.name,
        fromColumns: cols.columns,
        toTable: refTable,
        toColumns: refCols,
      });
      continue;
    }
    if (KEYWORD_UNIQUE.test(trimmed)) {
      const named = stripConstraintName(trimmed);
      const after = named.rest.replace(/^\s*UNIQUE\b/i, "");
      const cols = extractColumnList(after);
      if (cols) {
        table.uniqueConstraints.push({ name: named.name, columns: cols.columns });
        // If single-column UNIQUE, mirror onto the column
        if (cols.columns.length === 1) {
          const c = table.columns.find((cc) => cc.name === cols.columns[0]);
          if (c && !c.inlineUnique) c.unique = true;
        }
      }
      continue;
    }
    if (KEYWORD_CHECK.test(trimmed)) {
      const named = stripConstraintName(trimmed);
      const after = named.rest.replace(/^\s*CHECK\b/i, "").trim();
      // Capture the parenthesized expression
      const start = after.indexOf("(");
      const end = start === -1 ? -1 : findMatchingParen(after, start);
      const expr = end === -1 ? after : after.slice(start + 1, end);
      table.checks.push({ name: named.name, expr });
      continue;
    }
    if (KEYWORD_INDEX.test(trimmed)) {
      const m = trimmed.match(/^\s*(UNIQUE\s+)?(?:INDEX|KEY)\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s*/i);
      if (m) {
        const after = trimmed.slice(m[0].length);
        const cols = extractColumnList(after);
        if (cols) {
          table.indexes.push({
            name: `idx_${table.name}_${cols.columns.join("_")}`,
            columns: cols.columns,
            unique: !!m[1],
          });
        }
      }
      continue;
    }
    // Regular column
    const col = parseColumnDefinition(trimmed);
    table.columns.push(col);
    if (col.check) table.checks.push({ expr: col.check });
    if (col.references) {
      // Inline FK on the column
      table.foreignKeys.push({
        id: `fk_${table.name}_${col.name}_${col.references.table}_${col.references.column}`,
        fromTable: table.name,
        fromColumns: [col.name],
        toTable: col.references.table,
        toColumns: [col.references.column],
        inline: true,
      });
    }
  }
  return table;
}

/** Parse an ALTER TABLE ... ADD FOREIGN KEY statement. */
export function parseAlterTable(stmt: string): { table: string; fks: ForeignKey[] } | null {
  const headerRe = /^ALTER\s+TABLE\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)\s+/i;
  const m = stmt.match(headerRe);
  if (!m) return null;
  const table = splitQualified(normalizeIdentifier(m[1])).name;
  // Find ADD FOREIGN KEY (may be multiple)
  const fks: ForeignKey[] = [];
  const fkRe = /ADD\s+(?:CONSTRAINT\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+)?FOREIGN\s+KEY\s*(\([^)]*\))\s+REFERENCES\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)\s*(\([^)]*\))?/gi;
  let fkMatch: RegExpExecArray | null;
  while ((fkMatch = fkRe.exec(stmt)) !== null) {
    const fromCols = fkMatch[1].slice(1, -1).split(",").map((s) => normalizeIdentifier(s.trim()));
    const toTable = normalizeIdentifier(fkMatch[2]);
    let toCols: string[];
    if (fkMatch[3]) {
      toCols = fkMatch[3].slice(1, -1).split(",").map((s) => normalizeIdentifier(s.trim()));
    } else if (fromCols.length === 1) {
      toCols = ["id"];
    } else {
      toCols = fromCols.map(() => "id");
    }
    fks.push({
      id: `fk_${table}_${fromCols.join("_")}_${toTable}_${toCols.join("_")}`,
      fromTable: table,
      fromColumns: fromCols,
      toTable,
      toColumns: toCols,
    });
  }
  if (fks.length === 0) return { table, fks: [] };
  return { table, fks };
}

/** Parse a CREATE INDEX statement. */
export function parseCreateIndex(stmt: string): { table: string; index: TableIndex } | null {
  const m = stmt.match(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+ON\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+(?:\.\w+)?)\s*(\([^)]*\))/i,
  );
  if (!m) return null;
  const table = splitQualified(normalizeIdentifier(m[2])).name;
  const cols = m[3].slice(1, -1).split(",").map((s) => normalizeIdentifier(s.trim().split(/\s+/)[0]));
  return {
    table,
    index: {
      name: m[1] ? `uniq_${table}_${cols.join("_")}` : `idx_${table}_${cols.join("_")}`,
      columns: cols,
      unique: !!m[1],
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level parse
// ---------------------------------------------------------------------------

/** Detect a dialect hint from the DDL (best-effort). */
export function detectDialect(sql: string): Dialect {
  const upper = sql.toUpperCase();
  if (/ENGINE\s*=\s*InnoDB/i.test(sql) || /\bMEDIUMINT\b/i.test(upper) || /`\w+`/.test(sql)) {
    return "mysql";
  }
  if (/\bSERIAL\b/i.test(upper) || /\bTIMESTAMP\s+WITH(?:OUT)?\s+TIME\s+ZONE\b/i.test(upper)) {
    return "postgres";
  }
  if (/\bIDENTITY\s*\(\s*1\s*,\s*1\s*\)/i.test(sql) || /\[\w+\]/.test(sql) || /\bTOP\s+\d+/i.test(sql)) {
    return "sqlserver";
  }
  if (/\bAUTOINCREMENT\b/i.test(upper)) {
    return "sqlite";
  }
  return "ansi";
}

export function parseDdl(sql: string, options?: ParseOptions): ParseResult {
  const cleaned = stripComments(sql);
  const stmts = splitStatements(cleaned).filter(Boolean);
  const tables = new Map<string, Table>();
  const issues: ValidationIssue[] = [];
  const dialectHint = options?.dialect ?? detectDialect(sql);

  for (const stmt of stmts) {
    const upper = stmt.toUpperCase();
    if (upper.startsWith("CREATE") && /CREATE\s+TABLE/i.test(upper)) {
      const t = parseCreateTable(stmt);
      if (t) tables.set(t.name, t);
    } else if (upper.startsWith("ALTER")) {
      const alt = parseAlterTable(stmt);
      if (alt && alt.fks.length > 0) {
        const t = tables.get(alt.table);
        if (t) {
          for (const fk of alt.fks) t.foreignKeys.push(fk);
        } else {
          issues.push({
            severity: "warning",
            message: `ALTER TABLE targets unknown table "${alt.table}"`,
            table: alt.table,
          });
        }
      }
    } else if (upper.startsWith("CREATE") && /CREATE\s+(UNIQUE\s+)?INDEX/i.test(upper)) {
      const idx = parseCreateIndex(stmt);
      if (idx) {
        const t = tables.get(idx.table);
        if (t) {
          // Avoid duplicates
          if (!t.indexes.some((i) => i.columns.join(",") === idx.index.columns.join(",") && i.unique === idx.index.unique)) {
            t.indexes.push(idx.index);
          }
        } else {
          issues.push({
            severity: "warning",
            message: `CREATE INDEX targets unknown table "${idx.table}"`,
            table: idx.table,
          });
        }
      }
    }
    // Ignore DROP / INSERT / etc.
  }

  const model: SchemaModel = { tables: Array.from(tables.values()), dialectHint };

  // De-duplicate FKs (inline + table-level may produce the same edge)
  for (const t of model.tables) {
    const seen = new Set<string>();
    t.foreignKeys = t.foreignKeys.filter((fk) => {
      const key = `${fk.fromColumns.join(",")}→${fk.toTable}.${fk.toColumns.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Validation: orphan FK targets, missing PK, single-PK with auto-increment
  const tableNames = new Set(model.tables.map((t) => t.name));
  for (const t of model.tables) {
    for (const fk of t.foreignKeys) {
      if (!tableNames.has(fk.toTable)) {
        issues.push({
          severity: "warning",
          message: `Foreign key on "${t.name}" references unknown table "${fk.toTable}"`,
          table: t.name,
        });
      }
    }
    if (t.primaryKeys.length === 0 && !t.columns.some((c) => c.primaryKey)) {
      issues.push({
        severity: "info",
        message: `Table "${t.name}" has no primary key`,
        table: t.name,
      });
    }
    if (t.checks.length > 0) {
      issues.push({
        severity: "info",
        message: `Table "${t.name}" has ${t.checks.length} CHECK constraint(s) — not interpreted`,
        table: t.name,
      });
    }
  }

  // Naming-based inference (optional)
  if (options?.inferFromNaming) {
    const inferred = inferRelationshipsFromNaming(model);
    for (const rel of inferred) {
      const exists = model.tables
        .find((t) => t.name === rel.fromTable)
        ?.foreignKeys.some((fk) => fk.fromColumns.join(",") === rel.fromColumns.join(","));
      if (!exists) {
        const t = model.tables.find((tt) => tt.name === rel.fromTable);
        if (t) {
          t.foreignKeys.push({
            id: `fk_inferred_${rel.fromTable}_${rel.fromColumns.join("_")}_${rel.toTable}_${rel.toColumns.join("_")}`,
            fromTable: rel.fromTable,
            fromColumns: rel.fromColumns,
            toTable: rel.toTable,
            toColumns: rel.toColumns,
          });
          issues.push({
            severity: "info",
            message: `Inferred relationship: ${rel.fromTable}.${rel.fromColumns.join(",")} → ${rel.toTable}.${rel.toColumns.join(",")}`,
            table: rel.fromTable,
          });
        }
      }
    }
  }

  return { model, issues, statementCount: stmts.length };
}

// ---------------------------------------------------------------------------
// Relationship inference & cardinality
// ---------------------------------------------------------------------------

/** Build Relationship objects from a SchemaModel (explicit FKs only). */
export function inferRelationships(model: SchemaModel): Relationship[] {
  const out: Relationship[] = [];
  for (const t of model.tables) {
    for (const fk of t.foreignKeys) {
      const target = model.tables.find((tt) => tt.name === fk.toTable);
      const fromCols = fk.fromColumns.map((c) => t.columns.find((cc) => cc.name === c));
      const isUnique = fromCols.every((c) => c?.unique || c?.primaryKey || t.primaryKeys.join(",") === fk.fromColumns.join(","));
      const isNullable = fromCols.some((c) => c?.nullable);
      out.push({
        id: fk.id,
        fromTable: t.name,
        fromColumns: fk.fromColumns,
        toTable: fk.toTable,
        toColumns: fk.toColumns,
        fromCardinality: isUnique ? (isNullable ? "zero-or-one" : "one") : "zero-or-more",
        toCardinality: "one",
        source: "explicit",
      });
      // Suppress unused var lint
      void target;
    }
  }
  return out;
}

/** Generate plural candidates for an English singular noun. */
export function pluralCandidates(s: string): string[] {
  const out = [s, s + "s"];
  // Words ending in consonant+y: y → ies (e.g. category → categories)
  if (s.length > 1 && /[^aeiou]y$/i.test(s)) {
    out.push(s.slice(0, -1) + "ies");
  } else if (s.endsWith("y") && /[aeiou]y$/i.test(s)) {
    // vowel+y: just add s (e.g. key → keys) — already in [s + "s"]
  }
  // Words ending in s/x/z/ch/sh: add es (e.g. box → boxes, dish → dishes)
  if (/s$|x$|z$|ch$|sh$/i.test(s)) {
    out.push(s + "es");
  }
  return out;
}

/** Infer FK relationships from `<singular>_id` column naming. */
export function inferRelationshipsFromNaming(model: SchemaModel): Relationship[] {
  const out: Relationship[] = [];
  const tableNamesLower = new Map(model.tables.map((t) => [t.name.toLowerCase(), t.name]));
  for (const t of model.tables) {
    for (const c of t.columns) {
      if (/^.+_id$/.test(c.name) && c.name !== "id") {
        // Strip trailing _id, pluralize by simple 's'
        const base = c.name.slice(0, -3);
        const candidates = pluralCandidates(base);
        let matched: string | null = null;
        for (const cand of candidates) {
          if (tableNamesLower.has(cand.toLowerCase())) {
            matched = tableNamesLower.get(cand.toLowerCase())!;
            break;
          }
        }
        if (matched && matched !== t.name) {
          // Skip if there's already an explicit FK on this column
          const hasExplicit = t.foreignKeys.some((fk) => fk.fromColumns.includes(c.name));
          if (hasExplicit) continue;
          out.push({
            id: `inferred_${t.name}_${c.name}_${matched}_id`,
            fromTable: t.name,
            fromColumns: [c.name],
            toTable: matched,
            toColumns: ["id"],
            fromCardinality: c.unique ? (c.nullable ? "zero-or-one" : "one") : "zero-or-more",
            toCardinality: "one",
            source: "inferred",
          });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Topological sort (creation order — handle cycles)
// ---------------------------------------------------------------------------

export interface TopoSortResult {
  order: string[];
  cycles: string[][];
}

/** Topologically sort tables by FK dependencies. Tables in cycles are appended in name order. */
export function topologicalSort(model: SchemaModel): TopoSortResult {
  const deps = new Map<string, Set<string>>();
  for (const t of model.tables) {
    deps.set(t.name, new Set<string>());
    for (const fk of t.foreignKeys) {
      if (fk.toTable !== t.name) deps.get(t.name)!.add(fk.toTable);
    }
  }
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycles: string[][] = [];

  function visit(name: string, path: string[]): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      const cycleStart = path.indexOf(name);
      if (cycleStart !== -1) cycles.push([...path.slice(cycleStart), name]);
      return;
    }
    visiting.add(name);
    path.push(name);
    for (const dep of deps.get(name) ?? []) visit(dep, path);
    path.pop();
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  }

  const sorted = Array.from(deps.keys()).sort();
  for (const n of sorted) visit(n, []);
  return { order, cycles };
}

// ---------------------------------------------------------------------------
// Mermaid erDiagram generation
// ---------------------------------------------------------------------------

function cardinalityToMermaid(card: CardinalitySide): string {
  switch (card) {
    case "one": return "||";
    case "zero-or-one": return "|o";
    case "zero-or-more": return "}o";
    case "one-or-more": return "|{";
  }
  return "||";
}

const MERMAID_TYPE_MAP: Record<string, string> = {
  "INTEGER": "int", "INT": "int", "BIGINT": "int", "SMALLINT": "int", "TINYINT": "int",
  "MEDIUMINT": "int", "SERIAL": "int", "BIGSERIAL": "int",
  "DECIMAL": "decimal", "NUMERIC": "decimal", "FLOAT": "float", "DOUBLE": "float",
  "REAL": "float", "DOUBLE PRECISION": "float",
  "VARCHAR": "varchar", "CHAR": "char", "TEXT": "text", "LONGTEXT": "text", "MEDIUMTEXT": "text",
  "TINYTEXT": "text", "CLOB": "text",
  "DATE": "date", "TIME": "time", "DATETIME": "datetime", "TIMESTAMP": "datetime",
  "BOOLEAN": "bool", "BOOL": "bool", "BIT": "int",
  "JSON": "json", "JSONB": "json", "UUID": "uuid", "BLOB": "blob", "BINARY": "blob", "VARBINARY": "blob",
};

function mermaidType(t: string): string {
  const upper = t.toUpperCase().replace(/\s*\(.*\)$/, "").trim();
  if (MERMAID_TYPE_MAP[upper]) return MERMAID_TYPE_MAP[upper];
  if (upper.startsWith("CHARACTER VARYING")) return "varchar";
  if (upper.startsWith("TIMESTAMP")) return "datetime";
  if (upper.startsWith("TIME")) return "time";
  return upper.toLowerCase().replace(/\s+/g, "_");
}

function mermaidKey(col: Column, table: Table): string {
  if (col.primaryKey || table.primaryKeys.includes(col.name)) return "PK";
  if (col.unique) return "UK";
  if (col.references || table.foreignKeys.some((fk) => fk.fromColumns.includes(col.name))) return "FK";
  return "";
}

export function generateMermaidErd(model: SchemaModel, options?: MermaidErdOptions): string {
  const showTypes = options?.showTypes !== false;
  const showLabels = options?.showLabels !== false;
  const lines: string[] = ["erDiagram"];
  // Entities
  for (const t of model.tables) {
    const safeName = mermaidSafeName(t.name);
    lines.push(`  ${safeName} {`);
    for (const c of t.columns) {
      const key = mermaidKey(c, t);
      const typeStr = showTypes ? mermaidType(c.type) : "string";
      const parts = [typeStr, mermaidSafeName(c.name)];
      if (key) parts.push(key);
      lines.push(`    ${parts.join(" ")}`);
    }
    lines.push("  }");
  }
  // Relationships
  const rels = inferRelationships(model);
  const seenRels = new Set<string>();
  for (const r of rels) {
    const key = `${r.fromTable}.${r.fromColumns.join(",")}→${r.toTable}.${r.toColumns.join(",")}`;
    if (seenRels.has(key)) continue;
    seenRels.add(key);
    const fromCard = cardinalityToMermaid(r.fromCardinality);
    const toCard = cardinalityToMermaid(r.toCardinality);
    const label = showLabels
      ? ` : "${r.fromColumns.join(",")} → ${r.toColumns.join(",")}"`
      : "";
    lines.push(
      `  ${mermaidSafeName(r.fromTable)} ${fromCard}--${toCard} ${mermaidSafeName(r.toTable)}${label}`,
    );
  }
  return lines.join("\n");
}

function mermaidSafeName(s: string): string {
  // Mermaid entity names can't contain spaces or special chars — keep alphanumeric/underscore
  return s.replace(/[^A-Za-z0-9_]/g, "_");
}

// ---------------------------------------------------------------------------
// ASCII ERD generation (crow's-foot style)
// ---------------------------------------------------------------------------

export function generateAsciiErd(model: SchemaModel): string {
  const lines: string[] = [];
  lines.push("=== ER Diagram (crow's-foot notation) ===");
  lines.push("");
  const rels = inferRelationships(model);
  // Render each table as a box
  for (const t of model.tables) {
    const box = renderAsciiTable(t);
    lines.push(...box);
    lines.push("");
  }
  lines.push("--- Relationships ---");
  for (const r of rels) {
    const from = asciiCardinality(r.fromCardinality);
    const to = asciiCardinality(r.toCardinality);
    lines.push(
      `  ${r.fromTable} ${from}───${to} ${r.toTable}    (${r.fromColumns.join(",")} → ${r.toColumns.join(",")})`,
    );
  }
  if (rels.length === 0) lines.push("  (no foreign keys detected)");
  const topo = topologicalSort(model);
  if (topo.cycles.length > 0) {
    lines.push("");
    lines.push("--- Circular FK chains detected ---");
    for (const c of topo.cycles) lines.push(`  ${c.join(" → ")}`);
  }
  return lines.join("\n");
}

function asciiCardinality(card: CardinalitySide): string {
  switch (card) {
    case "one": return "|";
    case "zero-or-one": return "o|";
    case "zero-or-more": return "}o";
    case "one-or-more": return "|{";
  }
  return "?";
}

function renderAsciiTable(t: Table): string[] {
  const header = ` ${t.name} `;
  const width = Math.max(
    header.length,
    ...t.columns.map((c) => ` ${keyBadge(c, t)} ${c.name} ${c.type} `.length),
  );
  const border = "─".repeat(width + 2);
  const lines: string[] = [`┌${border}┐`];
  lines.push(`│${header.padEnd(width + 2)}│`);
  lines.push(`├${border}┤`);
  if (t.columns.length === 0) {
    lines.push(`│${" ".repeat(width + 2)}│`);
  } else {
    for (const c of t.columns) {
      const badge = keyBadge(c, t);
      const row = ` ${badge} ${c.name} ${c.nullable ? "" : "NN "}${c.type}`.trimEnd();
      lines.push(`│${row.padEnd(width + 2)}│`);
    }
  }
  lines.push(`└${border}┘`);
  return lines;
}

function keyBadge(c: Column, t: Table): string {
  if (c.primaryKey || t.primaryKeys.includes(c.name)) return "PK";
  if (c.unique) return "UK";
  if (c.references || t.foreignKeys.some((fk) => fk.fromColumns.includes(c.name))) return "FK";
  return "· ";
}

// ---------------------------------------------------------------------------
// DBML generation
// ---------------------------------------------------------------------------

export function generateDbml(model: SchemaModel): string {
  const lines: string[] = [];
  for (const t of model.tables) {
    lines.push(`Table ${t.name} {`);
    for (const c of t.columns) {
      const parts = [c.name, dbmlType(c.type)];
      const constraints: string[] = [];
      if (c.primaryKey || t.primaryKeys.includes(c.name)) constraints.push("pk");
      if (!c.nullable) constraints.push("not null");
      if (c.unique) constraints.push("unique");
      if (c.autoIncrement) constraints.push("increment");
      if (c.defaultValue) constraints.push(`default: ${c.defaultValue}`);
      if (constraints.length > 0) parts.push(`[${constraints.join(", ")}]`);
      lines.push(`  ${parts.join(" ")}`);
    }
    if (t.indexes.length > 0) {
      lines.push("  indexes {");
      for (const idx of t.indexes) {
        const cols = idx.columns.map((c) => `"${c}"`).join(", ");
        lines.push(`    (${cols})${idx.unique ? " [unique]" : ""}`);
      }
      lines.push("  }");
    }
    lines.push("}");
    lines.push("");
  }
  // Refs
  const rels = inferRelationships(model);
  const seen = new Set<string>();
  for (const r of rels) {
    const key = `${r.fromTable}.${r.fromColumns.join(",")}->${r.toTable}.${r.toColumns.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(
      `Ref: ${r.fromTable}.${r.fromColumns.join(",")} > ${r.toTable}.${r.toColumns.join(",")}`,
    );
  }
  return lines.join("\n").trim();
}

function dbmlType(t: string): string {
  const upper = t.toUpperCase().replace(/\s*\(.*\)$/, "").trim();
  if (upper.startsWith("CHARACTER VARYING") || upper.startsWith("VARCHAR")) return "varchar";
  if (upper.startsWith("TIMESTAMP")) return "timestamp";
  return upper.toLowerCase().replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Auto-layout
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  /** Pixels between columns. */
  cellWidth?: number;
  cellHeight?: number;
  /** Number of columns in the grid. */
  gridCols?: number;
  /** Padding around each table. */
  padding?: number;
}

export interface LayoutPosition { x: number; y: number; }

export interface LaidOutModel extends SchemaModel {
  positions: Record<string, LayoutPosition>;
}

/** Assign grid coordinates to each table. */
export function autoLayout(model: SchemaModel, options?: LayoutOptions): LaidOutModel {
  const cellWidth = options?.cellWidth ?? 280;
  const cellHeight = options?.cellHeight ?? 240;
  const gridCols = options?.gridCols ?? 3;
  const padding = options?.padding ?? 40;
  // Order by topological sort so related tables cluster together
  const topo = topologicalSort(model);
  const order = topo.order.length === model.tables.length
    ? topo.order
    : model.tables.map((t) => t.name);
  const positions: Record<string, LayoutPosition> = {};
  order.forEach((name, i) => {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    positions[name] = {
      x: padding + col * cellWidth,
      y: padding + row * cellHeight,
    };
  });
  return { ...model, positions };
}

// ---------------------------------------------------------------------------
// Serialization (JSON for share URL & round-trip with #268)
// ---------------------------------------------------------------------------

export function serializeSchema(model: SchemaModel): string {
  return JSON.stringify(model);
}

export function deserializeSchema(json: string): SchemaModel | null {
  try {
    const parsed = JSON.parse(json) as SchemaModel;
    if (!parsed || !Array.isArray(parsed.tables)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateModel(model: SchemaModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tableNames = new Set(model.tables.map((t) => t.name));
  const lowerNames = new Map(model.tables.map((t) => [t.name.toLowerCase(), t.name]));
  // Duplicate table names
  const seen = new Set<string>();
  for (const t of model.tables) {
    if (seen.has(t.name)) {
      issues.push({ severity: "error", message: `Duplicate table name "${t.name}"`, table: t.name });
    }
    seen.add(t.name);
    if (t.columns.length === 0) {
      issues.push({ severity: "warning", message: `Table "${t.name}" has no columns`, table: t.name });
    }
    if (t.primaryKeys.length === 0 && !t.columns.some((c) => c.primaryKey)) {
      issues.push({ severity: "info", message: `Table "${t.name}" has no primary key`, table: t.name });
    }
    // Duplicate column names
    const colSeen = new Set<string>();
    for (const c of t.columns) {
      if (colSeen.has(c.name)) {
        issues.push({ severity: "error", message: `Duplicate column "${c.name}" in table "${t.name}"`, table: t.name });
      }
      colSeen.add(c.name);
    }
    for (const fk of t.foreignKeys) {
      if (!tableNames.has(fk.toTable)) {
        const tryLower = lowerNames.get(fk.toTable.toLowerCase());
        if (tryLower) {
          issues.push({
            severity: "warning",
            message: `FK in "${t.name}" references "${fk.toTable}" (did you mean "${tryLower}"?)`,
            table: t.name,
          });
        } else {
          issues.push({
            severity: "warning",
            message: `FK in "${t.name}" references unknown table "${fk.toTable}"`,
            table: t.name,
          });
        }
      }
      for (const col of fk.fromColumns) {
        if (!t.columns.some((c) => c.name === col)) {
          issues.push({
            severity: "error",
            message: `FK in "${t.name}" references missing column "${col}"`,
            table: t.name,
          });
        }
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS: { name: string; description: string; ddl: string }[] = [
  {
    name: "Blog schema",
    description: "Users, posts, comments with self-ref FK",
    ddl: `-- Blog schema
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  parent_id INTEGER REFERENCES comments(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_comments_post ON comments(post_id);`,
  },
  {
    name: "E-commerce schema",
    description: "Products, orders, line_items with composite FK",
    ddl: `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  customer_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id, product_id) REFERENCES orders(id),  -- composite FK intentionally partial
  FOREIGN KEY (product_id) REFERENCES products(id)
);`,
  },
  {
    name: "Many-to-many + ALTER TABLE",
    description: "Students/courses/enrollments with ALTER TABLE FKs",
    ddl: `CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) UNIQUE
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  credits INTEGER CHECK (credits > 0 AND credits <= 10)
);

CREATE TABLE enrollments (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_at DATE NOT NULL,
  grade VARCHAR(2),
  PRIMARY KEY (student_id, course_id)
);

ALTER TABLE enrollments ADD FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE enrollments ADD FOREIGN KEY (course_id) REFERENCES courses(id);

CREATE INDEX idx_enroll_student ON enrollments(student_id);
CREATE INDEX idx_enroll_course ON enrollments(course_id);`,
  },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-ddl-to-er-diagram-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  tableCount: number;
  fkCount: number;
  dialect: Dialect;
  preview: string;
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
// Shareable URL (base64-encoded schema JSON in the fragment)
// ---------------------------------------------------------------------------

function encodeBase64Url(s: string): string {
  // Avoid Node Buffer — use btoa when available (browser), fall back to manual.
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Node fallback
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return encodeURIComponent(s);
}

function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const std = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(std)));
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(std, "base64").toString("utf8");
  }
  return decodeURIComponent(s);
}

export function buildShareUrl(ddl: string, options?: ParseOptions): string {
  const payload = { d: ddl, o: { i: options?.inferFromNaming ?? false } };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  if (typeof window === "undefined") return `?s=${encoded}`;
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

export function parseShareUrl(hash: string): { ddl: string; inferFromNaming: boolean } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean.startsWith("s=")) return { ddl: "", inferFromNaming: false };
  const encoded = clean.slice(2);
  try {
    const json = decodeBase64Url(encoded);
    const parsed = JSON.parse(json) as { d: string; o?: { i?: boolean } };
    return { ddl: parsed.d ?? "", inferFromNaming: parsed.o?.i ?? false };
  } catch {
    return { ddl: "", inferFromNaming: false };
  }
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

/** Count FKs across a model. */
export function countFks(model: SchemaModel): number {
  return model.tables.reduce((acc, t) => acc + t.foreignKeys.length, 0);
}

/** Quick stats summary. */
export function summarizeModel(model: SchemaModel): {
  tables: number;
  columns: number;
  fks: number;
  indexes: number;
  checks: number;
} {
  return {
    tables: model.tables.length,
    columns: model.tables.reduce((acc, t) => acc + t.columns.length, 0),
    fks: countFks(model),
    indexes: model.tables.reduce((acc, t) => acc + t.indexes.length, 0),
    checks: model.tables.reduce((acc, t) => acc + t.checks.length, 0),
  };
}
