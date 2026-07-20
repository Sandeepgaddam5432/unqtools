/**
 * CREATE TABLE Generator — pure logic.
 *
 * A constraint-aware, multi-dialect DDL generator. Given a TableModel
 * (columns + PK + unique + FK + CHECK + indexes + comments + options),
 * emit a correct CREATE TABLE statement for MySQL, PostgreSQL, SQLite,
 * or SQL Server, plus optional matching DROP TABLE and seed INSERTs.
 *
 * Pure functions only — no DOM, no network.
 *
 * Design principles:
 *  - Same model + dialect → same DDL, every time.
 *  - Reserved words and identifiers with special characters are
 *    auto-quoted per dialect convention.
 *  - Default literals vs expressions are distinguished (string vs NOW()).
 *  - Dialect-specific auto-increment syntax (AUTO_INCREMENT, GENERATED AS
 *    IDENTITY, AUTOINCREMENT, IDENTITY(seed,step)).
 *  - Unsupported constructs are downgraded safely (ENUM → CHECK on
 *    dialects that lack ENUM; comments → inline SQL comments on SQLite).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Dialect = "mysql" | "postgresql" | "sqlite" | "sqlserver";

export interface DialectInfo {
  value: Dialect;
  label: string;
  /** Identifier quote characters. */
  quoteOpen: string;
  quoteClose: string;
  /** Max identifier length (bytes). */
  maxIdentifierLength: number;
  /** Supports inline ENUM type. */
  supportsEnum: boolean;
  /** Supports column COMMENT clause inline. */
  supportsInlineComment: boolean;
  /** Supports table-level COMMENT clause. */
  supportsTableComment: boolean;
  /** Supports ENGINE/CHARSET table options. */
  supportsEngineCharset: boolean;
  /** Supports WITHOUT ROWID (SQLite only). */
  supportsWithoutRowid: boolean;
}

export type ColumnType =
  | "tinyint" | "smallint" | "mediumint" | "int" | "integer" | "bigint"
  | "decimal" | "numeric" | "float" | "double" | "real"
  | "char" | "varchar" | "text" | "mediumtext" | "longtext"
  | "date" | "time" | "datetime" | "timestamp"
  | "boolean" | "bool" | "bit"
  | "blob" | "binary" | "varbinary" | "bytea"
  | "json" | "jsonb" | "uuid" | "enum";

/** Per-dialect curated type list (used to populate the dropdown). */
export const TYPE_LIST: Record<Dialect, ColumnType[]> = {
  mysql: [
    "tinyint", "smallint", "mediumint", "int", "bigint",
    "decimal", "float", "double",
    "char", "varchar", "text", "mediumtext", "longtext",
    "date", "time", "datetime", "timestamp",
    "boolean", "bit",
    "blob", "binary", "varbinary",
    "json", "enum",
  ],
  postgresql: [
    "smallint", "integer", "bigint",
    "decimal", "numeric", "real", "double",
    "char", "varchar", "text",
    "date", "time", "timestamp",
    "boolean", "bit",
    "bytea",
    "json", "jsonb", "uuid",
  ],
  sqlite: [
    "integer", "real", "text", "blob", "numeric",
    "boolean", "varchar", "char", "date", "time", "datetime",
  ],
  sqlserver: [
    "tinyint", "smallint", "int", "bigint",
    "decimal", "numeric", "float", "real",
    "char", "varchar", "text",
    "date", "time", "datetime",
    "bit",
    "binary", "varbinary",
    "json",
  ],
};

/** Reserved words across dialects (union, conservative). */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  // SQL-92 / common
  "select", "from", "where", "insert", "update", "delete", "create", "table",
  "drop", "alter", "index", "view", "into", "values", "set", "and", "or",
  "not", "null", "is", "in", "like", "between", "join", "on", "inner", "outer",
  "left", "right", "full", "cross", "group", "order", "by", "having", "as",
  "distinct", "all", "any", "case", "when", "then", "else", "end", "exists",
  "union", "except", "intersect", "with", "primary", "foreign", "key", "unique",
  "default", "check", "constraint", "references", "cascade", "restrict",
  "trigger", "procedure", "function", "schema", "database", "user", "grant",
  "revoke", "commit", "rollback", "transaction", "begin", "start", "if",
  "exists", "true", "false", "current_timestamp", "current_date",
  // MySQL-specific
  "auto_increment", "engine", "charset", "unsigned", "zerofill",
  // PostgreSQL-specific
  "serial", "bigserial", "returning", "ilike", "sequence", "returning",
  // SQL Server-specific
  "identity", "rowguidcol", "nchar", "nvarchar", "ntext",
  // SQLite-specific
  "rowid", "autoincrement", "conflict",
]);

export interface ColumnDef {
  /** Stable id (used for keying in the UI). */
  id: string;
  name: string;
  type: ColumnType;
  /** Length for char/varchar, precision for decimal/numeric, optional scale. */
  length?: number;
  scale?: number;
  nullable: boolean;
  /** Default value (literal or expression). */
  defaultValue?: string;
  /** Treat default as expression (no quoting) — true for NOW(), CURRENT_TIMESTAMP. */
  defaultIsExpression?: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  /** ENUM values (only when type === "enum"). */
  enumValues?: string[];
  /** Column comment. */
  comment?: string;
}

export type OnAction =
  | "cascade" | "set null" | "set default" | "restrict" | "no action";

export interface ForeignKeyDef {
  id: string;
  /** Local column ids (single or composite). */
  columns: string[];
  /** Referenced table name. */
  refTable: string;
  /** Referenced column names (parallel to columns). */
  refColumns: string[];
  onDelete?: OnAction;
  onUpdate?: OnAction;
}

export interface UniqueDef {
  id: string;
  /** Column ids (single or composite). */
  columns: string[];
  /** Optional constraint name. */
  name?: string;
}

export interface CheckDef {
  id: string;
  /** Raw CHECK expression, e.g. "age >= 0". */
  expression: string;
  name?: string;
}

export type IndexMethod = "btree" | "hash" | "gin" | "gist";

export interface IndexDef {
  id: string;
  name?: string;
  /** Column ids. */
  columns: string[];
  unique?: boolean;
  method?: IndexMethod;
}

export interface TableOptions {
  ifNotExists: boolean;
  /** MySQL: ENGINE = InnoDB / MyISAM. */
  engine?: string;
  /** MySQL: DEFAULT CHARSET = utf8mb4. */
  charset?: string;
  /** MySQL: COLLATE. */
  collate?: string;
  /** SQLite: WITHOUT ROWID. */
  withoutRowid?: boolean;
  /** Optional table comment (rendered per dialect). */
  comment?: string;
}

export interface TableModel {
  name: string;
  dialect: Dialect;
  columns: ColumnDef[];
  /** Primary key column ids (single or composite). */
  primaryKey: string[];
  foreignKeys: ForeignKeyDef[];
  uniques: UniqueDef[];
  checks: CheckDef[];
  indexes: IndexDef[];
  options: TableOptions;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const DIALECTS: ReadonlyArray<DialectInfo> = [
  {
    value: "mysql",
    label: "MySQL / MariaDB",
    quoteOpen: "`",
    quoteClose: "`",
    maxIdentifierLength: 64,
    supportsEnum: true,
    supportsInlineComment: true,
    supportsTableComment: true,
    supportsEngineCharset: true,
    supportsWithoutRowid: false,
  },
  {
    value: "postgresql",
    label: "PostgreSQL",
    quoteOpen: '"',
    quoteClose: '"',
    maxIdentifierLength: 63,
    supportsEnum: false,
    supportsInlineComment: false,
    supportsTableComment: true,
    supportsEngineCharset: false,
    supportsWithoutRowid: false,
  },
  {
    value: "sqlite",
    label: "SQLite",
    quoteOpen: '"',
    quoteClose: '"',
    maxIdentifierLength: 1024,
    supportsEnum: false,
    supportsInlineComment: false,
    supportsTableComment: false,
    supportsEngineCharset: false,
    supportsWithoutRowid: true,
  },
  {
    value: "sqlserver",
    label: "SQL Server (T-SQL)",
    quoteOpen: "[",
    quoteClose: "]",
    maxIdentifierLength: 128,
    supportsEnum: false,
    supportsInlineComment: false,
    supportsTableComment: false,
    supportsEngineCharset: false,
    supportsWithoutRowid: false,
  },
];

export function dialectInfo(d: Dialect): DialectInfo {
  const info = DIALECTS.find((x) => x.value === d);
  if (!info) throw new Error(`Unknown dialect: ${d}`);
  return info;
}

export const ON_ACTION_LABELS: Record<OnAction, string> = {
  "cascade": "CASCADE",
  "set null": "SET NULL",
  "set default": "SET DEFAULT",
  "restrict": "RESTRICT",
  "no action": "NO ACTION",
};

// ---------------------------------------------------------------------------
// Identifier handling
// ---------------------------------------------------------------------------

/** Lowercase + trim an identifier (does not alter internal chars). */
export function normalizeIdentifier(s: string): string {
  return (s || "").trim();
}

/** True if the identifier needs quoting (reserved word, special chars, digit-leading). */
export function needsQuoting(name: string, dialect: Dialect): boolean {
  const n = normalizeIdentifier(name);
  if (!n) return false;
  if (RESERVED_WORDS.has(n.toLowerCase())) return true;
  if (/^[0-9]/.test(n)) return true;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return true;
  // SQLite/Postgres are case-sensitive when quoted; never quote plain ASCII.
  void dialect;
  return false;
}

/** Quote an identifier per the dialect convention. Inner quote chars are escaped.
 *  Identifiers are always quoted — this is the safe convention used by Beekeeper,
 *  Code Beautify and most production DDL generators. Use `needsQuoting` to test
 *  whether an identifier is a reserved word or contains special characters. */
export function quoteIdentifier(name: string, dialect: Dialect): string {
  const n = normalizeIdentifier(name);
  if (!n) return "";
  const info = dialectInfo(dialect);
  const esc = n.split(info.quoteOpen).join(info.quoteOpen + info.quoteOpen);
  return `${info.quoteOpen}${esc}${info.quoteClose}`;
}

// ---------------------------------------------------------------------------
// Type & default formatting
// ---------------------------------------------------------------------------

/** Format a column type with optional length/scale and ENUM values. */
export function formatType(col: ColumnDef, dialect: Dialect): string {
  const t = col.type.toLowerCase();
  // ENUM handling per dialect
  if (t === "enum") {
    const vals = col.enumValues ?? [];
    if (dialect === "mysql") {
      return `ENUM(${vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`;
    }
    // Postgres/SQLite/SQL Server: TEXT + CHECK constraint emulation
    const varCharLen = Math.max(1, ...vals.map((v) => v.length), 1);
    return dialect === "sqlserver" ? `NVARCHAR(${varCharLen})` : `VARCHAR(${varCharLen})`;
  }
  // Types with length/precision
  const hasLength = col.length !== undefined && col.length > 0;
  const hasScale = col.scale !== undefined && col.scale > 0;
  let base: string;
  if (t === "decimal" || t === "numeric") {
    if (hasLength && hasScale) base = `${t.toUpperCase()}(${col.length}, ${col.scale})`;
    else if (hasLength) base = `${t.toUpperCase()}(${col.length})`;
    else base = t.toUpperCase();
  } else if (t === "float" || t === "double" || t === "real") {
    base = hasLength ? `${t.toUpperCase()}(${col.length})` : t.toUpperCase();
  } else if (t === "char" || t === "varchar" || t === "varbinary" || t === "binary" || t === "nchar" || t === "nvarchar") {
    if (hasLength) base = `${t.toUpperCase()}(${col.length})`;
    else if (t === "char" || t === "varchar") base = `${t.toUpperCase()}(255)`;
    else base = t.toUpperCase();
  } else if (t === "bit") {
    base = hasLength ? `BIT(${col.length})` : "BIT";
  } else if (t === "time" || t === "timestamp" || t === "datetime") {
    base = hasLength ? `${t.toUpperCase()}(${col.length})` : t.toUpperCase();
  } else if (dialect === "postgresql" && (t === "jsonb" || t === "uuid" || t === "bytea")) {
    base = t.toUpperCase();
  } else {
    base = t.toUpperCase();
  }
  // MySQL UNSIGNED modifier
  if (col.unsigned && dialect === "mysql" && (t === "tinyint" || t === "smallint" || t === "mediumint" || t === "int" || t === "integer" || t === "bigint" || t === "float" || t === "double" || t === "decimal")) {
    base += " UNSIGNED";
  }
  return base;
}

/** Format a default value: literals are quoted (numbers/bools are not). */
export function formatDefault(col: ColumnDef): string {
  if (col.defaultValue === undefined || col.defaultValue === "") return "";
  if (col.defaultIsExpression) return col.defaultValue;
  const t = col.type.toLowerCase();
  const v = col.defaultValue;
  // Numeric family — no quoting
  if (
    t === "tinyint" || t === "smallint" || t === "mediumint" || t === "int" ||
    t === "integer" || t === "bigint" || t === "decimal" || t === "numeric" ||
    t === "float" || t === "double" || t === "real"
  ) {
    // Allow numeric expressions like -1
    return /^[+-]?\d+(\.\d+)?$/.test(v) ? v : `'${v.replace(/'/g, "''")}'`;
  }
  // Boolean family
  if (t === "boolean" || t === "bool") {
    const lv = v.toLowerCase();
    if (lv === "true" || lv === "false" || lv === "1" || lv === "0") return lv === "true" || lv === "1" ? "TRUE" : "FALSE";
    return `'${v.replace(/'/g, "''")}'`;
  }
  // NULL literal
  if (v.toLowerCase() === "null") return "NULL";
  // String default
  return `'${v.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Column / constraint / index formatting
// ---------------------------------------------------------------------------

/**
 * Format a single column definition line (without leading indent or trailing comma).
 * Includes type, NULL/NOT NULL, DEFAULT, AUTO_INCREMENT/IDENTITY, UNSIGNED, COMMENT, inline CHECK for ENUM emulation.
 */
export function formatColumn(col: ColumnDef, dialect: Dialect, enumChecks: CheckDef[]): string {
  const parts: string[] = [];
  parts.push(quoteIdentifier(col.name, dialect));
  const typeStr = formatType(col, dialect);
  parts.push(typeStr);
  if (!col.nullable) parts.push("NOT NULL");
  // Auto-increment per dialect
  if (col.autoIncrement) {
    if (dialect === "mysql") parts.push("AUTO_INCREMENT");
    else if (dialect === "postgresql") parts.push("GENERATED BY DEFAULT AS IDENTITY");
    else if (dialect === "sqlite") {
      // SQLite: must be INTEGER PRIMARY KEY — AUTOINCREMENT appended after PK
      // (handled in PK formatting; here we skip to avoid duplicate)
    } else if (dialect === "sqlserver") parts.push("IDENTITY(1,1)");
  }
  const def = formatDefault(col);
  if (def) parts.push(`DEFAULT ${def}`);
  // ENUM emulation: add inline CHECK constraint
  if (col.type === "enum" && dialect !== "mysql" && (col.enumValues?.length ?? 0) > 0) {
    const colRef = quoteIdentifier(col.name, dialect);
    const list = col.enumValues!.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
    parts.push(`CHECK (${colRef} IN (${list}))`);
    // Also record a synthetic CheckDef so the constraints list includes it
    enumChecks.push({
      id: `enum-check-${col.id}`,
      expression: `${colRef} IN (${list})`,
      name: undefined,
    });
  }
  // Column comment (MySQL inline only; others handled via post-statements)
  if (col.comment && dialectInfo(dialect).supportsInlineComment) {
    parts.push(`COMMENT '${col.comment.replace(/'/g, "''")}'`);
  }
  return parts.join(" ");
}

/** Format the PRIMARY KEY clause. For SQLite AUTOINCREMENT, appends after column list. */
export function formatPrimaryKey(model: TableModel): string {
  const { dialect, primaryKey, columns } = model;
  if (primaryKey.length === 0) return "";
  const cols = primaryKey
    .map((id) => {
      const col = columns.find((c) => c.id === id);
      return col ? quoteIdentifier(col.name, dialect) : "";
    })
    .filter(Boolean);
  if (cols.length === 0) return "";
  let clause = `PRIMARY KEY (${cols.join(", ")})`;
  // SQLite AUTOINCREMENT: only when single INTEGER PK column has autoIncrement flag
  if (dialect === "sqlite" && primaryKey.length === 1) {
    const col = columns.find((c) => c.id === primaryKey[0]);
    if (col?.autoIncrement) clause += " AUTOINCREMENT";
  }
  return clause;
}

/** Format a foreign key constraint clause. */
export function formatForeignKey(fk: ForeignKeyDef, model: TableModel): string {
  const { dialect, columns } = model;
  const localCols = fk.columns
    .map((id) => {
      const col = columns.find((c) => c.id === id);
      return col ? quoteIdentifier(col.name, dialect) : "";
    })
    .filter(Boolean);
  const refCols = fk.refColumns
    .map((n) => quoteIdentifier(n, dialect))
    .filter(Boolean);
  if (localCols.length === 0 || refCols.length === 0) return "";
  const parts: string[] = [];
  parts.push("FOREIGN KEY");
  parts.push(`(${localCols.join(", ")})`);
  parts.push("REFERENCES");
  parts.push(`${quoteIdentifier(fk.refTable, dialect)} (${refCols.join(", ")})`);
  if (fk.onDelete) parts.push(`ON DELETE ${ON_ACTION_LABELS[fk.onDelete]}`);
  if (fk.onUpdate) parts.push(`ON UPDATE ${ON_ACTION_LABELS[fk.onUpdate]}`);
  return parts.join(" ");
}

/** Format a UNIQUE constraint clause. */
export function formatUnique(u: UniqueDef, model: TableModel): string {
  const { dialect, columns } = model;
  const cols = u.columns
    .map((id) => {
      const col = columns.find((c) => c.id === id);
      return col ? quoteIdentifier(col.name, dialect) : "";
    })
    .filter(Boolean);
  if (cols.length === 0) return "";
  const namePart = u.name ? `CONSTRAINT ${quoteIdentifier(u.name, model.dialect)} ` : "";
  return `${namePart}UNIQUE (${cols.join(", ")})`;
}

/** Format a CHECK constraint clause. */
export function formatCheck(c: CheckDef, model: TableModel): string {
  const namePart = c.name ? `CONSTRAINT ${quoteIdentifier(c.name, model.dialect)} ` : "";
  return `${namePart}CHECK (${c.expression})`;
}

/** Format an INDEX clause (MySQL/PostgreSQL/SQL Server inline; SQLite needs separate CREATE INDEX). */
export function formatIndex(idx: IndexDef, model: TableModel): string | null {
  const { dialect, columns } = model;
  const cols = idx.columns
    .map((id) => {
      const col = columns.find((c) => c.id === id);
      return col ? quoteIdentifier(col.name, dialect) : "";
    })
    .filter(Boolean);
  if (cols.length === 0) return null;
  // SQLite does not support inline INDEX in CREATE TABLE; emit null here
  // (the caller emits a separate CREATE INDEX statement).
  if (dialect === "sqlite") return null;
  const name = idx.name || `idx_${model.name}_${idx.columns.join("_")}`;
  const unique = idx.unique ? "UNIQUE " : "";
  const method =
    idx.method && (dialect === "postgresql")
      ? ` USING ${idx.method.toUpperCase()}`
      : "";
  if (dialect === "mysql") {
    // MySQL: INDEX name (cols) USING BTREE
    const m = idx.method === "hash" ? " USING HASH" : " USING BTREE";
    return `${unique}INDEX ${quoteIdentifier(name, dialect)} (${cols.join(", ")})${m}`;
  }
  if (dialect === "sqlserver") {
    return `${unique}INDEX ${quoteIdentifier(name, dialect)} ON ${quoteIdentifier(model.name, dialect)} (${cols.join(", ")})`;
  }
  // PostgreSQL: handled as separate CREATE INDEX (no inline INDEX in CREATE TABLE)
  return null;
}

/** Format MySQL/Postgres/SQL Server table options tail. */
export function formatTableOptions(opts: TableOptions, dialect: Dialect): string {
  const parts: string[] = [];
  if (dialect === "mysql") {
    if (opts.engine) parts.push(`ENGINE = ${opts.engine}`);
    if (opts.charset) parts.push(`DEFAULT CHARSET = ${opts.charset}`);
    if (opts.collate) parts.push(`COLLATE = ${opts.collate}`);
    if (opts.comment) parts.push(`COMMENT = '${opts.comment.replace(/'/g, "''")}'`);
  }
  if (dialect === "sqlite" && opts.withoutRowid) parts.push("WITHOUT ROWID");
  return parts.length > 0 ? parts.join(" ") : "";
}

// ---------------------------------------------------------------------------
// CREATE TABLE / DROP TABLE / seed INSERTs
// ---------------------------------------------------------------------------

export interface DdlOutput {
  createTable: string;
  dropTable: string;
  seedInserts: string;
  postStatements: string;
  /** Inline CHECK constraints generated by ENUM emulation (for diagnostics). */
  syntheticChecks: CheckDef[];
  full: string;
}

/** Build the CREATE TABLE statement (no DROP, no seeds). */
export function buildCreateTable(model: TableModel): string {
  const { dialect, name, columns, options } = model;
  const info = dialectInfo(dialect);
  const lines: string[] = [];
  const header = options.ifNotExists
    ? `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(name, dialect)} (`
    : `CREATE TABLE ${quoteIdentifier(name, dialect)} (`;
  lines.push(header);

  const bodyLines: string[] = [];
  const syntheticChecks: CheckDef[] = [];
  for (const col of columns) {
    bodyLines.push("  " + formatColumn(col, dialect, syntheticChecks));
  }
  const pk = formatPrimaryKey(model);
  if (pk) bodyLines.push("  " + pk);
  for (const fk of model.foreignKeys) {
    const s = formatForeignKey(fk, model);
    if (s) bodyLines.push("  " + s);
  }
  for (const u of model.uniques) {
    const s = formatUnique(u, model);
    if (s) bodyLines.push("  " + s);
  }
  for (const c of model.checks) {
    bodyLines.push("  " + formatCheck(c, model));
  }
  if (dialect !== "sqlite") {
    for (const idx of model.indexes) {
      const s = formatIndex(idx, model);
      if (s) bodyLines.push("  " + s);
    }
  }
  lines.push(bodyLines.join(",\n"));
  const tail = formatTableOptions(options, dialect);
  if (tail) lines.push(`) ${tail};`);
  else lines.push(");");

  // Post-statements: PostgreSQL COMMENT ON, SQLite CREATE INDEX
  const post: string[] = [];
  if (info.supportsTableComment && dialect === "postgresql" && options.comment) {
    post.push(`COMMENT ON TABLE ${quoteIdentifier(name, dialect)} IS '${options.comment.replace(/'/g, "''")}';`);
  }
  if (dialect === "postgresql") {
    for (const col of columns) {
      if (col.comment) {
        post.push(`COMMENT ON COLUMN ${quoteIdentifier(name, dialect)}.${quoteIdentifier(col.name, dialect)} IS '${col.comment.replace(/'/g, "''")}';`);
      }
    }
  }
  if (dialect === "sqlite") {
    for (const idx of model.indexes) {
      const cols = idx.columns
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c)
        .map((c) => quoteIdentifier(c.name, dialect));
      if (cols.length === 0) continue;
      const idxName = idx.name || `idx_${name}_${idx.columns.join("_")}`;
      const unique = idx.unique ? "UNIQUE " : "";
      post.push(`CREATE ${unique}INDEX ${quoteIdentifier(idxName, dialect)} ON ${quoteIdentifier(name, dialect)} (${cols.join(", ")});`);
    }
  }
  if (dialect === "postgresql") {
    for (const idx of model.indexes) {
      const cols = idx.columns
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c)
        .map((c) => quoteIdentifier(c.name, dialect));
      if (cols.length === 0) continue;
      const idxName = idx.name || `idx_${name}_${idx.columns.join("_")}`;
      const unique = idx.unique ? "UNIQUE " : "";
      const method = idx.method ? ` USING ${idx.method.toUpperCase()}` : "";
      post.push(`CREATE ${unique}INDEX ${quoteIdentifier(idxName, dialect)} ON ${quoteIdentifier(name, dialect)}${method} (${cols.join(", ")});`);
    }
  }
  if (dialect === "sqlserver") {
    // SQL Server already emits inline INDEX in CREATE TABLE (post-statement not needed)
  }
  if (dialect === "sqlite" || dialect === "sqlserver") {
    // Inline comments as SQL comments after the table
    for (const col of columns) {
      if (col.comment) {
        post.push(`-- ${col.name}: ${col.comment}`);
      }
    }
    if (options.comment && !info.supportsTableComment) {
      post.push(`-- Table ${name}: ${options.comment}`);
    }
  }
  return lines.join("\n") + (post.length > 0 ? "\n" + post.join("\n") : "");
}

/** Build the matching DROP TABLE statement (per-dialect IF EXISTS syntax). */
export function buildDropTable(model: TableModel): string {
  const { dialect, name } = model;
  return `DROP TABLE IF EXISTS ${quoteIdentifier(name, dialect)};`;
}

/** Generate N seed INSERT statements respecting NOT NULL + defaults + ENUM values. */
export function buildSeedInserts(model: TableModel, count: number): string {
  const { dialect, name, columns } = model;
  if (columns.length === 0 || count <= 0) return "";
  const colNames = columns.map((c) => quoteIdentifier(c.name, dialect)).join(", ");
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const values = columns.map((c) => generateSeedValue(c, i, dialect)).join(", ");
    lines.push(`INSERT INTO ${quoteIdentifier(name, dialect)} (${colNames}) VALUES (${values});`);
  }
  return lines.join("\n");
}

/** Generate a single seed value for a column (deterministic by index i). */
export function generateSeedValue(col: ColumnDef, i: number, dialect: Dialect): string {
  void dialect;
  const t = col.type.toLowerCase();
  // Explicit default
  if (col.defaultValue !== undefined && col.defaultValue !== "") {
    return formatDefault(col);
  }
  // NULL when allowed
  if (col.nullable) return "NULL";
  // Auto-increment — skip (the DB will provide); emit DEFAULT where supported
  if (col.autoIncrement) {
    if (dialect === "mysql") return "DEFAULT";
    if (dialect === "postgresql") return "DEFAULT";
    if (dialect === "sqlserver") return "DEFAULT";
  }
  // Generate by type
  switch (t) {
    case "tinyint":
    case "smallint":
    case "mediumint":
    case "int":
    case "integer":
    case "bigint":
      return String(i + 1);
    case "decimal":
    case "numeric":
    case "float":
    case "double":
    case "real":
      return String((i + 1) * 1.5);
    case "boolean":
    case "bool":
    case "bit":
      return i % 2 === 0 ? "TRUE" : "FALSE";
    case "date":
      return `'2024-01-${String((i % 28) + 1).padStart(2, "0")}'`;
    case "time":
      return `'${String(i % 24).padStart(2, "0")}:00:00'`;
    case "datetime":
    case "timestamp":
      return `'2024-01-${String((i % 28) + 1).padStart(2, "0")} ${String(i % 24).padStart(2, "0")}:00:00'`;
    case "char":
    case "varchar":
    case "text":
    case "mediumtext":
    case "longtext":
      return `'seed_${i + 1}'`;
    case "enum": {
      const vals = col.enumValues ?? [];
      if (vals.length === 0) return "''";
      return `'${vals[i % vals.length].replace(/'/g, "''")}'`;
    }
    case "json":
    case "jsonb":
      return `'{"id": ${i + 1}}'`;
    case "uuid":
      return `'00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}'`;
    case "blob":
    case "binary":
    case "varbinary":
    case "bytea":
      return `x'${(i + 1).toString(16).padStart(8, "0")}'`;
    default:
      return "''";
  }
}

/** Build the full DDL output (DROP + CREATE + seeds). */
export function buildDdl(model: TableModel, seedCount = 0): DdlOutput {
  const createTable = buildCreateTable(model);
  const dropTable = buildDropTable(model);
  const seedInserts = buildSeedInserts(model, seedCount);
  // Extract post-statements (lines after CREATE TABLE)
  const createLines = createTable.split("\n");
  const createEnd = createLines.findIndex((l) => l.startsWith(");") || l.startsWith(") "));
  const postStatements = createEnd >= 0 && createEnd < createLines.length - 1
    ? createLines.slice(createEnd + 1).join("\n")
    : "";
  const parts: string[] = [];
  if (dropTable) parts.push(dropTable);
  parts.push(createTable);
  if (seedInserts) parts.push(seedInserts);
  return {
    createTable,
    dropTable,
    seedInserts,
    postStatements,
    syntheticChecks: [],
    full: parts.join("\n\n"),
  };
}

// ---------------------------------------------------------------------------
// CSV / JSON column inference
// ---------------------------------------------------------------------------

/** Parse a CSV string (header + rows) into rows of string cells. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(cell); cell = ""; }
      else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else if (ch === "\r") { /* skip */ }
      else cell += ch;
    }
  }
  if (cell !== "" || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

/** Infer a SQL type from a list of string values. */
export function inferType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== "" && v.toLowerCase() !== "null");
  if (nonEmpty.length === 0) return "varchar";
  // Boolean?
  if (nonEmpty.every((v) => /^(true|false|0|1)$/i.test(v))) return "boolean";
  // Integer?
  if (nonEmpty.every((v) => /^[+-]?\d+$/.test(v))) {
    const max = Math.max(...nonEmpty.map((v) => Math.abs(parseInt(v, 10))));
    if (max <= 127) return "tinyint";
    if (max <= 32767) return "smallint";
    if (max <= 2147483647) return "int";
    return "bigint";
  }
  // Decimal?
  if (nonEmpty.every((v) => /^[+-]?\d+(\.\d+)?$/.test(v))) return "decimal";
  // Date / timestamp?
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) return "date";
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(v))) return "timestamp";
  // Time
  if (nonEmpty.every((v) => /^\d{2}:\d{2}(:\d{2})?$/.test(v))) return "time";
  // JSON?
  if (nonEmpty.every((v) => {
    try { JSON.parse(v); return true; } catch { return false; }
  })) return "json";
  // Default — VARCHAR with detected max length
  return "varchar";
}

/** Detect max string length across values. */
export function detectMaxLength(values: string[]): number {
  const nonEmpty = values.filter((v) => v !== "");
  if (nonEmpty.length === 0) return 255;
  const max = Math.max(...nonEmpty.map((v) => v.length));
  // Round up to the next power-of-two-ish bucket
  if (max <= 50) return 50;
  if (max <= 100) return 100;
  if (max <= 255) return 255;
  if (max <= 500) return 500;
  if (max <= 1000) return 1000;
  return max;
}

/** Infer columns from a CSV sample (header row + data rows). */
export function inferFromCsv(csv: string, dialect: Dialect): ColumnDef[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const header = rows[0];
  const dataRows = rows.slice(1);
  return header.map((h, idx) => {
    const colValues = dataRows.map((r) => r[idx] ?? "");
    const type = inferType(colValues);
    const length = type === "varchar" || type === "char" ? detectMaxLength(colValues) : undefined;
    return {
      id: `col_${idx}_${h.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: h.trim(),
      type,
      length,
      nullable: true,
    } as ColumnDef;
  });
}

/** Infer columns from a JSON array of objects. */
export function inferFromJson(jsonStr: string, dialect: Dialect): ColumnDef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  // Collect all keys across objects (preserve insertion order of first object).
  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (const obj of parsed) {
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj as Record<string, unknown>)) {
        if (!seen.has(k)) { seen.add(k); keyOrder.push(k); }
      }
    }
  }
  return keyOrder.map((k, idx) => {
    const values = parsed
      .map((o) => {
        const v = (o as Record<string, unknown>)?.[k];
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      });
    const type = inferType(values);
    const length = type === "varchar" || type === "char" ? detectMaxLength(values) : undefined;
    return {
      id: `col_${idx}_${k.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: k,
      type,
      length,
      nullable: true,
    } as ColumnDef;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateModel(model: TableModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { name, columns, primaryKey, foreignKeys, uniques, checks, indexes, dialect, options } = model;
  const info = dialectInfo(dialect);
  if (!name.trim()) issues.push({ severity: "error", message: "Table name is required." });
  if (name.length > info.maxIdentifierLength) {
    issues.push({ severity: "error", message: `Table name exceeds ${info.maxIdentifierLength} characters for ${info.label}.` });
  }
  if (columns.length === 0) issues.push({ severity: "error", message: "At least one column is required." });
  // Duplicate column names
  const colNames = new Set<string>();
  for (const c of columns) {
    if (!c.name.trim()) issues.push({ severity: "error", message: "Column name is required." });
    if (colNames.has(c.name.toLowerCase())) {
      issues.push({ severity: "error", message: `Duplicate column name: "${c.name}".` });
    }
    colNames.add(c.name.toLowerCase());
    if (c.name.length > info.maxIdentifierLength) {
      issues.push({ severity: "error", message: `Column "${c.name}" exceeds ${info.maxIdentifierLength} characters.` });
    }
    if (c.autoIncrement && !c.type.match(/^(int|integer|bigint|smallint|tinyint)$/)) {
      issues.push({ severity: "error", message: `Column "${c.name}": auto-increment requires an integer type.` });
    }
    if (c.type === "enum" && (c.enumValues?.length ?? 0) === 0) {
      issues.push({ severity: "error", message: `Column "${c.name}": ENUM requires at least one value.` });
    }
  }
  // PK
  if (primaryKey.length > 0) {
    for (const id of primaryKey) {
      if (!columns.find((c) => c.id === id)) {
        issues.push({ severity: "error", message: "Primary key references a missing column." });
      }
    }
    const pkCols = primaryKey.map((id) => columns.find((c) => c.id === id)).filter((c): c is ColumnDef => !!c);
    if (pkCols.some((c) => c.nullable)) {
      issues.push({ severity: "error", message: "Primary key columns must be NOT NULL." });
    }
    if (dialect === "sqlite" && primaryKey.length === 1 && pkCols[0]?.autoIncrement && pkCols[0].type !== "integer") {
      issues.push({ severity: "error", message: "SQLite AUTOINCREMENT requires INTEGER PRIMARY KEY." });
    }
  }
  // FKs
  for (const fk of foreignKeys) {
    if (fk.columns.length === 0) issues.push({ severity: "error", message: "Foreign key has no local columns." });
    if (fk.columns.length !== fk.refColumns.length) {
      issues.push({ severity: "error", message: `Foreign key: local/ref column count mismatch.` });
    }
    if (!fk.refTable.trim()) issues.push({ severity: "error", message: "Foreign key: referenced table is required." });
    for (const id of fk.columns) {
      if (!columns.find((c) => c.id === id)) {
        issues.push({ severity: "error", message: "Foreign key references a missing local column." });
      }
    }
  }
  // UNIQUE
  for (const u of uniques) {
    if (u.columns.length === 0) issues.push({ severity: "error", message: "UNIQUE constraint has no columns." });
    for (const id of u.columns) {
      if (!columns.find((c) => c.id === id)) {
        issues.push({ severity: "error", message: "UNIQUE references a missing column." });
      }
    }
  }
  // CHECK
  for (const c of checks) {
    if (!c.expression.trim()) issues.push({ severity: "error", message: "CHECK constraint expression is required." });
  }
  // Indexes
  for (const idx of indexes) {
    if (idx.columns.length === 0) issues.push({ severity: "error", message: "Index has no columns." });
    for (const id of idx.columns) {
      if (!columns.find((c) => c.id === id)) {
        issues.push({ severity: "error", message: "Index references a missing column." });
      }
    }
  }
  // Options sanity
  if (options.withoutRowid && dialect !== "sqlite") {
    issues.push({ severity: "warning", message: "WITHOUT ROWID is a SQLite-only option; ignored on this dialect." });
  }
  if (options.engine && dialect !== "mysql") {
    issues.push({ severity: "warning", message: "ENGINE is a MySQL-only option; ignored on this dialect." });
  }
  if (options.charset && dialect !== "mysql") {
    issues.push({ severity: "warning", message: "CHARSET is a MySQL-only option; ignored on this dialect." });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESET_MODELS: ReadonlyArray<{ label: string; model: TableModel }> = [
  {
    label: "Users (MySQL, with ENUM + auto-increment PK)",
    model: {
      name: "users",
      dialect: "mysql",
      columns: [
        { id: "c1", name: "id", type: "bigint", nullable: false, autoIncrement: true },
        { id: "c2", name: "email", type: "varchar", length: 255, nullable: false },
        { id: "c3", name: "role", type: "enum", nullable: false, enumValues: ["admin", "editor", "viewer"], defaultValue: "viewer" },
        { id: "c4", name: "created_at", type: "timestamp", nullable: false, defaultValue: "CURRENT_TIMESTAMP", defaultIsExpression: true },
      ],
      primaryKey: ["c1"],
      foreignKeys: [],
      uniques: [{ id: "u1", columns: ["c2"] }],
      checks: [],
      indexes: [{ id: "i1", columns: ["c3"] }],
      options: { ifNotExists: true, engine: "InnoDB", charset: "utf8mb4", comment: "Application users." },
    },
  },
  {
    label: "Posts + FK (PostgreSQL, composite UNIQUE)",
    model: {
      name: "posts",
      dialect: "postgresql",
      columns: [
        { id: "c1", name: "id", type: "integer", nullable: false, autoIncrement: true },
        { id: "c2", name: "author_id", type: "bigint", nullable: false },
        { id: "c3", name: "slug", type: "varchar", length: 200, nullable: false },
        { id: "c4", name: "title", type: "varchar", length: 255, nullable: false },
        { id: "c5", name: "body", type: "text", nullable: true },
        { id: "c6", name: "published", type: "boolean", nullable: false, defaultValue: "false" },
        { id: "c7", name: "view_count", type: "integer", nullable: false, defaultValue: "0" },
      ],
      primaryKey: ["c1"],
      foreignKeys: [
        { id: "f1", columns: ["c2"], refTable: "users", refColumns: ["id"], onDelete: "cascade", onUpdate: "cascade" },
      ],
      uniques: [{ id: "u1", columns: ["c3"] }, { id: "u2", columns: ["c2", "c3"], name: "uq_author_slug" }],
      checks: [{ id: "ck1", expression: '"view_count" >= 0' }],
      indexes: [{ id: "i1", columns: ["c6"] }, { id: "i2", columns: ["c2", "c6"], method: "btree" }],
      options: { ifNotExists: false, comment: "Blog posts." },
    },
  },
  {
    label: "Tags (SQLite, WITHOUT ROWID composite PK)",
    model: {
      name: "post_tags",
      dialect: "sqlite",
      columns: [
        { id: "c1", name: "post_id", type: "integer", nullable: false },
        { id: "c2", name: "tag_id", type: "integer", nullable: false },
        { id: "c3", name: "tagged_at", type: "text", nullable: false, defaultValue: "CURRENT_TIMESTAMP", defaultIsExpression: true },
      ],
      primaryKey: ["c1", "c2"],
      foreignKeys: [
        { id: "f1", columns: ["c1"], refTable: "posts", refColumns: ["id"], onDelete: "cascade" },
        { id: "f2", columns: ["c2"], refTable: "tags", refColumns: ["id"], onDelete: "cascade" },
      ],
      uniques: [],
      checks: [],
      indexes: [{ id: "i1", columns: ["c2"] }],
      options: { ifNotExists: true, withoutRowid: true },
    },
  },
];

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:create-table-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  tableName: string;
  dialect: Dialect;
  columnCount: number;
  fkCount: number;
  indexCount: number;
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
// Shareable URL (base64-encoded JSON in the URL fragment)
// ---------------------------------------------------------------------------

function encodeBase64(s: string): string {
  // UTF-8 safe base64
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(s)
    : Uint8Array.from(s, (c) => c.charCodeAt(0));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(s: string): string {
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return typeof TextDecoder !== "undefined"
    ? new TextDecoder().decode(bytes)
    : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

export function encodeState(model: TableModel): string {
  return encodeBase64(JSON.stringify(model));
}

export function decodeState(s: string): TableModel | null {
  try {
    const json = decodeBase64(s);
    const obj = JSON.parse(json) as TableModel;
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.columns)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function buildShareUrl(model: TableModel): string {
  const frag = `m=${encodeState(model)}`;
  if (typeof window === "undefined") return `?${frag}`;
  return `${window.location.origin}${window.location.pathname}#${frag}`;
}

export function parseShareUrl(hash: string): TableModel | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const m = params.get("m");
  if (!m) return null;
  return decodeState(m);
}

// ---------------------------------------------------------------------------
// Helpers for the UI: stable id generator
// ---------------------------------------------------------------------------

let _idCounter = 0;
export function newId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}
