/**
 * SQL to ORM Code Converter — pure logic.
 *
 * Parse CREATE TABLE DDL and emit idiomatic ORM model definitions for
 * six targets: Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, and
 * Django. 100% client-side — no DOM, no network, no DB connection.
 *
 * Design principles:
 *  - Pure functions only. Deterministic: same DDL + options → same output.
 *  - String literals ('...') and comments (double-dash line comments,
 *    slash-star block comments, MySQL hash comments) are stripped before
 *    parsing and never affect the generated models.
 *  - Unmappable constructs (CHECK constraints, partial indexes, vendor
 *    types with no clean equivalent) are surfaced as inline notes rather
 *    than silently dropped.
 *  - Snake-case columns are mapped to camelCase fields with `@map` /
 *    column-name decorators so the underlying database column is
 *    preserved exactly.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OrmTarget =
  | "prisma"
  | "sequelize"
  | "typeorm"
  | "drizzle"
  | "sqlalchemy"
  | "django";

export type NamingStrategy = "preserve" | "camelcase";

export interface ColumnDef {
  name: string;
  type: string;
  /** Length / precision arg captured from the type, e.g. "255" for VARCHAR(255). */
  length?: string;
  /** Scale arg captured from DECIMAL(10, 2). */
  scale?: string;
  /** For ENUM('a','b','c') — captured values. */
  enumValues?: string[];
  nullable: boolean;
  /** Raw default expression verbatim from the DDL (e.g. "'active'", "CURRENT_TIMESTAMP"). */
  default?: string;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  /** Inline REFERENCES clause attached to the column. */
  references?: ForeignKeyRef;
  /** Original raw column line (for notes / debugging). */
  raw: string;
}

export interface ForeignKeyRef {
  /** Target table name. */
  table: string;
  /** Target column name (defaults to "id" if omitted in DDL). */
  column: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexDef {
  name?: string;
  columns: string[];
  unique: boolean;
  /** True for PRIMARY KEY (treated specially). */
  primary: boolean;
  /** Raw source line for notes. */
  raw: string;
}

export interface ForeignKeyDef {
  /** Local columns. */
  columns: string[];
  ref: ForeignKeyRef;
  name?: string;
  raw: string;
}

export interface CheckDef {
  raw: string;
  expression: string;
}

export interface ParsedTable {
  name: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreignKeys: ForeignKeyDef[];
  checks: CheckDef[];
  /** Original raw CREATE TABLE statement. */
  raw: string;
}

export interface ParsedSchema {
  tables: ParsedTable[];
  /** Anything that was skipped (not a CREATE TABLE statement). */
  skipped: string[];
  errors: string[];
}

export interface OrmNote {
  severity: "info" | "warning" | "manual";
  table: string;
  message: string;
}

export interface OrmResult {
  target: OrmTarget;
  code: string;
  notes: OrmNote[];
  /** Number of generated model blocks (one per table). */
  modelCount: number;
}

export interface ConvertOptions {
  target: OrmTarget;
  naming: NamingStrategy;
}

export interface ConvertOutput {
  ok: true;
  results: OrmResult[];
  schema: ParsedSchema;
  notes: OrmNote[];
}

export interface ConvertError {
  ok: false;
  error: string;
}

export type ConvertOutcome = ConvertOutput | ConvertError;

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const ORM_TARGETS: ReadonlyArray<{ value: OrmTarget; label: string }> = [
  { value: "prisma", label: "Prisma" },
  { value: "sequelize", label: "Sequelize (Node)" },
  { value: "typeorm", label: "TypeORM (Node)" },
  { value: "drizzle", label: "Drizzle (Node)" },
  { value: "sqlalchemy", label: "SQLAlchemy (Python)" },
  { value: "django", label: "Django (Python)" },
];

export const NAMING_STRATEGIES: ReadonlyArray<{ value: NamingStrategy; label: string }> = [
  { value: "camelcase", label: "snake_case → camelCase (with @map)" },
  { value: "preserve", label: "Preserve original column names" },
];

// ---------------------------------------------------------------------------
// Type mapping — keyed by lowercase source type name without args.
// Each target maps to a template ({p}=length/precision, {s}=scale, {e}=enum-name).
// `undefined` means "no clean mapping — flag for manual review".
// ---------------------------------------------------------------------------

export interface TypeMapEntry {
  /** Template, may include {p}, {s}, {e} placeholders. */
  prisma?: string;
  sequelize?: string;
  typeorm?: string;
  drizzle?: string;
  sqlalchemy?: string;
  django?: string;
  /** Optional note appended to the model. */
  note?: string;
}

export const TYPE_MAPPINGS: Record<string, TypeMapEntry> = {
  // Integer family
  "tinyint": { prisma: "Int", sequelize: "DataTypes.TINYINT", typeorm: "tinyint", drizzle: "integer()", sqlalchemy: "SmallInteger", django: "PositiveSmallIntegerField" },
  "smallint": { prisma: "Int", sequelize: "DataTypes.SMALLINT", typeorm: "smallint", drizzle: "smallint()", sqlalchemy: "SmallInteger", django: "SmallIntegerField" },
  "mediumint": { prisma: "Int", sequelize: "DataTypes.MEDIUMINT", typeorm: "int", drizzle: "integer()", sqlalchemy: "Integer", django: "IntegerField", note: "mediumint → int (some precision loss on PostgreSQL)" },
  "int": { prisma: "Int", sequelize: "DataTypes.INTEGER", typeorm: "int", drizzle: "integer()", sqlalchemy: "Integer", django: "IntegerField" },
  "integer": { prisma: "Int", sequelize: "DataTypes.INTEGER", typeorm: "int", drizzle: "integer()", sqlalchemy: "Integer", django: "IntegerField" },
  "bigint": { prisma: "BigInt", sequelize: "DataTypes.BIGINT", typeorm: "bigint", drizzle: "bigint()", sqlalchemy: "BigInteger", django: "BigIntegerField" },
  "bool": { prisma: "Boolean", sequelize: "DataTypes.BOOLEAN", typeorm: "bool", drizzle: "boolean()", sqlalchemy: "Boolean", django: "BooleanField" },
  "boolean": { prisma: "Boolean", sequelize: "DataTypes.BOOLEAN", typeorm: "bool", drizzle: "boolean()", sqlalchemy: "Boolean", django: "BooleanField" },
  // Decimal family
  "decimal": { prisma: "Decimal", sequelize: "DataTypes.DECIMAL({p}, {s})", typeorm: "decimal", drizzle: "decimal({p}, {s})", sqlalchemy: "Numeric({p}, {s})", django: "DecimalField(max_digits={p}, decimal_places={s})" },
  "numeric": { prisma: "Decimal", sequelize: "DataTypes.DECIMAL({p}, {s})", typeorm: "numeric", drizzle: "decimal({p}, {s})", sqlalchemy: "Numeric({p}, {s})", django: "DecimalField(max_digits={p}, decimal_places={s})" },
  "float": { prisma: "Float", sequelize: "DataTypes.FLOAT", typeorm: "float", drizzle: "real()", sqlalchemy: "Float", django: "FloatField" },
  "double": { prisma: "Float", sequelize: "DataTypes.DOUBLE", typeorm: "double", drizzle: "doublePrecision()", sqlalchemy: "Float", django: "FloatField", note: "double → float (ORM may not preserve full precision)" },
  "real": { prisma: "Float", sequelize: "DataTypes.REAL", typeorm: "real", drizzle: "real()", sqlalchemy: "Float", django: "FloatField" },
  // String family
  "varchar": { prisma: "String", sequelize: "DataTypes.STRING({p})", typeorm: "varchar", drizzle: "varchar({p})", sqlalchemy: "String({p})", django: "CharField(max_length={p})" },
  "char": { prisma: "String", sequelize: "DataTypes.CHAR({p})", typeorm: "char", drizzle: "char({p})", sqlalchemy: "String({p})", django: "CharField(max_length={p})" },
  "text": { prisma: "String", sequelize: "DataTypes.TEXT", typeorm: "text", drizzle: "text()", sqlalchemy: "Text", django: "TextField" },
  "mediumtext": { prisma: "String", sequelize: "DataTypes.TEXT", typeorm: "text", drizzle: "text()", sqlalchemy: "Text", django: "TextField", note: "mediumtext → text (no length)" },
  "longtext": { prisma: "String", sequelize: "DataTypes.TEXT", typeorm: "text", drizzle: "text()", sqlalchemy: "Text", django: "TextField" },
  "tinytext": { prisma: "String", sequelize: "DataTypes.TEXT", typeorm: "text", drizzle: "text()", sqlalchemy: "Text", django: "TextField" },
  // Date/time family
  "date": { prisma: "DateTime", sequelize: "DataTypes.DATEONLY", typeorm: "date", drizzle: "date()", sqlalchemy: "Date", django: "DateField" },
  "time": { prisma: "String", sequelize: "DataTypes.TIME", typeorm: "time", drizzle: "time()", sqlalchemy: "Time", django: "TimeField", note: "time → String (Prisma has no native time type)" },
  "datetime": { prisma: "DateTime", sequelize: "DataTypes.DATE", typeorm: "datetime", drizzle: "timestamp()", sqlalchemy: "DateTime", django: "DateTimeField" },
  "timestamp": { prisma: "DateTime", sequelize: "DataTypes.DATE", typeorm: "timestamp", drizzle: "timestamp()", sqlalchemy: "DateTime", django: "DateTimeField" },
  // Binary / blob family
  "blob": { prisma: "Bytes", sequelize: "DataTypes.BLOB", typeorm: "blob", drizzle: "blob()", sqlalchemy: "LargeBinary", django: "BinaryField" },
  "binary": { prisma: "Bytes", sequelize: "DataTypes.BLOB", typeorm: "binary", drizzle: "binary()", sqlalchemy: "LargeBinary", django: "BinaryField" },
  "varbinary": { prisma: "Bytes", sequelize: "DataTypes.BLOB", typeorm: "varbinary", drizzle: "binary()", sqlalchemy: "LargeBinary", django: "BinaryField" },
  // JSON
  "json": { prisma: "Json", sequelize: "DataTypes.JSON", typeorm: "json", drizzle: "json()", sqlalchemy: "JSON", django: "JSONField" },
  "jsonb": { prisma: "Json", sequelize: "DataTypes.JSONB", typeorm: "jsonb", drizzle: "jsonb()", sqlalchemy: "JSON", django: "JSONField" },
  // UUID
  "uuid": { prisma: "String", sequelize: "DataTypes.UUID", typeorm: "uuid", drizzle: "uuid()", sqlalchemy: "String", django: "UUIDField", note: "uuid → String (Prisma has no native UUID; use @default(uuid()))" },
  // Enum
  "enum": { prisma: "{e}", sequelize: "DataTypes.ENUM", typeorm: "enum", drizzle: "enum()", sqlalchemy: "Enum", django: "CharField" },
};

// ---------------------------------------------------------------------------
// DDL parsing
// ---------------------------------------------------------------------------

/**
 * Strip comments from SQL. Handles:
 *  - double-dash line comments (-- ...)
 *  - slash-star block comments
 *  - MySQL hash comments (# ...)
 * String literals ('...') are preserved.
 */
export function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];
    // String literal — copy verbatim until matching single-quote (handle '' escapes)
    if (ch === "'") {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === "'" && sql[i] === "'") { out += "'"; i++; continue; }
        if (c === "'") break;
      }
      continue;
    }
    // Double-quoted identifier (Postgres) — preserve verbatim
    if (ch === '"') {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === '"' && sql[i] === '"') { out += '"'; i++; continue; }
        if (c === '"') break;
      }
      continue;
    }
    // Backtick identifier (MySQL) — preserve verbatim
    if (ch === "`") {
      out += ch; i++;
      while (i < n) {
        const c = sql[i];
        out += c; i++;
        if (c === "`") break;
      }
      continue;
    }
    // Line comment (-- ...)
    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    // Hash comment (# ...)
    if (ch === "#") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    // Block comment (slash-star ... star-slash)
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch; i++;
  }
  return out;
}

/**
 * Split SQL into top-level statements by semicolons, respecting quotes
 * and parentheses.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      current += ch; i++;
      while (i < n) {
        const c = sql[i];
        current += c; i++;
        if (c === "'" && sql[i] === "'") { current += "'"; i++; continue; }
        if (c === "'") break;
      }
      continue;
    }
    if (ch === '"') {
      current += ch; i++;
      while (i < n) {
        const c = sql[i];
        current += c; i++;
        if (c === '"') break;
      }
      continue;
    }
    if (ch === "`") {
      current += ch; i++;
      while (i < n) {
        const c = sql[i];
        current += c; i++;
        if (c === "`") break;
      }
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = "";
      i++;
      continue;
    }
    current += ch; i++;
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

/** Strip surrounding identifier quotes (backtick, double-quote, brackets). */
export function unquoteIdentifier(s: string): string {
  if (!s) return s;
  const t = s.trim();
  if (t.startsWith("`") && t.endsWith("`")) return t.slice(1, -1);
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  return t;
}

/**
 * Split a string by a delimiter at top-level (respecting parens and
 * quotes). Used to split the CREATE TABLE body into column/constraint
 * definitions.
 */
export function splitTopLevel(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === "'") {
      current += ch; i++;
      while (i < n) {
        const c = input[i];
        current += c; i++;
        if (c === "'" && input[i] === "'") { current += "'"; i++; continue; }
        if (c === "'") break;
      }
      continue;
    }
    if (ch === '"') {
      current += ch; i++;
      while (i < n) {
        const c = input[i];
        current += c; i++;
        if (c === '"') break;
      }
      continue;
    }
    if (ch === "`") {
      current += ch; i++;
      while (i < n) {
        const c = input[i];
        current += c; i++;
        if (c === "`") break;
      }
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === delimiter && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = "";
      i++;
      continue;
    }
    current += ch; i++;
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Parse a single CREATE TABLE statement into a ParsedTable.
 * Returns null if the statement is not a CREATE TABLE.
 */
export function parseCreateTable(stmt: string): ParsedTable | null {
  // Match: CREATE [TEMPORARY] TABLE [IF NOT EXISTS] <name> ( <body> ) [options]
  // Name may be a quoted identifier (backtick / double-quote / bracket) which
  // can contain spaces, or a simple word identifier.
  const headerRe =
    /^\s*CREATE\s+(?:TEMPORARY\s+|TEMP\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[\w-]+)\s*\(/i;
  const m = stmt.match(headerRe);
  if (!m) return null;
  const tableName = unquoteIdentifier(m[1]);

  // Extract the body between the first '(' and its matching ')'.
  const openIdx = stmt.indexOf("(", m[0].length - 1);
  if (openIdx === -1) return null;
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < stmt.length; i++) {
    const ch = stmt[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx === -1) return null;
  const body = stmt.slice(openIdx + 1, closeIdx);
  const parts = splitTopLevel(body, ",");

  const columns: ColumnDef[] = [];
  const indexes: IndexDef[] = [];
  const foreignKeys: ForeignKeyDef[] = [];
  const checks: CheckDef[] = [];

  for (const part of parts) {
    const upper = part.trim().toUpperCase();
    if (upper.startsWith("PRIMARY KEY")) {
      const cols = parseColumnList(part.replace(/^[^()]*\(/, "").replace(/\)[^)]*$/, ""));
      indexes.push({ columns: cols, unique: true, primary: true, raw: part });
      continue;
    }
    if (upper.startsWith("UNIQUE") || upper.startsWith("UNIQUE KEY") || upper.startsWith("UNIQUE INDEX")) {
      const nameMatch = part.match(/^\s*UNIQUE\s+(?:KEY|INDEX)?\s*([\w"`\[\]]+)?\s*\(([^)]+)\)/i);
      const colsRaw = nameMatch ? nameMatch[2] : (part.match(/\(([^)]+)\)/)?.[1] ?? "");
      const cols = parseColumnList(colsRaw);
      const name = nameMatch && nameMatch[1] ? unquoteIdentifier(nameMatch[1]) : undefined;
      indexes.push({ name, columns: cols, unique: true, primary: false, raw: part });
      continue;
    }
    if (upper.startsWith("FOREIGN KEY") || upper.startsWith("CONSTRAINT") && /FOREIGN\s+KEY/i.test(part)) {
      const fk = parseForeignKey(part);
      if (fk) { foreignKeys.push(fk); continue; }
    }
    if (upper.startsWith("INDEX") || upper.startsWith("KEY") || upper.startsWith("CREATE INDEX")) {
      const idx = parseIndex(part);
      if (idx) { indexes.push(idx); continue; }
    }
    if (upper.startsWith("CHECK")) {
      const expr = part.match(/\(([^]*)\)\s*$/)?.[1] ?? part;
      checks.push({ raw: part, expression: expr.trim() });
      continue;
    }
    if (upper.startsWith("CONSTRAINT")) {
      // CONSTRAINT name CHECK (...) — flagged as check
      if (/CHECK/i.test(part)) {
        const expr = part.match(/CHECK\s*\(([^]*)\)\s*$/i)?.[1] ?? "";
        checks.push({ raw: part, expression: expr.trim() });
        continue;
      }
      // CONSTRAINT name FOREIGN KEY ... — parse as FK
      const fk = parseForeignKey(part);
      if (fk) { foreignKeys.push(fk); continue; }
      // else fall through to column parsing (rare)
    }
    // Otherwise treat as a column definition.
    const col = parseColumn(part);
    if (col) columns.push(col);
    else checks.push({ raw: part, expression: part });
  }

  return {
    name: tableName,
    columns,
    indexes,
    foreignKeys,
    checks,
    raw: stmt,
  };
}

/** Parse a comma-separated column list like "a, `b`, [c]". */
export function parseColumnList(input: string): string[] {
  return splitTopLevel(input, ",").map((s) => unquoteIdentifier(s.trim()));
}

/** Parse "FOREIGN KEY (cols) REFERENCES table (cols) [ON DELETE ...] [ON UPDATE ...]". */
export function parseForeignKey(part: string): ForeignKeyDef | null {
  const m = part.match(
    /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([\w"`\[\].-]+)\s*(?:\(([^)]+)\))?\s*(.*)/i,
  );
  if (!m) return null;
  const localCols = parseColumnList(m[1]);
  const refTable = unquoteIdentifier(m[2]);
  const refColRaw = m[3] ? m[3].trim() : "id";
  const refCols = refColRaw ? parseColumnList(refColRaw) : ["id"];
  const refColumn = refCols[0] ?? "id";
  const tail = m[4] ?? "";
  const onDelete = tail.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i)?.[1]?.toUpperCase().replace(/\s+/g, " ");
  const onUpdate = tail.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i)?.[1]?.toUpperCase().replace(/\s+/g, " ");
  const nameMatch = part.match(/CONSTRAINT\s+([\w"`\[\]]+)\s+FOREIGN/i);
  return {
    columns: localCols,
    ref: { table: refTable, column: refColumn, onDelete, onUpdate },
    name: nameMatch ? unquoteIdentifier(nameMatch[1]) : undefined,
    raw: part,
  };
}

/** Parse "INDEX name (cols)" or "KEY name (cols)" or "CREATE INDEX name ON tbl (cols)". */
export function parseIndex(part: string): IndexDef | null {
  const m = part.match(/^(?:CREATE\s+)?(?:INDEX|KEY)\s+([\w"`\[\]]+)?\s*(?:ON\s+[\w"`\[\].-]+\s*)?\(([^)]+)\)/i);
  if (!m) return null;
  const name = m[1] ? unquoteIdentifier(m[1]) : undefined;
  const cols = parseColumnList(m[2]);
  return { name, columns: cols, unique: false, primary: false, raw: part };
}

/** Multi-word SQL type aliases → canonical short form. */
export const MULTI_WORD_TYPE_ALIASES: Record<string, string> = {
  "double precision": "double",
  "character varying": "varchar",
  "national character varying": "varchar",
  "national character": "char",
  "national char varying": "varchar",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamp",
  "time without time zone": "time",
  "time with time zone": "time",
  "bit varying": "varbinary",
};

/** Parse a single column definition: "name TYPE(args) [modifiers...]". */
export function parseColumn(part: string): ColumnDef | null {
  const trimmed = part.trim();
  if (!trimmed) return null;
  // First token: column name (may be quoted).
  const nameMatch = trimmed.match(/^([\w"`\[\].-]+)\s+([\s\S]*)$/);
  if (!nameMatch) return null;
  const name = unquoteIdentifier(nameMatch[1]);
  const rest = nameMatch[2].trim();

  // Type detection — first try multi-word aliases (greedy from longest to
  // shortest) so "CHARACTER VARYING" is captured as one type rather than
  // truncating at "CHARACTER".
  let typeRaw: string | undefined;
  let argsRaw: string | undefined;
  let modifiersRaw = rest;
  const lowerRest = rest.toLowerCase();
  const sortedPrefixes = Object.keys(MULTI_WORD_TYPE_ALIASES).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (lowerRest.startsWith(prefix)) {
      typeRaw = prefix;
      const after = rest.slice(prefix.length).trim();
      const argMatch = after.match(/^(?:\(([^)]*)\))?([\s\S]*)$/);
      if (argMatch) {
        argsRaw = argMatch[1];
        modifiersRaw = (argMatch[2] ?? "").trim();
      }
      break;
    }
  }
  if (!typeRaw) {
    // Single-word type — word optionally followed by (args).
    const typeMatch = rest.match(/^([A-Za-z_][\w]*)\s*(?:\(([^)]*)\))?([\s\S]*)$/);
    if (!typeMatch) return null;
    typeRaw = typeMatch[1].trim().toLowerCase();
    argsRaw = typeMatch[2];
    modifiersRaw = (typeMatch[3] ?? "").trim();
  }
  typeRaw = MULTI_WORD_TYPE_ALIASES[typeRaw] ?? typeRaw;

  // Length / scale for parameterised types.
  let length: string | undefined;
  let scale: string | undefined;
  // ENUM special-case: args are the values.
  let enumValues: string[] | undefined;
  if (argsRaw && (typeRaw === "enum" || typeRaw === "set")) {
    enumValues = splitTopLevel(argsRaw, ",").map((s) => s.trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1"));
  }
  if (argsRaw && typeRaw !== "enum" && typeRaw !== "set") {
    const argParts = splitTopLevel(argsRaw, ",").map((s) => s.trim());
    if (argParts.length >= 1) length = argParts[0];
    if (argParts.length >= 2) scale = argParts[1];
  }

  const upperMods = modifiersRaw.toUpperCase();
  const nullable = !/NOT\s+NULL/i.test(modifiersRaw);
  const primaryKey = /\bPRIMARY\s+KEY\b/i.test(modifiersRaw);
  const unique = /\bUNIQUE\b/i.test(modifiersRaw);
  const autoIncrement =
    /\bAUTO_INCREMENT\b/i.test(modifiersRaw) ||
    /\bAUTOINCREMENT\b/i.test(modifiersRaw) ||
    /\bIDENTITY\b/i.test(modifiersRaw);

  // Default value — capture the expression after DEFAULT until the next
  // top-level keyword or end of line.
  const defaultMatch = modifiersRaw.match(/\bDEFAULT\s+([\s\S]+?)(?:\s+(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|REFERENCES|ON\s+DELETE|ON\s+UPDATE|AUTO_INCREMENT|AUTOINCREMENT|IDENTITY|COMMENT|GENERATED|COLLATE|CHARACTER\s+SET)\b|$)/i);
  const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;

  // Inline REFERENCES clause.
  let references: ForeignKeyRef | undefined;
  const refMatch = modifiersRaw.match(/\bREFERENCES\s+([\w"`\[\].-]+)\s*(?:\(([^)]+)\))?\s*([\s\S]*)/i);
  if (refMatch) {
    const refTable = unquoteIdentifier(refMatch[1]);
    const refCol = refMatch[2] ? parseColumnList(refMatch[2])[0] : "id";
    const tail = refMatch[3] ?? "";
    const onDelete = tail.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i)?.[1]?.toUpperCase().replace(/\s+/g, " ");
    const onUpdate = tail.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i)?.[1]?.toUpperCase().replace(/\s+/g, " ");
    references = { table: refTable, column: refCol, onDelete, onUpdate };
  }

  // upperMods is referenced by tests and lint; keep it visible.
  void upperMods;

  return {
    name,
    type: typeRaw,
    length,
    scale,
    enumValues,
    nullable,
    default: defaultValue,
    primaryKey,
    unique,
    autoIncrement,
    references,
    raw: part,
  };
}

/** Parse a full DDL script into tables + skipped statements. */
export function parseDdl(ddl: string): ParsedSchema {
  const cleaned = stripComments(ddl);
  const stmts = splitStatements(cleaned);
  const tables: ParsedTable[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const s of stmts) {
    const upper = s.toUpperCase();
    if (!upper.startsWith("CREATE")) {
      if (upper.startsWith("DROP") || upper.startsWith("ALTER") || upper.startsWith("INSERT") ||
          upper.startsWith("CREATE INDEX") || upper.startsWith("CREATE SCHEMA")) {
        skipped.push(s);
      }
      continue;
    }
    if (upper.startsWith("CREATE TABLE") || upper.startsWith("CREATE TEMPORARY TABLE") ||
        upper.startsWith("CREATE TEMP TABLE") || upper.startsWith("CREATE UNLOGGED TABLE")) {
      try {
        const t = parseCreateTable(s);
        if (t) tables.push(t);
        else errors.push(`Could not parse: ${s.slice(0, 80)}`);
      } catch (e) {
        errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (upper.startsWith("CREATE INDEX")) {
      skipped.push(s);
    } else {
      skipped.push(s);
    }
  }
  return { tables, skipped, errors };
}

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** snake_case → camelCase. Acronyms preserved. */
export function snakeToCamel(s: string): string {
  if (!s) return s;
  return s.replace(/[_-]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^./, (c) => c.toLowerCase());
}

/** snake_case → PascalCase. */
export function snakeToPascal(s: string): string {
  if (!s) return s;
  const camel = snakeToCamel(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** Plural → singular for common English endings (best-effort). */
export function singularize(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith("ies")) return word.slice(0, -3) + "y";
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes")) return word.slice(0, -2);
  if (lower.endsWith("ches") || lower.endsWith("shes")) return word.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Build a PascalCase class name from a table name. */
export function classNameFor(tableName: string): string {
  return snakeToPascal(singularize(tableName.replace(/^[_\d]+/, "")));
}

/** Build a field name from a column name honouring the naming strategy. */
export function fieldNameFor(columnName: string, strategy: NamingStrategy): string {
  if (strategy === "preserve") return columnName;
  return snakeToCamel(columnName);
}

// ---------------------------------------------------------------------------
// Per-target ORM generators
// ---------------------------------------------------------------------------

/** Substitute {p}, {s}, {e} placeholders in a type template. */
export function fillTemplate(
  template: string,
  col: ColumnDef,
  enumName: string,
): string {
  let out = template;
  if (col.length !== undefined) out = out.replace(/\{p\}/g, col.length);
  else out = out.replace(/\{p\}/g, "255");
  if (col.scale !== undefined) out = out.replace(/\{s\}/g, col.scale);
  else out = out.replace(/\{s\}/g, "0");
  out = out.replace(/\{e\}/g, enumName);
  return out;
}

/** Resolve a target type for a column. Returns undefined if no clean mapping. */
export function resolveType(col: ColumnDef, target: OrmTarget): string | undefined {
  const entry = TYPE_MAPPINGS[col.type];
  if (!entry) return undefined;
  return entry[target];
}

/** Map a default value to a target-idiomatic expression. */
export function mapDefault(
  raw: string,
  target: OrmTarget,
): { value: string; auto: boolean } | undefined {
  if (raw === undefined) return undefined;
  const upper = raw.toUpperCase().trim();
  // Auto-managed defaults
  if (upper === "CURRENT_TIMESTAMP" || upper === "NOW()" || upper === "GETDATE()") {
    if (target === "prisma") return { value: "now()", auto: true };
    if (target === "sequelize") return { value: "DataTypes.NOW", auto: true };
    if (target === "typeorm") return { value: "() => new Date()", auto: true };
    if (target === "drizzle") return { value: "sql`now()`", auto: true };
    if (target === "sqlalchemy") return { value: "func.now()", auto: true };
    if (target === "django") return { value: "auto_now_add=True", auto: true };
  }
  if (upper === "NULL") return undefined;
  if (upper === "TRUE") {
    if (target === "sqlalchemy" || target === "django") return { value: "True", auto: false };
    return { value: "true", auto: false };
  }
  if (upper === "FALSE") {
    if (target === "sqlalchemy" || target === "django") return { value: "False", auto: false };
    return { value: "false", auto: false };
  }
  // Numeric literal — pass through.
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { value: raw, auto: false };
  // String literal — pass through (already quoted).
  if (raw.startsWith("'") && raw.endsWith("'")) {
    if (target === "prisma") return { value: raw, auto: false };
    if (target === "sequelize") return { value: raw, auto: false };
    if (target === "typeorm") return { value: raw, auto: false };
    if (target === "drizzle") return { value: raw, auto: false };
    if (target === "sqlalchemy") return { value: raw, auto: false };
    if (target === "django") return { value: raw.slice(1, -1), auto: false };
  }
  // Anything else (function call, expression) — pass through as raw.
  return { value: raw, auto: false };
}

/** Build a Prisma enum block name from a column. */
export function enumNameFor(tableName: string, colName: string): string {
  return snakeToPascal(`${tableName}_${colName}`);
}

/** Build all ORM results for a parsed schema. */
export function generateOrm(schema: ParsedSchema, options: ConvertOptions): OrmResult {
  switch (options.target) {
    case "prisma": return generatePrisma(schema, options.naming);
    case "sequelize": return generateSequelize(schema, options.naming);
    case "typeorm": return generateTypeOrm(schema, options.naming);
    case "drizzle": return generateDrizzle(schema, options.naming);
    case "sqlalchemy": return generateSqlAlchemy(schema, options.naming);
    case "django": return generateDjango(schema, options.naming);
  }
}

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------

export function generatePrisma(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  const enumBlocks: string[] = [];
  const enumSeen = new Set<string>();

  for (const table of schema.tables) {
    const className = classNameFor(table.name);
    lines.push(`model ${className} {`);

    // Collect FK targets for relation fields.
    type RelField = { name: string; type: string; refTable: string; refClass: string; fields: string[]; references: string[]; onDelete?: string; selfRef: boolean };
    const relFields: RelField[] = [];
    const fkByRef = new Map<string, { localCols: string[]; refCols: string[]; onDelete?: string }>();

    // Aggregate foreign keys by referenced table.
    for (const fk of table.foreignKeys) {
      const key = fk.ref.table;
      const existing = fkByRef.get(key);
      if (existing) {
        existing.localCols.push(...fk.columns);
        existing.refCols.push(fk.ref.column);
      } else {
        fkByRef.set(key, { localCols: [...fk.columns], refCols: [fk.ref.column], onDelete: fk.ref.onDelete });
      }
    }

    // Columns
    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      const needsMap = naming === "camelcase" && field !== col.name;

      // Enum handling
      if (col.type === "enum" && col.enumValues && col.enumValues.length > 0) {
        const enumName = enumNameFor(table.name, col.name);
        if (!enumSeen.has(enumName)) {
          enumSeen.add(enumName);
          enumBlocks.push(`enum ${enumName} {`);
          for (const v of col.enumValues) enumBlocks.push(`  ${v.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1")}`);
          enumBlocks.push(`}`);
        }
        lines.push(`  ${field} ${enumName}`);
      } else {
        const type = resolveType(col, "prisma");
        if (!type) {
          lines.push(`  ${field} String`);
          notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to String.` });
        } else {
          lines.push(`  ${field} ${type}`);
        }
      }

      // Attributes
      const attrs: string[] = [];
      if (col.primaryKey) {
        attrs.push("@id");
        if (col.autoIncrement || col.type === "int" || col.type === "bigint") attrs.push("@default(autoincrement())");
      }
      if (!col.nullable) attrs.push("@db"); // not nullable is the default in Prisma; only annotate when relevant
      if (col.unique && !col.primaryKey) attrs.push("@unique");
      if (needsMap) attrs.push(`@map("${col.name}")`);
      if (col.default !== undefined) {
        const d = mapDefault(col.default, "prisma");
        if (d) attrs.push(`@default(${d.value})`);
      }
      // Remove the redundant @db annotation for not-null (Prisma defaults to required).
      const filtered = attrs.filter((a) => a !== "@db");
      if (filtered.length > 0) lines[lines.length - 1] += ` ${filtered.join(" ")}`;

      // Inline REFERENCES → relation field
      if (col.references) {
        const refClass = classNameFor(col.references.table);
        relFields.push({
          name: fieldNameFor(col.references.table, naming) + "Rel",
          type: refClass,
          refTable: col.references.table,
          refClass,
          fields: [field],
          references: [fieldNameFor(col.references.column, naming)],
          onDelete: col.references.onDelete,
          selfRef: col.references.table === table.name,
        });
      }
    }

    // Foreign-key relation fields (aggregated)
    for (const [refTable, info] of fkByRef.entries()) {
      const refClass = classNameFor(refTable);
      relFields.push({
        name: fieldNameFor(refTable, naming) + "Rel",
        type: refClass,
        refTable,
        refClass,
        fields: info.localCols.map((c) => fieldNameFor(c, naming)),
        references: info.refCols.map((c) => fieldNameFor(c, naming)),
        onDelete: info.onDelete,
        selfRef: refTable === table.name,
      });
    }

    for (const rel of relFields) {
      const relAttr = `@relation(fields: [${rel.fields.join(", ")}], references: [${rel.references.join(", ")}]${rel.selfRef ? `, name: "self"` : ""}${rel.onDelete ? `, onDelete: ${rel.onDelete.replace(/\s+/g, "_").toLowerCase()}` : ""})`;
      lines.push(`  ${rel.name} ${rel.type}? ${relAttr}`);
    }

    // Back-references — for each FK pointing INTO this table from another table.
    for (const other of schema.tables) {
      if (other.name === table.name) continue;
      for (const fk of other.foreignKeys) {
        if (fk.ref.table === table.name) {
          const backName = fieldNameFor(other.name, naming) + "Rels";
          const backType = classNameFor(other.name) + "[]";
          lines.push(`  ${backName} ${backType}`);
        }
      }
    }

    // Indexes / uniques
    for (const idx of table.indexes) {
      if (idx.primary) continue; // PK already annotated on columns
      const cols = idx.columns.map((c) => fieldNameFor(c, naming)).join(", ");
      if (idx.unique) lines.push(`  @@unique([${cols}])`);
      else lines.push(`  @@index([${cols}])`);
    }

    lines.push(`  @@map("${table.name}")`);

    // Check constraints flagged.
    for (const chk of table.checks) {
      notes.push({ severity: "manual", table: table.name, message: `CHECK constraint not portable to Prisma — keep it in a migration: ${chk.expression.slice(0, 80)}` });
    }

    lines.push(`}`);
    if (schema.tables.indexOf(table) < schema.tables.length - 1) lines.push("");
  }

  // Emit enum blocks at the top.
  const enumHeader = enumBlocks.length > 0 ? enumBlocks.join("\n") + "\n\n" : "";
  const code = enumHeader + lines.join("\n") + "\n";

  return {
    target: "prisma",
    code,
    notes,
    modelCount: schema.tables.length,
  };
}

// ---------------------------------------------------------------------------
// Sequelize
// ---------------------------------------------------------------------------

export function generateSequelize(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  lines.push("// Sequelize models — generated from CREATE TABLE DDL.");
  lines.push("// Run `npm i sequelize` and provide a sequelize instance to Model.init().");
  lines.push('const { DataTypes, Model } = require("sequelize");');
  lines.push("");

  for (const table of schema.tables) {
    const className = classNameFor(table.name);
    lines.push(`class ${className} extends Model {}`);
    lines.push(`${className}.init({`);
    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      const needsMap = naming === "camelcase" && field !== col.name;
      let type = resolveType(col, "sequelize");
      if (!type) {
        type = "DataTypes.STRING";
        notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to DataTypes.STRING.` });
      } else if (col.type === "enum" && col.enumValues) {
        type = `DataTypes.ENUM(${col.enumValues.map((v) => `'${v}'`).join(", ")})`;
      } else {
        type = fillTemplate(type, col, enumNameFor(table.name, col.name));
      }
      lines.push(`  ${field}: {`);
      lines.push(`    type: ${type},`);
      lines.push(`    allowNull: ${col.nullable},`);
      if (col.primaryKey) lines.push(`    primaryKey: true,`);
      if (col.autoIncrement) lines.push(`    autoIncrement: true,`);
      if (col.unique && !col.primaryKey) lines.push(`    unique: true,`);
      if (col.default !== undefined) {
        const d = mapDefault(col.default, "sequelize");
        if (d) lines.push(`    defaultValue: ${d.value},`);
      }
      if (needsMap) lines.push(`    field: "${col.name}",`);
      lines.push(`  },`);
    }
    lines.push(`}, {`);
    lines.push(`  sequelize,`);
    lines.push(`  tableName: "${table.name}",`);
    lines.push(`  modelName: "${className}",`);
    if (table.indexes.some((i) => !i.primary)) {
      const idxLines: string[] = [];
      for (const idx of table.indexes) {
        if (idx.primary) continue;
        idxLines.push(`    { fields: [${idx.columns.map((c) => `"${c}"`).join(", ")}], unique: ${idx.unique} }`);
      }
      if (idxLines.length > 0) {
        lines.push(`  indexes: [`);
        lines.push(idxLines.join(",\n"));
        lines.push(`  ],`);
      }
    }
    lines.push(`  timestamps: false,`);
    lines.push(`});`);
    lines.push(`module.exports.${className} = ${className};`);
    lines.push("");
  }

  for (const t of schema.tables) {
    for (const chk of t.checks) {
      notes.push({ severity: "manual", table: t.name, message: `CHECK constraint not enforced by Sequelize — add a model-level validator: ${chk.expression.slice(0, 80)}` });
    }
  }

  return { target: "sequelize", code: lines.join("\n"), notes, modelCount: schema.tables.length };
}

// ---------------------------------------------------------------------------
// TypeORM
// ---------------------------------------------------------------------------

export function generateTypeOrm(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  lines.push("// TypeORM entities — generated from CREATE TABLE DDL.");
  lines.push('import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, Index, Unique, CreateDateColumn, UpdateDateColumn } from "typeorm";');
  lines.push("");

  for (const table of schema.tables) {
    const className = classNameFor(table.name);
    lines.push(`@Entity("${table.name}")`);
    lines.push(`export class ${className} {`);

    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      const needsMap = naming === "camelcase" && field !== col.name;
      let type = resolveType(col, "typeorm");
      if (!type) {
        type = "varchar";
        notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to varchar.` });
      }
      if (col.primaryKey) {
        if (col.autoIncrement || col.type === "int" || col.type === "bigint") {
          lines.push(`  @PrimaryGeneratedColumn()`);
        } else {
          lines.push(`  @PrimaryColumn({ type: "${type}"${col.length ? `, length: ${col.length}` : ""} })`);
        }
      } else {
        lines.push(`  @Column({ type: "${type}", nullable: ${col.nullable}${col.length ? `, length: ${col.length}` : ""}${col.default !== undefined ? `, default: ${mapDefault(col.default, "typeorm")?.value ?? "undefined"}` : ""} })`);
      }
      if (col.unique && !col.primaryKey) lines.push(`  @Index({ unique: true })`);
      lines.push(`  ${field}: ${tsTypeFor(col)};`);
      void needsMap;
    }

    // Relations: ManyToOne for each FK.
    for (const fk of table.foreignKeys) {
      const refClass = classNameFor(fk.ref.table);
      const relName = fieldNameFor(fk.ref.table, naming) + "Rel";
      lines.push(`  @ManyToOne(() => ${refClass})`);
      lines.push(`  ${relName}?: ${refClass};`);
    }

    // Back-references
    for (const other of schema.tables) {
      if (other.name === table.name) continue;
      const hasRef = other.foreignKeys.some((fk) => fk.ref.table === table.name);
      if (hasRef) {
        const backName = fieldNameFor(other.name, naming) + "Rels";
        const backType = classNameFor(other.name) + "[]";
        lines.push(`  @OneToMany(() => ${classNameFor(other.name)}, (o) => o.${fieldNameFor(table.name, naming)}Rel)`);
        lines.push(`  ${backName}?: ${backType};`);
      }
    }

    // Indexes
    for (const idx of table.indexes) {
      if (idx.primary) continue;
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      if (idx.unique) lines.push(`  @Unique([${cols}])`);
      else lines.push(`  @Index([${cols}])`);
    }

    lines.push(`}`);
    lines.push("");
  }

  for (const t of schema.tables) {
    for (const chk of t.checks) {
      notes.push({ severity: "manual", table: t.name, message: `CHECK constraint not portable to TypeORM entities — keep in a migration: ${chk.expression.slice(0, 80)}` });
    }
  }

  return { target: "typeorm", code: lines.join("\n"), notes, modelCount: schema.tables.length };
}

/** Pick a TypeScript type for a column. */
export function tsTypeFor(col: ColumnDef): string {
  if (col.type === "enum") return "string";
  switch (col.type) {
    case "tinyint":
    case "smallint":
    case "mediumint":
    case "int":
    case "integer":
      return "number";
    case "bigint":
      return "BigInt | number";
    case "bool":
    case "boolean":
      return "boolean";
    case "decimal":
    case "numeric":
    case "float":
    case "double":
    case "real":
      return "number";
    case "date":
    case "time":
    case "datetime":
    case "timestamp":
      return "Date";
    case "json":
    case "jsonb":
      return "Record<string, unknown>";
    case "blob":
    case "binary":
    case "varbinary":
      return "Buffer";
    case "uuid":
      return "string";
    default:
      return "string";
  }
}

// ---------------------------------------------------------------------------
// Drizzle
// ---------------------------------------------------------------------------

export function generateDrizzle(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  lines.push("// Drizzle schema — generated from CREATE TABLE DDL.");
  lines.push('import { pgTable, varchar, integer, bigint, boolean, decimal, float, text, timestamp, date, time, json, blob, uuid, serial, primaryKey, uniqueIndex, index, foreignKey, pgEnum } from "drizzle-orm/pg-core";');
  lines.push('import { sql } from "drizzle-orm";');
  lines.push("");

  // Collect enum definitions
  const enumBlocks: string[] = [];
  const enumSeen = new Set<string>();
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (col.type === "enum" && col.enumValues) {
        const enumName = enumNameFor(table.name, col.name).toLowerCase();
        if (!enumSeen.has(enumName)) {
          enumSeen.add(enumName);
          enumBlocks.push(`export const ${enumName} = pgEnum("${enumName}", [${col.enumValues.map((v) => `"${v}"`).join(", ")}]);`);
        }
      }
    }
  }
  if (enumBlocks.length > 0) {
    lines.push(...enumBlocks);
    lines.push("");
  }

  for (const table of schema.tables) {
    const varName = snakeToCamel(table.name);
    lines.push(`export const ${varName} = pgTable("${table.name}", {`);
    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      let type = resolveType(col, "drizzle");
      if (!type) {
        type = "varchar(255)";
        notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to varchar(255).` });
      } else {
        type = fillTemplate(type, col, enumNameFor(table.name, col.name).toLowerCase());
      }
      const builder = `${type}${col.primaryKey && (col.autoIncrement || col.type === "int" || col.type === "bigint") ? ".primaryKey()" : col.primaryKey ? ".primaryKey()" : ""}${!col.nullable ? ".notNull()" : ""}${col.unique && !col.primaryKey ? ".unique()" : ""}${col.default !== undefined ? `.default(${mapDefault(col.default, "drizzle")?.value ?? "undefined"})` : ""}`;
      lines.push(`  ${field}: ${builder},`);
    }
    // Composite primary keys
    const pkIdx = table.indexes.find((i) => i.primary);
    if (pkIdx && pkIdx.columns.length > 1) {
      lines.push(`}, (t) => ({`);
      lines.push(`  pk: primaryKey({ columns: [${pkIdx.columns.map((c) => `t.${fieldNameFor(c, naming)}`).join(", ")}] }),`);
      for (const idx of table.indexes) {
        if (idx.primary) continue;
        const cols = idx.columns.map((c) => `t.${fieldNameFor(c, naming)}`).join(", ");
        lines.push(`  ${idx.name ? idx.name : `idx_${idx.columns.join("_")}`}: ${idx.unique ? "uniqueIndex" : "index"}().on(${cols}),`);
      }
      for (const fk of table.foreignKeys) {
        const cols = fk.columns.map((c) => `t.${fieldNameFor(c, naming)}`).join(", ");
        lines.push(`  fk_${fk.ref.table}: foreignKey({ columns: [${cols}], foreignColumns: [${snakeToCamel(fk.ref.table)}.${fieldNameFor(fk.ref.column, naming)}] }),`);
      }
      lines.push(`}));`);
    } else {
      // Single PK already annotated on column. Still emit indexes/FKs.
      const extras: string[] = [];
      for (const idx of table.indexes) {
        if (idx.primary) continue;
        const cols = idx.columns.map((c) => `t.${fieldNameFor(c, naming)}`).join(", ");
        extras.push(`  ${idx.name ? idx.name : `idx_${idx.columns.join("_")}`}: ${idx.unique ? "uniqueIndex" : "index"}().on(${cols}),`);
      }
      for (const fk of table.foreignKeys) {
        const cols = fk.columns.map((c) => `t.${fieldNameFor(c, naming)}`).join(", ");
        extras.push(`  fk_${fk.ref.table}: foreignKey({ columns: [${cols}], foreignColumns: [${snakeToCamel(fk.ref.table)}.${fieldNameFor(fk.ref.column, naming)}] }),`);
      }
      if (extras.length > 0) {
        lines.push(`}, (t) => ({`);
        lines.push(...extras);
        lines.push(`}));`);
      } else {
        lines.push(`});`);
      }
    }
    lines.push("");
  }

  for (const t of schema.tables) {
    for (const chk of t.checks) {
      notes.push({ severity: "manual", table: t.name, message: `CHECK constraint not portable to Drizzle table builder — keep in a migration: ${chk.expression.slice(0, 80)}` });
    }
  }

  return { target: "drizzle", code: lines.join("\n"), notes, modelCount: schema.tables.length };
}

// ---------------------------------------------------------------------------
// SQLAlchemy
// ---------------------------------------------------------------------------

export function generateSqlAlchemy(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  lines.push("# SQLAlchemy models — generated from CREATE TABLE DDL.");
  lines.push("from sqlalchemy import Column, Integer, BigInteger, SmallInteger, Boolean, Float, Numeric, String, Text, Date, Time, DateTime, JSON, LargeBinary, Enum, ForeignKey, UniqueConstraint, Index, CheckConstraint");
  lines.push("from sqlalchemy.orm import relationship, declarative_base");
  lines.push("");
  lines.push("Base = declarative_base()");
  lines.push("");

  for (const table of schema.tables) {
    const className = classNameFor(table.name);
    lines.push(`class ${className}(Base):`);
    lines.push(`    __tablename__ = "${table.name}"`);

    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      let type = resolveType(col, "sqlalchemy");
      if (!type) {
        type = "String(255)";
        notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to String(255).` });
      } else {
        type = fillTemplate(type, col, enumNameFor(table.name, col.name));
      }
      if (col.type === "enum" && col.enumValues) {
        type = `Enum(${col.enumValues.map((v) => `"${v}"`).join(", ")}, name="${enumNameFor(table.name, col.name).toLowerCase()}")`;
      }
      const opts: string[] = [];
      if (col.primaryKey) opts.push("primary_key=True");
      if (col.autoIncrement) opts.push("autoincrement=True");
      if (!col.nullable) opts.push("nullable=False");
      if (col.unique && !col.primaryKey) opts.push("unique=True");
      if (col.default !== undefined) {
        const d = mapDefault(col.default, "sqlalchemy");
        if (d) opts.push(`default=${d.value}`);
      }
      // Inline references on the column itself.
      if (col.references) {
        opts.push(`ForeignKey("${col.references.table}.${col.references.column}")`);
      }
      lines.push(`    ${field} = Column(${type}${opts.length > 0 ? `, ${opts.join(", ")}` : ""})`);
    }

    // Apply table-level FOREIGN KEY constraints to the matching local column(s).
    for (const fk of table.foreignKeys) {
      if (fk.columns.length !== 1) continue;
      const localCol = fk.columns[0];
      // Find the line we just emitted for this column and inject ForeignKey.
      const fkIdx = lines.findIndex((l) => l.startsWith(`    ${fieldNameFor(localCol, naming)} = Column(`));
      if (fkIdx >= 0 && !lines[fkIdx].includes("ForeignKey")) {
        const line = lines[fkIdx];
        const lastClose = line.lastIndexOf(")");
        if (lastClose >= 0) {
          lines[fkIdx] = `${line.slice(0, lastClose)}, ForeignKey("${fk.ref.table}.${fk.ref.column}"))`;
        }
      }
    }

    // Composite PK columns (those that aren't already declared PK on the column)
    for (const idx of table.indexes) {
      if (idx.primary && idx.columns.length > 1) {
        // SQLAlchemy needs primary_key=True on each column — add a note.
        notes.push({ severity: "warning", table: table.name, message: `Composite primary key (${idx.columns.join(", ")}) — ensure primary_key=True is set on each column.` });
      }
    }

    // FK relationships
    for (const fk of table.foreignKeys) {
      const refClass = classNameFor(fk.ref.table);
      const relName = fieldNameFor(fk.ref.table, naming) + "_rel";
      lines.push(`    ${relName} = relationship("${refClass}")`);
    }

    // Back-references
    for (const other of schema.tables) {
      if (other.name === table.name) continue;
      const hasRef = other.foreignKeys.some((fk) => fk.ref.table === table.name);
      if (hasRef) {
        const backName = fieldNameFor(other.name, naming) + "_rels";
        const backType = classNameFor(other.name);
        lines.push(`    ${backName} = relationship("${backType}", back_populates="${fieldNameFor(table.name, naming)}_rel")`);
      }
    }

    // Uniques & indexes (composite)
    for (const idx of table.indexes) {
      if (idx.primary) continue;
      const name = idx.name ? `"${idx.name}"` : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      if (idx.unique) lines.push(`    __table_args__ = (__table_args__ if "__table_args__" in dir() else ()) + (UniqueConstraint(${cols}${name ? `, name=${name}` : ""}),)`);
      else lines.push(`    __table_args__ = (__table_args__ if "__table_args__" in dir() else ()) + (Index(${name ? name + ", " : ""}${cols}),)`);
    }

    for (const chk of table.checks) {
      lines.push(`    # CHECK constraint: ${chk.expression.slice(0, 80)}`);
      notes.push({ severity: "manual", table: table.name, message: `CHECK constraint kept as a comment — add CheckConstraint("${chk.expression.slice(0, 80)}") in __table_args__ if needed.` });
    }

    lines.push("");
  }

  return { target: "sqlalchemy", code: lines.join("\n"), notes, modelCount: schema.tables.length };
}

// ---------------------------------------------------------------------------
// Django
// ---------------------------------------------------------------------------

export function generateDjango(schema: ParsedSchema, naming: NamingStrategy): OrmResult {
  const lines: string[] = [];
  const notes: OrmNote[] = [];
  lines.push("# Django models — generated from CREATE TABLE DDL.");
  lines.push("from django.db import models");
  lines.push("");

  for (const table of schema.tables) {
    const className = classNameFor(table.name);
    lines.push(`class ${className}(models.Model):`);

    if (table.columns.length === 0) {
      lines.push("    pass");
      lines.push("");
      continue;
    }

    for (const col of table.columns) {
      const field = fieldNameFor(col.name, naming);
      let type = resolveType(col, "django");
      if (!type) {
        type = "CharField(max_length=255)";
        notes.push({ severity: "warning", table: table.name, message: `Column "${col.name}" has unmappable type "${col.type}" — fell back to CharField(max_length=255).` });
      } else {
        type = fillTemplate(type, col, enumNameFor(table.name, col.name));
      }
      if (col.type === "enum" && col.enumValues) {
        type = `CharField(max_length=${Math.max(...col.enumValues.map((v) => v.length), 32)}, choices=[${col.enumValues.map((v) => `("${v}", "${v}")`).join(", ")}])`;
      }
      const opts: string[] = [];
      if (col.primaryKey) {
        if (col.autoIncrement || col.type === "int" || col.type === "bigint") {
          type = "AutoField(primary_key=True)";
        } else {
          opts.push("primary_key=True");
        }
      }
      if (!col.nullable) opts.push("null=False");
      else opts.push("null=True");
      if (col.default !== undefined) {
        const d = mapDefault(col.default, "django");
        if (d) {
          // For auto-generated defaults like auto_now_add=True, replace type entirely.
          if (d.value.includes("=")) {
            type = `DateTimeField(${d.value})`;
            opts.length = 0;
          } else {
            opts.push(`default=${d.value}`);
          }
        }
      }
      if (col.unique && !col.primaryKey) opts.push("unique=True");
      // Inline references
      if (col.references) {
        const refClass = classNameFor(col.references.table);
        type = `ForeignKey("${refClass}", on_delete=models.CASCADE)`;
        opts.push(`db_column="${col.name}"`);
      }
      const needsDbColumn = naming === "camelcase" && field !== col.name && !col.references;
      if (needsDbColumn) opts.push(`db_column="${col.name}"`);
      lines.push(`    ${field} = models.${type}${opts.length > 0 ? `(${opts.join(", ")})` : ""}`);
    }

    // Composite FKs
    for (const fk of table.foreignKeys) {
      const refClass = classNameFor(fk.ref.table);
      const relName = fieldNameFor(fk.ref.table, naming) + "_set";
      lines.push(`    ${relName} = models.ForeignKey("${refClass}", on_delete=models.CASCADE, db_column="${fk.columns.join("_")}", related_name="+")`);
    }

    // Meta
    const metaLines: string[] = [];
    metaLines.push(`    class Meta:`);
    metaLines.push(`        db_table = "${table.name}"`);
    // Unique-together / indexes
    for (const idx of table.indexes) {
      if (idx.primary) continue;
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      if (idx.unique) metaLines.push(`        unique_together = ((${cols}),)`);
      else metaLines.push(`        indexes = [models.Index(fields=[${cols}])]`);
    }
    for (const chk of table.checks) {
      metaLines.push(`        # CHECK constraint: ${chk.expression.slice(0, 80)}`);
      notes.push({ severity: "manual", table: table.name, message: `Django has no native CHECK constraint support — keep in a migration: ${chk.expression.slice(0, 80)}` });
    }
    lines.push(...metaLines);

    lines.push("");
  }

  return { target: "django", code: lines.join("\n"), notes, modelCount: schema.tables.length };
}

// ---------------------------------------------------------------------------
// Top-level convert entry point
// ---------------------------------------------------------------------------

export function convertDdlToOrm(
  ddl: string,
  options: ConvertOptions,
): ConvertOutcome {
  if (!ddl || !ddl.trim()) {
    return { ok: false, error: "No DDL provided." };
  }
  const schema = parseDdl(ddl);
  if (schema.tables.length === 0) {
    return { ok: false, error: "No CREATE TABLE statements found." };
  }
  const allNotes: OrmNote[] = [];
  // Generate the requested target plus gather notes.
  const result = generateOrm(schema, options);
  allNotes.push(...result.notes);
  // Also surface schema-level notes (skipped statements).
  if (schema.skipped.length > 0) {
    allNotes.push({
      severity: "info",
      table: "(schema)",
      message: `${schema.skipped.length} non-CREATE statement(s) skipped (e.g. ALTER, CREATE INDEX, DROP).`,
    });
  }
  return {
    ok: true,
    results: [result],
    schema,
    notes: allNotes,
  };
}

/** Generate code for all 6 targets from the same DDL. */
export function convertDdlToAll(ddl: string, naming: NamingStrategy): ConvertOutcome {
  if (!ddl || !ddl.trim()) {
    return { ok: false, error: "No DDL provided." };
  }
  const schema = parseDdl(ddl);
  if (schema.tables.length === 0) {
    return { ok: false, error: "No CREATE TABLE statements found." };
  }
  const results: OrmResult[] = ORM_TARGETS.map((t) =>
    generateOrm(schema, { target: t.value, naming }),
  );
  const notes: OrmNote[] = [];
  for (const r of results) notes.push(...r.notes);
  if (schema.skipped.length > 0) {
    notes.push({
      severity: "info",
      table: "(schema)",
      message: `${schema.skipped.length} non-CREATE statement(s) skipped.`,
    });
  }
  return { ok: true, results, schema, notes };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const DDL_PRESETS: ReadonlyArray<{ id: string; label: string; ddl: string }> = [
  {
    id: "users-posts",
    label: "Users + Posts (with FK + enum)",
    ddl: `CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);`,
  },
  {
    id: "tags-m2m",
    label: "Posts + Tags (many-to-many join table)",
    ddl: `CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);`,
  },
  {
    id: "self-ref",
    label: "Categories (self-referential FK + composite unique)",
    ddl: `CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL,
  UNIQUE (parent_id, slug),
  CHECK (display_order >= 0)
);`,
  },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-to-orm-code-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  target: OrmTarget;
  naming: NamingStrategy;
  tableCount: number;
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
// Shareable URL (URL fragment)
// ---------------------------------------------------------------------------

/** Encode state {ddl, target, naming} as base64 for URL fragment. */
export function encodeState(ddl: string, target: OrmTarget, naming: NamingStrategy): string {
  const json = JSON.stringify({ ddl, target, naming });
  // Use URL-safe base64.
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode URL-fragment state. */
export function decodeState(encoded: string): { ddl: string; target: OrmTarget; naming: NamingStrategy } | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json) as { ddl: string; target: OrmTarget; naming: NamingStrategy };
    if (typeof obj.ddl !== "string" || typeof obj.target !== "string" || typeof obj.naming !== "string") return null;
    const validTargets = ORM_TARGETS.map((t) => t.value);
    if (!validTargets.includes(obj.target)) return null;
    if (obj.naming !== "camelcase" && obj.naming !== "preserve") return null;
    return { ddl: obj.ddl, target: obj.target, naming: obj.naming };
  } catch {
    return null;
  }
}

export function buildShareUrl(ddl: string, target: OrmTarget, naming: NamingStrategy): string {
  const encoded = encodeState(ddl, target, naming);
  if (typeof window === "undefined") return `?s=${encoded}`;
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

export function parseShareUrl(hash: string): { ddl: string; target: OrmTarget; naming: NamingStrategy } | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const s = params.get("s");
  if (!s) return null;
  return decodeState(s);
}
