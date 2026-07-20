/**
 * Database Schema Diff — pure logic.
 *
 * Parses two DDL dumps into normalized schema models, computes a structural
 * diff (tables, columns, constraints, indexes), and generates a
 * dependency-ordered ALTER TABLE migration script. 100% client-side; no DOM,
 * no network.
 *
 * The parser is intentionally lenient: it accepts a wide variety of DDL
 * flavors (ANSI / MySQL / PostgreSQL / SQLite / T-SQL) and extracts the
 * structural information it can recognize, ignoring table-options and other
 * dialect-specific clauses it cannot.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SqlDialect = "ansi" | "mysql" | "postgresql" | "sqlite" | "sqlserver";

export type DiffDirection = "forward" | "reverse";

export type ObjectType =
  | "table"
  | "column"
  | "primaryKey"
  | "foreignKey"
  | "unique"
  | "check"
  | "index";

export type ChangeKind = "added" | "removed" | "modified";

export interface ParsedColumn {
  name: string;
  /** Raw type string, uppercased and trimmed, e.g. "VARCHAR(255)". */
  type: string;
  /** Base type without parens, e.g. "VARCHAR". */
  baseType: string;
  nullable: boolean;
  default: string | null;
  autoIncrement: boolean;
  /** Inline PRIMARY KEY column flag (from `id INT PRIMARY KEY`). */
  inlinePrimaryKey: boolean;
  /** Inline UNIQUE column flag. */
  inlineUnique: boolean;
  /** Inline REFERENCES clause, captured as "reftable(refcol)". */
  inlineReferences: string | null;
}

export type ConstraintKind = "primaryKey" | "foreignKey" | "unique" | "check";

export interface ParsedConstraint {
  kind: ConstraintKind;
  name: string | null;
  columns: string[];
  /** For foreign keys: referenced table. */
  referencesTable: string | null;
  /** For foreign keys: referenced columns. */
  referencesColumns: string[];
  /** For check constraints: raw expression text. */
  checkExpr: string | null;
}

export interface ParsedIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
  constraints: ParsedConstraint[];
  indexes: ParsedIndex[];
}

export interface ParsedSchema {
  tables: ParsedTable[];
  /** Indexes declared via CREATE INDEX (not inline). */
  standaloneIndexes: ParsedIndex[];
  /** Number of statements the parser could not classify. */
  unparsedStatements: string[];
}

export interface DiffOptions {
  dialect: SqlDialect;
  direction: DiffDirection;
  /** Ignore column-order differences within a table. */
  ignoreColumnOrder: boolean;
  /** Case-insensitive identifier matching. */
  ignoreCase: boolean;
  /** Include data-loss warnings as comments in the migration script. */
  includeDataLossWarnings: boolean;
  /** Drop tables/columns that no longer exist in target. */
  includeDrops: boolean;
}

export interface ChangeEvent {
  kind: ChangeKind;
  objectType: ObjectType;
  table: string;
  /** Column name, constraint name, or index name — null for table-level events. */
  object: string | null;
  /** Old value (for modified). */
  from: string | null;
  /** New value (for modified). */
  to: string | null;
  /** Whether this operation may cause data loss. */
  dataLoss: boolean;
  /** Human-readable summary. */
  summary: string;
}

export interface DiffStats {
  tablesAdded: number;
  tablesRemoved: number;
  columnsAdded: number;
  columnsRemoved: number;
  columnsModified: number;
  constraintsAdded: number;
  constraintsRemoved: number;
  indexesAdded: number;
  indexesRemoved: number;
  dataLossOps: number;
  total: number;
}

export interface DiffResult {
  changes: ChangeEvent[];
  stats: DiffStats;
}

export type MigrationResult =
  | { ok: true; sql: string; statementCount: number; dataLossOps: number }
  | { ok: false; error: string };

export interface ParseResult {
  ok: boolean;
  schema: ParsedSchema;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SQL_DIALECTS: ReadonlyArray<{ value: SqlDialect; label: string }> = [
  { value: "ansi", label: "ANSI SQL (Standard)" },
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server (T-SQL)" },
];

export const DEFAULT_OPTIONS: DiffOptions = {
  dialect: "ansi",
  direction: "forward",
  ignoreColumnOrder: false,
  ignoreCase: true,
  includeDataLossWarnings: true,
  includeDrops: true,
};

export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  table: "Table",
  column: "Column",
  primaryKey: "Primary Key",
  foreignKey: "Foreign Key",
  unique: "Unique",
  check: "Check",
  index: "Index",
};

// ---------------------------------------------------------------------------
// Identifier normalization
// ---------------------------------------------------------------------------

/** Strip surrounding quotes/backets/brackets from an identifier. */
export function unquoteIdentifier(name: string): string {
  if (!name) return name;
  const n = name.trim();
  if (n.length >= 2) {
    const first = n[0];
    const last = n[n.length - 1];
    if ((first === '"' && last === '"') || (first === "`" && last === "`")) {
      return n.slice(1, -1).replace(/["`]["`]/g, (m) => m[0]);
    }
    if (first === "[" && last === "]") return n.slice(1, -1);
  }
  return n;
}

/** Normalize an identifier per the options (case + quotes). */
export function normalizeName(name: string, opts: DiffOptions): string {
  const u = unquoteIdentifier(name);
  return opts.ignoreCase ? u.toLowerCase() : u;
}

// ---------------------------------------------------------------------------
// Statement splitter — splits on ';' outside strings, parens, comments.
// ---------------------------------------------------------------------------

export function splitStatements(input: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  const n = input.length;
  let inSingle = false, inDouble = false, inBacktick = false;
  let inBlock = 0;
  let inLine = false;

  while (i < n) {
    const ch = input[i];
    if (inLine) {
      buf += ch;
      if (ch === "\n") inLine = false;
      i++;
      continue;
    }
    if (inBlock > 0) {
      buf += ch;
      if (ch === "*" && input[i + 1] === "/") { buf += "/"; i += 2; inBlock--; continue; }
      i++;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'") {
        if (input[i + 1] === "'") { buf += "'"; i += 2; continue; }
        inSingle = false;
      }
      i++;
      continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"') {
        if (input[i + 1] === '"') { buf += '"'; i += 2; continue; }
        inDouble = false;
      }
      i++;
      continue;
    }
    if (inBacktick) {
      buf += ch;
      if (ch === "`") {
        if (input[i + 1] === "`") { buf += "`"; i += 2; continue; }
        inBacktick = false;
      }
      i++;
      continue;
    }
    if (ch === "-" && input[i + 1] === "-") { inLine = true; buf += ch; i++; continue; }
    if (ch === "/" && input[i + 1] === "*") { inBlock++; buf += ch + input[i + 1]; i += 2; continue; }
    if (ch === "'") { inSingle = true; buf += ch; i++; continue; }
    if (ch === '"') { inDouble = true; buf += ch; i++; continue; }
    if (ch === "`") { inBacktick = true; buf += ch; i++; continue; }
    if (ch === ";") {
      const trimmed = buf.trim();
      if (trimmed) out.push(trimmed);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const trimmed = buf.trim();
  if (trimmed) out.push(trimmed);
  return out;
}

// ---------------------------------------------------------------------------
// Tokenize a single statement into tokens (keywords, identifiers, strings,
// numbers, punctuation). Whitespace is skipped.
// ---------------------------------------------------------------------------

export interface DdlToken {
  type: "word" | "string" | "number" | "punct" | "other";
  value: string;
  upper: string;
}

export function tokenizeDdl(input: string): DdlToken[] {
  const tokens: DdlToken[] = [];
  const s = input ?? "";
  let i = 0;
  const n = s.length;

  const push = (type: DdlToken["type"], value: string): void => {
    tokens.push({ type, value, upper: value.toUpperCase() });
  };

  while (i < n) {
    const ch = s[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === "-" && s[i + 1] === "-") {
      while (i < n && s[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      let depth = 1;
      while (i < n && depth > 0) {
        if (s[i] === "/" && s[i + 1] === "*") { depth++; i += 2; }
        else if (s[i] === "*" && s[i + 1] === "/") { depth--; i += 2; }
        else i++;
      }
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      push("string", s.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      push("string", s.slice(i, j));
      i = j;
      continue;
    }
    if (ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (s[j] === "`") {
          if (s[j + 1] === "`") { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      push("string", s.slice(i, j));
      i = j;
      continue;
    }
    if (ch === "[") {
      let j = i + 1;
      while (j < n && s[j] !== "]") j++;
      if (j < n) j++;
      push("string", s.slice(i, j));
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(s[j])) j++;
      if (s[j] === ".") {
        j++;
        while (j < n && /[0-9]/.test(s[j])) j++;
      }
      if (s[j] === "e" || s[j] === "E") {
        j++;
        if (s[j] === "+" || s[j] === "-") j++;
        while (j < n && /[0-9]/.test(s[j])) j++;
      }
      push("number", s.slice(i, j));
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch) || ch.charCodeAt(0) > 127) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(s[j])) j++;
      push("word", s.slice(i, j));
      i = j;
      continue;
    }

    if ("(),.;".includes(ch)) { push("punct", ch); i++; continue; }

    push("other", ch);
    i++;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Body splitter — split a CREATE TABLE body on top-level commas (respecting
// parens and strings).
// ---------------------------------------------------------------------------

export function splitBodyTokens(tokens: DdlToken[]): DdlToken[][] {
  const segments: DdlToken[][] = [];
  let current: DdlToken[] = [];
  let depth = 0;
  for (const t of tokens) {
    if (t.value === "(") depth++;
    else if (t.value === ")") depth--;
    if (t.value === "," && depth === 0) {
      if (current.length > 0) segments.push(current);
      current = [];
      continue;
    }
    current.push(t);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// ---------------------------------------------------------------------------
// CREATE TABLE parser
// ---------------------------------------------------------------------------

const TYPE_MODIFIERS = new Set([
  "UNSIGNED", "ZEROFILL", "NULL", "NOT", "DEFAULT", "AUTO_INCREMENT",
  "AUTOINCREMENT", "PRIMARY", "UNIQUE", "REFERENCES", "ON", "DELETE",
  "UPDATE", "CASCADE", "RESTRICT", "SET", "NO", "ACTION", "CHECK",
  "COLLATE", "CHARACTER", "GENERATED", "ALWAYS", "AS", "IDENTITY",
  "STORED", "VIRTUAL", "COMMENT",
]);
// Reserved for future strict-mode validation; currently unused but exported
// so tests can introspect the modifier set.
export const _TYPE_MODIFIERS = TYPE_MODIFIERS;

const BASE_TYPES = new Set([
  "INT", "INTEGER", "SMALLINT", "TINYINT", "MEDIUMINT", "BIGINT",
  "DECIMAL", "NUMERIC", "NUMBER", "FLOAT", "DOUBLE", "REAL",
  "CHAR", "VARCHAR", "NCHAR", "NVARCHAR", "TEXT", "TINYTEXT",
  "MEDIUMTEXT", "LONGTEXT", "CLOB", "NTEXT",
  "DATE", "TIME", "DATETIME", "TIMESTAMP", "TIMESTAMPTZ", "INTERVAL",
  "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB", "BINARY", "VARBINARY",
  "BYTEA", "IMAGE",
  "BOOLEAN", "BOOL", "BIT",
  "JSON", "JSONB", "XML", "UUID", "MONEY", "SERIAL", "BIGSERIAL",
  "SMALLSERIAL", "INET", "CIDR", "MACADDR", "TSVECTOR", "HSTORE",
]);

export function isBaseType(word: string): boolean {
  return BASE_TYPES.has(word.toUpperCase());
}

/** Parse a CREATE TABLE statement into a ParsedTable. Returns null on failure. */
export function parseCreateTable(stmt: string): ParsedTable | null {
  const tokens = tokenizeDdl(stmt);
  if (tokens.length < 2) return null;
  // Expect: CREATE [TEMP|TEMPORARY|UNLOGGED] TABLE [IF NOT EXISTS] <name> ( body )
  let i = 0;
  if (tokens[i].upper !== "CREATE") return null;
  i++;
  // skip optional TEMP/TEMPORARY/UNLOGGED/GLOBAL/LOCAL
  while (i < tokens.length && ["TEMP", "TEMPORARY", "UNLOGGED", "GLOBAL", "LOCAL"].includes(tokens[i].upper)) i++;
  if (tokens[i]?.upper !== "TABLE") return null;
  i++;
  // IF NOT EXISTS
  if (tokens[i]?.upper === "IF" && tokens[i + 1]?.upper === "NOT" && tokens[i + 2]?.upper === "EXISTS") {
    i += 3;
  }
  // Table name (possibly schema-qualified)
  const nameToken = tokens[i];
  if (!nameToken) return null;
  let tableName = tokenText(nameToken);
  i++;
  // schema.table
  if (tokens[i]?.value === "." && tokens[i + 1]) {
    i++;
    tableName = tokenText(tokens[i]);
    i++;
  }
  // Find opening paren
  while (i < tokens.length && tokens[i].value !== "(") i++;
  if (tokens[i]?.value !== "(") return null;
  const openIdx = i;
  // Find matching close paren
  let depth = 0;
  let closeIdx = -1;
  for (let j = openIdx; j < tokens.length; j++) {
    if (tokens[j].value === "(") depth++;
    else if (tokens[j].value === ")") {
      depth--;
      if (depth === 0) { closeIdx = j; break; }
    }
  }
  if (closeIdx === -1) return null;
  const bodyTokens = tokens.slice(openIdx + 1, closeIdx);
  const segments = splitBodyTokens(bodyTokens);

  const columns: ParsedColumn[] = [];
  const constraints: ParsedConstraint[] = [];

  for (const seg of segments) {
    if (seg.length === 0) continue;
    const parsed = parseBodySegment(seg);
    if (parsed.kind === "column") {
      columns.push(parsed.column);
    } else {
      constraints.push(parsed.constraint);
    }
  }

  return { name: tableName, columns, constraints, indexes: [] };
}

type BodySegment =
  | { kind: "column"; column: ParsedColumn }
  | { kind: "constraint"; constraint: ParsedConstraint };

function tokenText(t: DdlToken): string {
  if (t.type === "string") return unquoteIdentifier(t.value);
  return t.value;
}

function parseBodySegment(seg: DdlToken[]): BodySegment {
  // Detect table-level constraint: CONSTRAINT name X(...) | PRIMARY KEY (...) | FOREIGN KEY (...) | UNIQUE (...) | CHECK (...)
  const first = seg[0];
  const upper0 = first.upper;
  let idx = 0;

  if (upper0 === "CONSTRAINT") {
    idx++;
    const nameTok = seg[idx];
    const constraintName = nameTok ? tokenText(nameTok) : null;
    idx++;
    return parseConstraintHead(seg, idx, constraintName);
  }
  if (upper0 === "PRIMARY" || upper0 === "FOREIGN" || upper0 === "UNIQUE" || upper0 === "CHECK") {
    return parseConstraintHead(seg, 0, null);
  }
  return { kind: "column", column: parseColumnDef(seg) };
}

function parseConstraintHead(
  seg: DdlToken[],
  startIdx: number,
  name: string | null,
): BodySegment {
  const head = seg[startIdx]?.upper;
  // PRIMARY KEY (cols)
  if (head === "PRIMARY" && seg[startIdx + 1]?.upper === "KEY") {
    const cols = readParenList(seg, startIdx + 2);
    return {
      kind: "constraint",
      constraint: {
        kind: "primaryKey", name, columns: cols,
        referencesTable: null, referencesColumns: [], checkExpr: null,
      },
    };
  }
  // FOREIGN KEY (cols) REFERENCES table (cols)
  if (head === "FOREIGN" && seg[startIdx + 1]?.upper === "KEY") {
    const cols = readParenList(seg, startIdx + 2);
    // find REFERENCES
    let refIdx = -1;
    for (let j = startIdx + 3; j < seg.length; j++) {
      if (seg[j].upper === "REFERENCES") { refIdx = j; break; }
    }
    let refTable: string | null = null;
    let refCols: string[] = [];
    if (refIdx >= 0) {
      const tableTok = seg[refIdx + 1];
      if (tableTok) refTable = tokenText(tableTok);
      // schema.table
      if (seg[refIdx + 2]?.value === "." && seg[refIdx + 3]) {
        refTable = tokenText(seg[refIdx + 3]);
      }
      refCols = readParenList(seg, refIdx + 2);
    }
    return {
      kind: "constraint",
      constraint: {
        kind: "foreignKey", name, columns: cols,
        referencesTable: refTable, referencesColumns: refCols, checkExpr: null,
      },
    };
  }
  // UNIQUE (cols) | UNIQUE KEY name (cols) | UNIQUE INDEX name (cols)
  if (head === "UNIQUE") {
    let j = startIdx + 1;
    // skip optional KEY/INDEX keyword and optional name
    if (seg[j]?.upper === "KEY" || seg[j]?.upper === "INDEX") j++;
    if (seg[j]?.value !== "(") j++; // skip name
    const cols = readParenList(seg, j);
    return {
      kind: "constraint",
      constraint: {
        kind: "unique", name, columns: cols,
        referencesTable: null, referencesColumns: [], checkExpr: null,
      },
    };
  }
  // CHECK (expr)
  if (head === "CHECK") {
    const openIdx = seg.findIndex((t, j) => j >= startIdx && t.value === "(");
    let expr: string | null = null;
    if (openIdx >= 0) {
      // Find matching close
      let d = 0;
      let closeIdx = -1;
      for (let j = openIdx; j < seg.length; j++) {
        if (seg[j].value === "(") d++;
        else if (seg[j].value === ")") { d--; if (d === 0) { closeIdx = j; break; } }
      }
      if (closeIdx > 0) {
        expr = seg.slice(openIdx, closeIdx + 1).map((t) => t.value).join(" ");
      }
    }
    return {
      kind: "constraint",
      constraint: {
        kind: "check", name, columns: [],
        referencesTable: null, referencesColumns: [], checkExpr: expr,
      },
    };
  }
  // Fallback: treat as a column
  return { kind: "column", column: parseColumnDef(seg) };
}

/** Read a parenthesized list of identifiers, returning the raw names. */
function readParenList(seg: DdlToken[], fromIdx: number): string[] {
  let i = fromIdx;
  while (i < seg.length && seg[i].value !== "(") i++;
  if (seg[i]?.value !== "(") return [];
  i++;
  const out: string[] = [];
  while (i < seg.length && seg[i].value !== ")") {
    if (seg[i].value === ",") { i++; continue; }
    // Skip optional ASC/DESC and ordering keywords
    if (seg[i].upper === "ASC" || seg[i].upper === "DESC") { i++; continue; }
    // The identifier (possibly schema-qualified — we just take last segment)
    let name = tokenText(seg[i]);
    if (seg[i + 1]?.value === "." && seg[i + 2]) {
      name = tokenText(seg[i + 2]);
      i += 2;
    }
    out.push(name);
    i++;
    // skip ASC/DESC after column
    if (seg[i]?.upper === "ASC" || seg[i]?.upper === "DESC") i++;
  }
  return out;
}

function parseColumnDef(seg: DdlToken[]): ParsedColumn {
  // name TYPE [(...)] [modifiers...]
  let i = 0;
  const name = tokenText(seg[i]);
  i++;
  // Build the type string
  let type = "";
  let baseType = "";
  if (i < seg.length && seg[i].type !== "punct") {
    baseType = seg[i].upper;
    type = seg[i].value;
    i++;
    // Look for parenthesized type params, e.g. VARCHAR(255), DECIMAL(10,2)
    if (seg[i]?.value === "(") {
      let d = 0;
      const start = i;
      while (i < seg.length) {
        if (seg[i].value === "(") d++;
        else if (seg[i].value === ")") { d--; if (d === 0) { i++; break; } }
        i++;
      }
      type += seg.slice(start, i).map((t) => t.value).join("");
    }
    // Type modifiers UNSIGNED / ZEROFILL — append to the type string.
    while (i < seg.length && (seg[i].upper === "UNSIGNED" || seg[i].upper === "ZEROFILL")) {
      type += " " + seg[i].value;
      i++;
    }
  }

  let nullable = true;
  let defaultValue: string | null = null;
  let autoIncrement = false;
  let inlinePrimaryKey = false;
  let inlineUnique = false;
  let inlineReferences: string | null = null;

  while (i < seg.length) {
    const t = seg[i];
    const up = t.upper;
    if (up === "NOT" && seg[i + 1]?.upper === "NULL") {
      nullable = false;
      i += 2;
      continue;
    }
    if (up === "NULL") { nullable = true; i++; continue; }
    if (up === "DEFAULT") {
      i++;
      const dv = seg[i];
      if (dv) {
        defaultValue = dv.value;
        i++;
        // Handle two-word defaults like CURRENT_TIMESTAMP
        if (defaultValue.toUpperCase() === "CURRENT" && seg[i]?.upper === "TIMESTAMP") {
          defaultValue = "CURRENT_TIMESTAMP";
          i++;
        }
      }
      continue;
    }
    if (up === "AUTO_INCREMENT" || up === "AUTOINCREMENT") {
      autoIncrement = true;
      i++;
      continue;
    }
    if (up === "PRIMARY" && seg[i + 1]?.upper === "KEY") {
      inlinePrimaryKey = true;
      i += 2;
      continue;
    }
    if (up === "UNIQUE") {
      inlineUnique = true;
      i++;
      continue;
    }
    if (up === "REFERENCES") {
      i++;
      const refTable = seg[i] ? tokenText(seg[i]) : "";
      i++;
      if (seg[i]?.value === "." && seg[i + 1]) {
        i++;
        // last segment is the actual table
      }
      const refCols = readParenList(seg, i);
      // advance i past the paren list
      while (i < seg.length && seg[i].value !== "(") i++;
      let d = 0;
      while (i < seg.length) {
        if (seg[i].value === "(") d++;
        else if (seg[i].value === ")") { d--; if (d === 0) { i++; break; } }
        i++;
      }
      inlineReferences = `${refTable}(${refCols.join(",")})`;
      continue;
    }
    if (up === "ON" && (seg[i + 1]?.upper === "DELETE" || seg[i + 1]?.upper === "UPDATE")) {
      // skip ON DELETE/UPDATE action
      i += 2;
      // skip action word(s): CASCADE, RESTRICT, SET NULL/DEFAULT, NO ACTION
      while (i < seg.length && ["CASCADE", "RESTRICT", "SET", "NO", "ACTION", "NULL", "DEFAULT"].includes(seg[i].upper)) {
        i++;
      }
      continue;
    }
    if (up === "COLLATE") {
      i += 2; // skip COLLATE and the collation name
      continue;
    }
    if (up === "CHARACTER" && seg[i + 1]?.upper === "SET") {
      i += 3; // skip CHARACTER SET name
      continue;
    }
    if (up === "COMMENT") {
      i += 2; // skip COMMENT and the string
      continue;
    }
    if (up === "GENERATED" || up === "ALWAYS" || up === "AS" || up === "STORED" || up === "VIRTUAL" || up === "IDENTITY") {
      i++;
      continue;
    }
    if (up === "CHECK") {
      // skip CHECK (expr)
      const openIdx = i + 1;
      if (seg[openIdx]?.value === "(") {
        let d = 0;
        let j = openIdx;
        while (j < seg.length) {
          if (seg[j].value === "(") d++;
          else if (seg[j].value === ")") { d--; if (d === 0) { j++; break; } }
          j++;
        }
        i = j;
        continue;
      }
      i++;
      continue;
    }
    // Unknown modifier — skip
    i++;
  }

  return {
    name, type, baseType: baseType.toUpperCase(),
    nullable, default: defaultValue, autoIncrement,
    inlinePrimaryKey, inlineUnique, inlineReferences,
  };
}

// ---------------------------------------------------------------------------
// CREATE INDEX parser
// ---------------------------------------------------------------------------

export function parseCreateIndex(stmt: string): ParsedIndex | null {
  const tokens = tokenizeDdl(stmt);
  let i = 0;
  if (tokens[i]?.upper !== "CREATE") return null;
  i++;
  let unique = false;
  if (tokens[i]?.upper === "UNIQUE") { unique = true; i++; }
  // Optional type: INDEX, KEY, SPATIAL, FULLTEXT
  if (tokens[i]?.upper === "SPATIAL" || tokens[i]?.upper === "FULLTEXT") i++;
  if (tokens[i]?.upper !== "INDEX" && tokens[i]?.upper !== "KEY") return null;
  i++;
  if (tokens[i]?.upper === "IF" && tokens[i + 1]?.upper === "NOT" && tokens[i + 2]?.upper === "EXISTS") i += 3;
  const nameTok = tokens[i];
  if (!nameTok) return null;
  const name = tokenText(nameTok);
  i++;
  if (tokens[i]?.upper !== "ON") return null;
  i++;
  const tableTok = tokens[i];
  if (!tableTok) return null;
  const table = tokenText(tableTok);
  i++;
  const cols = readParenList(tokens, i);
  return { name, table, columns: cols, unique };
}

// ---------------------------------------------------------------------------
// Top-level schema parser
// ---------------------------------------------------------------------------

/** Strip leading line and block comments (and surrounding whitespace). */
export function stripLeadingComments(s: string): string {
  let out = s;
  // Loop in case multiple comments precede the real statement.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const trimmed = out.trimStart();
    if (trimmed.startsWith("--")) {
      const nl = trimmed.indexOf("\n");
      if (nl < 0) return "";
      out = trimmed.slice(nl + 1);
    } else if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/");
      if (end < 0) return "";
      out = trimmed.slice(end + 2);
    } else {
      out = trimmed;
      break;
    }
  }
  return out;
}

export function parseSchema(input: string): ParseResult {
  if (input == null) return { ok: false, schema: emptySchema(), errors: ["Input is null."] };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, schema: emptySchema(), errors: ["Input is empty."] };

  const stmts = splitStatements(trimmed);
  const tables: ParsedTable[] = [];
  const standaloneIndexes: ParsedIndex[] = [];
  const unparsed: string[] = [];
  const errors: string[] = [];

  for (const rawStmt of stmts) {
    const stmt = stripLeadingComments(rawStmt);
    const head = stmt.match(/^\s*(\w+)/);
    const kw = head ? head[1].toUpperCase() : "";
    if (kw === "CREATE") {
      // Peek further
      const m2 = stmt.match(/^\s*CREATE\s+(TEMPORARY\s+|TEMP\s+|UNLOGGED\s+|GLOBAL\s+|LOCAL\s+|UNIQUE\s+|SPATIAL\s+|FULLTEXT\s+)?(TABLE|INDEX|KEY|VIEW|DATABASE|SCHEMA|TRIGGER|PROCEDURE|FUNCTION|SEQUENCE)/i);
      const what = m2?.[2]?.toUpperCase() ?? "";
      if (what === "TABLE") {
        const t = parseCreateTable(stmt);
        if (t) tables.push(t);
        else { unparsed.push(stmt); errors.push("Failed to parse CREATE TABLE."); }
      } else if (what === "INDEX" || what === "KEY") {
        const idx = parseCreateIndex(stmt);
        if (idx) standaloneIndexes.push(idx);
        else { unparsed.push(stmt); errors.push("Failed to parse CREATE INDEX."); }
      } else {
        // CREATE VIEW / TRIGGER / etc. — ignore for diff
      }
    } else if (kw === "ALTER" || kw === "DROP") {
      // We don't apply these to source/target schemas — skip.
    } else if (kw === "") {
      // comment-only or empty
    } else {
      unparsed.push(stmt);
    }
  }

  // Attach standalone indexes to their tables when possible.
  for (const idx of standaloneIndexes) {
    const t = tables.find((tbl) => tbl.name.toLowerCase() === idx.table.toLowerCase());
    if (t) t.indexes.push(idx);
  }

  return { ok: errors.length === 0, schema: { tables, standaloneIndexes, unparsedStatements: unparsed }, errors };
}

function emptySchema(): ParsedSchema {
  return { tables: [], standaloneIndexes: [], unparsedStatements: [] };
}

// ---------------------------------------------------------------------------
// Schema lookups
// ---------------------------------------------------------------------------

export function findTable(schema: ParsedSchema, name: string, opts: DiffOptions): ParsedTable | undefined {
  const target = normalizeName(name, opts);
  return schema.tables.find((t) => normalizeName(t.name, opts) === target);
}

export function findColumn(table: ParsedTable, name: string, opts: DiffOptions): ParsedColumn | undefined {
  const target = normalizeName(name, opts);
  return table.columns.find((c) => normalizeName(c.name, opts) === target);
}

/** Collect all primary keys (named constraint + inline PRIMARY KEY column flags). */
export function getPrimaryKey(table: ParsedTable, opts: DiffOptions): string[] | null {
  const named = table.constraints.find((c) => c.kind === "primaryKey");
  if (named && named.columns.length > 0) return named.columns.map((c) => normalizeName(c, opts));
  const inline = table.columns.filter((c) => c.inlinePrimaryKey).map((c) => normalizeName(c.name, opts));
  return inline.length > 0 ? inline : null;
}

export function getForeignKeys(table: ParsedTable): ParsedConstraint[] {
  return table.constraints.filter((c) => c.kind === "foreignKey");
}

export function getUniqueConstraints(table: ParsedTable): ParsedConstraint[] {
  // Named UNIQUE constraints + inline UNIQUE column flags
  const named = table.constraints.filter((c) => c.kind === "unique");
  return named;
}

// ---------------------------------------------------------------------------
// Type narrowing detection
// ---------------------------------------------------------------------------

const TYPE_SIZE: Record<string, number> = {
  TINYINT: 1, SMALLINT: 2, MEDIUMINT: 3, INT: 4, INTEGER: 4, BIGINT: 8,
  SERIAL: 4, BIGSERIAL: 8, SMALLSERIAL: 2,
  FLOAT: 4, REAL: 4, DOUBLE: 8, "DOUBLE PRECISION": 8,
  DECIMAL: 16, NUMERIC: 16, MONEY: 8,
  CHAR: 1, VARCHAR: 2, TEXT: 3, MEDIUMTEXT: 4, LONGTEXT: 5,
  BLOB: 3, BINARY: 1, VARBINARY: 2,
  DATE: 1, TIME: 1, TIMESTAMP: 1, DATETIME: 1,
};

/** Return true if `to` is narrower than `from` (potential data loss). */
export function isTypeNarrowing(from: string, to: string): boolean {
  const fBase = extractBaseType(from);
  const tBase = extractBaseType(to);
  if (fBase === tBase) {
    // Same base type — compare length params
    const fLen = extractLength(from);
    const tLen = extractLength(to);
    if (fLen !== null && tLen !== null && tLen < fLen) return true;
    return false;
  }
  const fSize = TYPE_SIZE[fBase] ?? 0;
  const tSize = TYPE_SIZE[tBase] ?? 0;
  if (fSize > 0 && tSize > 0 && tSize < fSize) return true;
  return false;
}

export function extractBaseType(type: string): string {
  return (type || "").replace(/\(.*\$/, "").replace(/\(.*\)/, "").replace(/UNSIGNED|ZEROFILL/g, "").trim().toUpperCase();
}

export function extractLength(type: string): number | null {
  const m = (type || "").match(/\((\d+)(?:\s*,\s*\d+)?\)/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export function diffSchemas(
  source: ParsedSchema,
  target: ParsedSchema,
  opts: DiffOptions = DEFAULT_OPTIONS,
): DiffResult {
  const changes: ChangeEvent[] = [];

  const srcTables = new Map(source.tables.map((t) => [normalizeName(t.name, opts), t]));
  const tgtTables = new Map(target.tables.map((t) => [normalizeName(t.name, opts), t]));

  // Tables added (in target but not source)
  for (const [normName, t] of tgtTables) {
    if (!srcTables.has(normName)) {
      changes.push({
        kind: "added", objectType: "table", table: t.name, object: null,
        from: null, to: null, dataLoss: false,
        summary: `Add table ${t.name}`,
      });
    }
  }

  // Tables removed
  for (const [normName, t] of srcTables) {
    if (!tgtTables.has(normName)) {
      changes.push({
        kind: "removed", objectType: "table", table: t.name, object: null,
        from: null, to: null, dataLoss: opts.includeDrops,
        summary: `Drop table ${t.name}`,
      });
    }
  }

  // Tables present in both — compare columns, constraints, indexes
  for (const [normName, srcTable] of srcTables) {
    const tgtTable = tgtTables.get(normName);
    if (!tgtTable) continue;

    diffColumns(srcTable, tgtTable, opts, changes);
    diffConstraints(srcTable, tgtTable, opts, changes, "primaryKey");
    diffConstraints(srcTable, tgtTable, opts, changes, "foreignKey");
    diffConstraints(srcTable, tgtTable, opts, changes, "unique");
    diffConstraints(srcTable, tgtTable, opts, changes, "check");
    diffIndexes(srcTable, tgtTable, opts, changes);
  }

  const stats = computeDiffStats(changes);
  return { changes, stats };
}

function diffColumns(
  src: ParsedTable,
  tgt: ParsedTable,
  opts: DiffOptions,
  out: ChangeEvent[],
): void {
  const srcCols = new Map(src.columns.map((c) => [normalizeName(c.name, opts), c]));
  const tgtCols = new Map(tgt.columns.map((c) => [normalizeName(c.name, opts), c]));

  for (const [normName, c] of tgtCols) {
    if (!srcCols.has(normName)) {
      out.push({
        kind: "added", objectType: "column", table: tgt.name, object: c.name,
        from: null, to: c.type, dataLoss: false,
        summary: `Add column ${tgt.name}.${c.name} ${c.type}`,
      });
    }
  }
  for (const [normName, c] of srcCols) {
    if (!tgtCols.has(normName)) {
      out.push({
        kind: "removed", objectType: "column", table: src.name, object: c.name,
        from: c.type, to: null, dataLoss: opts.includeDrops,
        summary: `Drop column ${src.name}.${c.name}`,
      });
    }
  }
  for (const [normName, srcCol] of srcCols) {
    const tgtCol = tgtCols.get(normName);
    if (!tgtCol) continue;

    if (srcCol.type.toUpperCase() !== tgtCol.type.toUpperCase()) {
      const narrowing = isTypeNarrowing(srcCol.type, tgtCol.type);
      out.push({
        kind: "modified", objectType: "column", table: tgt.name, object: tgtCol.name,
        from: srcCol.type, to: tgtCol.type, dataLoss: narrowing,
        summary: `Alter column ${tgt.name}.${tgtCol.name} type ${srcCol.type} → ${tgtCol.type}`,
      });
    }
    if (srcCol.nullable !== tgtCol.nullable) {
      // NOT NULL without default = data loss
      const dataLoss = !tgtCol.nullable && (tgtCol.default === null);
      out.push({
        kind: "modified", objectType: "column", table: tgt.name, object: tgtCol.name,
        from: srcCol.nullable ? "NULL" : "NOT NULL",
        to: tgtCol.nullable ? "NULL" : "NOT NULL",
        dataLoss,
        summary: `Alter column ${tgt.name}.${tgtCol.name} nullability → ${tgtCol.nullable ? "NULL" : "NOT NULL"}`,
      });
    }
    if ((srcCol.default ?? null) !== (tgtCol.default ?? null)) {
      out.push({
        kind: "modified", objectType: "column", table: tgt.name, object: tgtCol.name,
        from: srcCol.default ?? "−",
        to: tgtCol.default ?? "−",
        dataLoss: false,
        summary: `Alter column ${tgt.name}.${tgtCol.name} default ${srcCol.default ?? "(none)"} → ${tgtCol.default ?? "(none)"}`,
      });
    }
  }
}

function constraintKey(c: ParsedConstraint, opts: DiffOptions): string {
  const cols = c.columns.map((x) => normalizeName(x, opts)).join(",");
  if (c.kind === "foreignKey") {
    return `${c.kind}|${cols}|${normalizeName(c.referencesTable ?? "", opts)}|${c.referencesColumns.map((x) => normalizeName(x, opts)).join(",")}`;
  }
  if (c.kind === "check") {
    return `${c.kind}|${(c.checkExpr ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`;
  }
  return `${c.kind}|${cols}`;
}

function diffConstraints(
  src: ParsedTable,
  tgt: ParsedTable,
  opts: DiffOptions,
  out: ChangeEvent[],
  kind: ConstraintKind,
): void {
  const srcCs = src.constraints.filter((c) => c.kind === kind);
  const tgtCs = tgt.constraints.filter((c) => c.kind === kind);
  const srcSet = new Set(srcCs.map((c) => constraintKey(c, opts)));
  const tgtSet = new Set(tgtCs.map((c) => constraintKey(c, opts)));

  for (const c of tgtCs) {
    if (!srcSet.has(constraintKey(c, opts))) {
      out.push({
        kind: "added",
        objectType: kind === "primaryKey" ? "primaryKey"
          : kind === "foreignKey" ? "foreignKey"
          : kind === "unique" ? "unique" : "check",
        table: tgt.name, object: c.name ?? c.columns.join(","),
        from: null, to: c.columns.join(","), dataLoss: false,
        summary: `Add ${kind} on ${tgt.name} (${c.columns.join(",")})`,
      });
    }
  }
  for (const c of srcCs) {
    if (!tgtSet.has(constraintKey(c, opts))) {
      out.push({
        kind: "removed",
        objectType: kind === "primaryKey" ? "primaryKey"
          : kind === "foreignKey" ? "foreignKey"
          : kind === "unique" ? "unique" : "check",
        table: src.name, object: c.name ?? c.columns.join(","),
        from: c.columns.join(","), to: null,
        dataLoss: false,
        summary: `Drop ${kind} on ${src.name} (${c.columns.join(",")})`,
      });
    }
  }
}

function indexKey(idx: ParsedIndex, opts: DiffOptions): string {
  return `${idx.unique ? "U" : "N"}|${idx.columns.map((c) => normalizeName(c, opts)).join(",")}`;
}

function diffIndexes(
  src: ParsedTable,
  tgt: ParsedTable,
  opts: DiffOptions,
  out: ChangeEvent[],
): void {
  const srcSet = new Set(src.indexes.map((i) => indexKey(i, opts)));
  const tgtSet = new Set(tgt.indexes.map((i) => indexKey(i, opts)));
  for (const idx of tgt.indexes) {
    if (!srcSet.has(indexKey(idx, opts))) {
      out.push({
        kind: "added", objectType: "index", table: tgt.name, object: idx.name,
        from: null, to: idx.columns.join(","), dataLoss: false,
        summary: `Add ${idx.unique ? "UNIQUE " : ""}index ${idx.name} on ${tgt.name} (${idx.columns.join(",")})`,
      });
    }
  }
  for (const idx of src.indexes) {
    if (!tgtSet.has(indexKey(idx, opts))) {
      out.push({
        kind: "removed", objectType: "index", table: src.name, object: idx.name,
        from: idx.columns.join(","), to: null, dataLoss: false,
        summary: `Drop index ${idx.name} on ${src.name}`,
      });
    }
  }
}

export function computeDiffStats(changes: ChangeEvent[]): DiffStats {
  const s: DiffStats = {
    tablesAdded: 0, tablesRemoved: 0,
    columnsAdded: 0, columnsRemoved: 0, columnsModified: 0,
    constraintsAdded: 0, constraintsRemoved: 0,
    indexesAdded: 0, indexesRemoved: 0,
    dataLossOps: 0, total: changes.length,
  };
  for (const c of changes) {
    if (c.dataLoss) s.dataLossOps++;
    if (c.kind === "added") {
      if (c.objectType === "table") s.tablesAdded++;
      else if (c.objectType === "column") s.columnsAdded++;
      else if (c.objectType === "index") s.indexesAdded++;
      else if (c.objectType !== "check") s.constraintsAdded++;
    } else if (c.kind === "removed") {
      if (c.objectType === "table") s.tablesRemoved++;
      else if (c.objectType === "column") s.columnsRemoved++;
      else if (c.objectType === "index") s.indexesRemoved++;
      else if (c.objectType !== "check") s.constraintsRemoved++;
    } else if (c.kind === "modified" && c.objectType === "column") {
      s.columnsModified++;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Topological sort — tables referenced by FKs must come first.
// ---------------------------------------------------------------------------

export function topologicalSort(tables: ParsedTable[], opts: DiffOptions): ParsedTable[] {
  const byName = new Map(tables.map((t) => [normalizeName(t.name, opts), t]));
  const visited = new Set<string>();
  const result: ParsedTable[] = [];
  const visiting = new Set<string>();

  const visit = (t: ParsedTable): void => {
    const key = normalizeName(t.name, opts);
    if (visited.has(key)) return;
    if (visiting.has(key)) return; // circular — break the cycle
    visiting.add(key);
    for (const fk of getForeignKeys(t)) {
      if (!fk.referencesTable) continue;
      const refKey = normalizeName(fk.referencesTable, opts);
      const refTable = byName.get(refKey);
      if (refTable) visit(refTable);
    }
    visiting.delete(key);
    visited.add(key);
    result.push(t);
  };

  for (const t of tables) visit(t);
  return result;
}

// ---------------------------------------------------------------------------
// Migration generator
// ---------------------------------------------------------------------------

/** Quote an identifier for the given dialect. */
export function quoteIdentifier(name: string, dialect: SqlDialect): string {
  // Don't double-quote if already quoted
  if (/^["`[]/.test(name)) return name;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    if (dialect === "mysql" || dialect === "sqlite") return "`" + name + "`";
    if (dialect === "sqlserver") return "[" + name + "]";
    return '"' + name + '"';
  }
  if (dialect === "sqlserver") return name; // bare is fine for sqlserver
  return name;
}

/** Render a column definition for a CREATE TABLE statement. */
export function formatColumnDef(col: ParsedColumn, dialect: SqlDialect): string {
  let out = `${quoteIdentifier(col.name, dialect)} ${col.type}`;
  if (!col.nullable) out += " NOT NULL";
  if (col.default != null) {
    out += ` DEFAULT ${col.default}`;
  }
  if (col.autoIncrement) {
    if (dialect === "mysql") out += " AUTO_INCREMENT";
    else if (dialect === "postgresql") out = out; // SERIAL handles it
    else if (dialect === "sqlite") out += " PRIMARY KEY AUTOINCREMENT";
    else if (dialect === "sqlserver") out += " IDENTITY(1,1)";
  }
  return out;
}

export function generateMigration(
  source: ParsedSchema,
  target: ParsedSchema,
  opts: DiffOptions = DEFAULT_OPTIONS,
): MigrationResult {
  const diff = diffSchemas(source, target, opts);

  const lines: string[] = [];
  lines.push(`-- Schema migration script (${opts.direction === "forward" ? "source → target" : "target → source"})`);
  lines.push(`-- Dialect: ${opts.dialect}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Changes: ${diff.stats.total} (data-loss ops: ${diff.stats.dataLossOps})`);
  lines.push("");

  const useSource = opts.direction === "reverse" ? target : source;
  const useTarget = opts.direction === "reverse" ? source : target;
  const useDiff = opts.direction === "reverse"
    ? diffSchemas(target, source, opts)
    : diff;
  const changes = useDiff.changes;

  const header = (s: string): void => {
    if (lines.length > 0 && !lines[lines.length - 1].endsWith("")) lines.push("");
    lines.push(`-- ${s}`);
  };

  // 1) Drop indexes first
  const dropIndexChanges = changes.filter((c) => c.kind === "removed" && c.objectType === "index");
  if (dropIndexChanges.length > 0) header("Drop indexes");
  for (const c of dropIndexChanges) {
    lines.push(`DROP INDEX ${quoteIdentifier(c.object ?? "", opts.dialect)};`);
  }

  // 2) Drop foreign keys before dropping columns/tables
  const dropFkChanges = changes.filter((c) => c.kind === "removed" && c.objectType === "foreignKey");
  if (dropFkChanges.length > 0) header("Drop foreign keys");
  for (const c of dropFkChanges) {
    if (opts.dialect === "mysql" || opts.dialect === "postgresql" || opts.dialect === "sqlserver") {
      const fkName = c.object ?? "";
      lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} DROP FOREIGN KEY ${quoteIdentifier(fkName, opts.dialect)};`);
    } else {
      // SQLite: must rebuild the table — emit a comment
      lines.push(`-- SQLite cannot DROP FOREIGN KEY directly; rebuild table ${c.table} without this constraint.`);
    }
  }

  // 3) Drop columns
  const dropColChanges = changes.filter((c) => c.kind === "removed" && c.objectType === "column" && opts.includeDrops);
  if (dropColChanges.length > 0) header("Drop columns");
  for (const c of dropColChanges) {
    if (c.dataLoss && opts.includeDataLossWarnings) {
      lines.push(`-- ⚠ DATA LOSS: dropping column ${c.table}.${c.object}`);
    }
    if (opts.dialect === "sqlite") {
      lines.push(`-- SQLite: rebuild table ${c.table} without column ${c.object}.`);
    } else {
      lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} DROP COLUMN ${quoteIdentifier(c.object ?? "", opts.dialect)};`);
    }
  }

  // 4) Drop tables in reverse FK order (only tables that no longer exist in target)
  const dropTableChanges = changes.filter((c) => c.kind === "removed" && c.objectType === "table" && opts.includeDrops);
  if (dropTableChanges.length > 0) header("Drop tables");
  // Reverse topological order of source tables that are being dropped
  const dropTableNames = dropTableChanges.map((c) => c.table);
  const srcTablesToDrop = useSource.tables.filter((t) => dropTableNames.includes(t.name));
  const ordered = topologicalSort(srcTablesToDrop, opts).reverse();
  for (const t of ordered) {
    if (opts.includeDataLossWarnings) {
      lines.push(`-- ⚠ DATA LOSS: dropping table ${t.name}`);
    }
    lines.push(`DROP TABLE ${quoteIdentifier(t.name, opts.dialect)};`);
  }

  // 5) Create tables in FK order
  const addTableChanges = changes.filter((c) => c.kind === "added" && c.objectType === "table");
  if (addTableChanges.length > 0) header("Create tables");
  const addTableNames = addTableChanges.map((c) => c.table);
  const tgtTablesToAdd = useTarget.tables.filter((t) => addTableNames.includes(t.name));
  const orderedAdd = topologicalSort(tgtTablesToAdd, opts);
  for (const t of orderedAdd) {
    lines.push(...formatCreateTable(t, opts.dialect));
  }

  // 6) Add/modify columns on existing tables
  const addColChanges = changes.filter((c) => c.kind === "added" && c.objectType === "column");
  const modColChanges = changes.filter((c) => c.kind === "modified" && c.objectType === "column");
  if (addColChanges.length > 0 || modColChanges.length > 0) header("Add / alter columns");
  for (const c of addColChanges) {
    const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
    const col = tgtTable?.columns.find((cc) => normalizeName(cc.name, opts) === normalizeName(c.object ?? "", opts));
    if (!col) continue;
    if (opts.dialect === "sqlite") {
      lines.push(`-- SQLite: column ${c.table}.${c.object} will be added with the next table rebuild.`);
    }
    lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ADD COLUMN ${formatColumnDef(col, opts.dialect)};`);
  }
  for (const c of modColChanges) {
    if (c.dataLoss && opts.includeDataLossWarnings) {
      lines.push(`-- ⚠ DATA LOSS: narrowing ${c.table}.${c.object} ${c.from} → ${c.to}`);
    }
    if (opts.dialect === "sqlite") {
      lines.push(`-- SQLite: cannot ALTER COLUMN ${c.table}.${c.object} in place — rebuild table.`);
    } else if (opts.dialect === "postgresql") {
      // PostgreSQL uses ALTER COLUMN TYPE / SET NOT NULL / SET DEFAULT separately
      const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
      const col = tgtTable?.columns.find((cc) => normalizeName(cc.name, opts) === normalizeName(c.object ?? "", opts));
      if (col) {
        if (c.from && c.to && c.from.toUpperCase() !== c.to.toUpperCase()) {
          lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ALTER COLUMN ${quoteIdentifier(col.name, opts.dialect)} TYPE ${col.type} USING ${quoteIdentifier(col.name, opts.dialect)}::${col.baseType};`);
        }
        if (c.from === "NULL" && c.to === "NOT NULL") {
          lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ALTER COLUMN ${quoteIdentifier(col.name, opts.dialect)} SET NOT NULL;`);
        } else if (c.from === "NOT NULL" && c.to === "NULL") {
          lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ALTER COLUMN ${quoteIdentifier(col.name, opts.dialect)} DROP NOT NULL;`);
        }
      }
    } else {
      const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
      const col = tgtTable?.columns.find((cc) => normalizeName(cc.name, opts) === normalizeName(c.object ?? "", opts));
      if (col) {
        lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ALTER COLUMN ${quoteIdentifier(col.name, opts.dialect)} ${formatColumnDef(col, opts.dialect).replace(/^.*?\s/, "")};`);
      }
    }
  }

  // 7) Add foreign keys (after columns/tables exist)
  const addFkChanges = changes.filter((c) => c.kind === "added" && c.objectType === "foreignKey");
  if (addFkChanges.length > 0) header("Add foreign keys");
  for (const c of addFkChanges) {
    const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
    const fk = tgtTable?.constraints.find((cc) => cc.kind === "foreignKey" && (cc.name === c.object || cc.columns.join(",") === c.object));
    if (!fk) continue;
    const fkName = fk.name ?? `fk_${c.table}_${fk.columns.join("_")}`;
    lines.push(
      `ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ADD CONSTRAINT ${quoteIdentifier(fkName, opts.dialect)} FOREIGN KEY (${fk.columns.map((x) => quoteIdentifier(x, opts.dialect)).join(", ")}) REFERENCES ${quoteIdentifier(fk.referencesTable ?? "", opts.dialect)} (${fk.referencesColumns.map((x) => quoteIdentifier(x, opts.dialect)).join(", ")});`,
    );
  }

  // 8) Add unique / primary key constraints
  const addUniqueChanges = changes.filter((c) => c.kind === "added" && (c.objectType === "unique" || c.objectType === "primaryKey"));
  if (addUniqueChanges.length > 0) header("Add unique / primary keys");
  for (const c of addUniqueChanges) {
    const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
    const con = tgtTable?.constraints.find((cc) =>
      (cc.kind === c.objectType) && (cc.name === c.object || cc.columns.join(",") === c.object),
    );
    if (!con) continue;
    const kw = con.kind === "primaryKey" ? "PRIMARY KEY" : "UNIQUE";
    const name = con.name ? `${quoteIdentifier(con.name, opts.dialect)} ` : "";
    lines.push(
      `ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} ADD CONSTRAINT ${name}${kw} (${con.columns.map((x) => quoteIdentifier(x, opts.dialect)).join(", ")});`,
    );
  }

  // 9) Add indexes last
  const addIndexChanges = changes.filter((c) => c.kind === "added" && c.objectType === "index");
  if (addIndexChanges.length > 0) header("Add indexes");
  for (const c of addIndexChanges) {
    const tgtTable = useTarget.tables.find((t) => normalizeName(t.name, opts) === normalizeName(c.table, opts));
    const idx = tgtTable?.indexes.find((ii) => ii.name === c.object);
    if (!idx) continue;
    lines.push(
      `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(idx.name, opts.dialect)} ON ${quoteIdentifier(c.table, opts.dialect)} (${idx.columns.map((x) => quoteIdentifier(x, opts.dialect)).join(", ")});`,
    );
  }

  // 10) Drop constraints (PK/UNIQUE/CHECK) at the end
  const dropConChanges = changes.filter((c) =>
    c.kind === "removed" && (c.objectType === "unique" || c.objectType === "primaryKey" || c.objectType === "check"),
  );
  if (dropConChanges.length > 0) header("Drop constraints");
  for (const c of dropConChanges) {
    const conName = c.object ?? "";
    if (c.objectType === "primaryKey") {
      lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} DROP PRIMARY KEY;`);
    } else if (c.objectType === "unique") {
      lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} DROP INDEX ${quoteIdentifier(conName, opts.dialect)};`);
    } else {
      lines.push(`ALTER TABLE ${quoteIdentifier(c.table, opts.dialect)} DROP CONSTRAINT ${quoteIdentifier(conName, opts.dialect)};`);
    }
  }

  const sql = lines.join("\n");
  return { ok: true, sql, statementCount: (sql.match(/;/g) ?? []).length, dataLossOps: diff.stats.dataLossOps };
}

function formatCreateTable(t: ParsedTable, dialect: SqlDialect): string[] {
  const lines: string[] = [];
  lines.push(`CREATE TABLE ${quoteIdentifier(t.name, dialect)} (`);
  const body: string[] = [];
  for (const c of t.columns) body.push("  " + formatColumnDef(c, dialect));
  for (const con of t.constraints) {
    if (con.kind === "primaryKey") {
      body.push(`  PRIMARY KEY (${con.columns.map((x) => quoteIdentifier(x, dialect)).join(", ")})`);
    } else if (con.kind === "foreignKey") {
      const name = con.name ? `CONSTRAINT ${quoteIdentifier(con.name, dialect)} ` : "";
      body.push(
        `  ${name}FOREIGN KEY (${con.columns.map((x) => quoteIdentifier(x, dialect)).join(", ")}) REFERENCES ${quoteIdentifier(con.referencesTable ?? "", dialect)} (${con.referencesColumns.map((x) => quoteIdentifier(x, dialect)).join(", ")})`,
      );
    } else if (con.kind === "unique") {
      const name = con.name ? `CONSTRAINT ${quoteIdentifier(con.name, dialect)} ` : "";
      body.push(`  ${name}UNIQUE (${con.columns.map((x) => quoteIdentifier(x, dialect)).join(", ")})`);
    } else if (con.kind === "check") {
      const name = con.name ? `CONSTRAINT ${quoteIdentifier(con.name, dialect)} ` : "";
      body.push(`  ${name}CHECK ${con.checkExpr ?? "(1=1)"}`);
    }
  }
  lines.push(body.join(",\n"));
  lines.push(");");
  return lines;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:database-schema-diff:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dialect: SqlDialect;
  direction: DiffDirection;
  sourcePreview: string;
  targetPreview: string;
  totalChanges: number;
  dataLossOps: number;
  statementCount: number;
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
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: DiffOptions): string {
  const params = new URLSearchParams();
  params.set("d", opts.dialect);
  params.set("dir", opts.direction);
  params.set("ico", opts.ignoreColumnOrder ? "1" : "0");
  params.set("icase", opts.ignoreCase ? "1" : "0");
  params.set("dlw", opts.includeDataLossWarnings ? "1" : "0");
  params.set("drops", opts.includeDrops ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): DiffOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: DiffOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (d && (["ansi", "mysql", "postgresql", "sqlite", "sqlserver"] as SqlDialect[]).includes(d as SqlDialect)) {
    base.dialect = d as SqlDialect;
  }
  const dir = params.get("dir");
  if (dir === "forward" || dir === "reverse") base.direction = dir;
  if (params.get("ico") === "1") base.ignoreColumnOrder = true;
  if (params.get("ico") === "0") base.ignoreColumnOrder = false;
  if (params.get("icase") === "1") base.ignoreCase = true;
  if (params.get("icase") === "0") base.ignoreCase = false;
  if (params.get("dlw") === "1") base.includeDataLossWarnings = true;
  if (params.get("dlw") === "0") base.includeDataLossWarnings = false;
  if (params.get("drops") === "1") base.includeDrops = true;
  if (params.get("drops") === "0") base.includeDrops = false;
  return base;
}

// ---------------------------------------------------------------------------
// Sample DDL
// ---------------------------------------------------------------------------

export const SAMPLE_SOURCE_DDL = `-- Source schema (older version)
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE posts (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  published_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts (user_id);
CREATE INDEX idx_posts_published ON posts (published_at);
`;

export const SAMPLE_TARGET_DDL = `-- Target schema (newer version)
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(320) NOT NULL,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE (email),
  UNIQUE (username)
);

CREATE TABLE posts (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  body TEXT NULL,
  views INT NOT NULL DEFAULT 0,
  published_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts (user_id);
CREATE INDEX idx_posts_published ON posts (published_at);
CREATE INDEX idx_posts_slug ON posts (slug);

CREATE TABLE tags (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (name)
);

CREATE TABLE post_tags (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);
`;
