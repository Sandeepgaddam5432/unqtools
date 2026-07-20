/**
 * ER Diagram Designer (Diagram to SQL) — pure logic.
 *
 * Visual schema model → dialect-aware CREATE TABLE DDL + migration scripts.
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Dialect = "postgres" | "mysql" | "sqlite" | "sqlserver";

export const DIALECTS: Dialect[] = ["postgres", "mysql", "sqlite", "sqlserver"];

export const DIALECT_LABELS: Record<Dialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  sqlite: "SQLite",
  sqlserver: "SQL Server",
};

export type OnAction = "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";

export const ON_ACTIONS: OnAction[] = [
  "CASCADE", "SET NULL", "SET DEFAULT", "RESTRICT", "NO ACTION",
];

export type ColumnType =
  | "integer" | "bigint" | "smallint" | "serial" | "bigserial"
  | "decimal" | "numeric" | "real" | "double"
  | "varchar" | "char" | "text"
  | "date" | "time" | "timestamp" | "timestamptz"
  | "boolean"
  | "json" | "jsonb" | "uuid" | "blob" | "bytea"
  | "enum";

export const COLUMN_TYPES: ColumnType[] = [
  "integer", "bigint", "smallint", "serial", "bigserial",
  "decimal", "numeric", "real", "double",
  "varchar", "char", "text",
  "date", "time", "timestamp", "timestamptz",
  "boolean",
  "json", "jsonb", "uuid", "blob", "bytea",
  "enum",
];

export const TYPE_LABELS: Record<ColumnType, string> = {
  integer: "INTEGER",
  bigint: "BIGINT",
  smallint: "SMALLINT",
  serial: "SERIAL (auto-increment INT)",
  bigserial: "BIGSERIAL (auto-increment BIGINT)",
  decimal: "DECIMAL(p, s)",
  numeric: "NUMERIC(p, s)",
  real: "REAL",
  double: "DOUBLE PRECISION",
  varchar: "VARCHAR(n)",
  char: "CHAR(n)",
  text: "TEXT",
  date: "DATE",
  time: "TIME",
  timestamp: "TIMESTAMP",
  timestamptz: "TIMESTAMPTZ",
  boolean: "BOOLEAN",
  json: "JSON",
  jsonb: "JSONB (Postgres)",
  uuid: "UUID",
  blob: "BLOB",
  bytea: "BYTEA (Postgres)",
  enum: "ENUM (custom)",
};

export interface DesignerColumn {
  id: string;
  name: string;
  type: ColumnType;
  /** Length/precision (e.g. 255 for VARCHAR(255)). */
  length?: number;
  /** Scale for DECIMAL/NUMERIC. */
  scale?: number;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue: string | null;
  /** For enum type only. */
  enumValues?: string[];
}

export interface DesignerRelationship {
  id: string;
  fromTableId: string;
  fromColumnIds: string[];
  toTableId: string;
  toColumnIds: string[];
  onDelete: OnAction;
  onUpdate: OnAction;
  /** Optional constraint name. */
  name?: string;
}

export interface DesignerEntity {
  id: string;
  name: string;
  columns: DesignerColumn[];
}

export interface DesignerModel {
  version: number;
  entities: DesignerEntity[];
  relationships: DesignerRelationship[];
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  entityId?: string;
  relationshipId?: string;
}

export type MigrationOpType =
  | "create_table"
  | "drop_table"
  | "rename_table"
  | "add_column"
  | "drop_column"
  | "rename_column"
  | "add_pk"
  | "drop_pk"
  | "add_fk"
  | "drop_fk"
  | "add_unique"
  | "drop_unique";

export interface MigrationOp {
  type: MigrationOpType;
  sql: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// ID & model factories
// ---------------------------------------------------------------------------

let _idCounter = 0;
function newId(prefix: string): string {
  _idCounter++;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}

export function createColumn(partial?: Partial<DesignerColumn>): DesignerColumn {
  return {
    id: newId("col"),
    name: partial?.name ?? "new_column",
    type: partial?.type ?? "varchar",
    length: partial?.length,
    scale: partial?.scale,
    nullable: partial?.nullable ?? true,
    primaryKey: partial?.primaryKey ?? false,
    unique: partial?.unique ?? false,
    autoIncrement: partial?.autoIncrement ?? false,
    defaultValue: partial?.defaultValue ?? null,
    enumValues: partial?.enumValues,
  };
}

export function createEntity(name: string, partial?: Partial<DesignerEntity>): DesignerEntity {
  return {
    id: newId("ent"),
    name,
    columns: partial?.columns ?? [
      createColumn({ name: "id", type: "integer", primaryKey: true, nullable: false, autoIncrement: true }),
    ],
  };
}

export function createRelationship(partial: Partial<DesignerRelationship>): DesignerRelationship {
  return {
    id: newId("rel"),
    fromTableId: partial.fromTableId ?? "",
    fromColumnIds: partial.fromColumnIds ?? [],
    toTableId: partial.toTableId ?? "",
    toColumnIds: partial.toColumnIds ?? [],
    onDelete: partial.onDelete ?? "NO ACTION",
    onUpdate: partial.onUpdate ?? "NO ACTION",
    name: partial.name,
  };
}

export function createEmptyModel(): DesignerModel {
  return { version: 1, entities: [], relationships: [] };
}

// ---------------------------------------------------------------------------
// Model mutations (immutable — return new model)
// ---------------------------------------------------------------------------

/**
 * Resolve an entity reference (either the entity ID or its name) to its ID.
 * Allows callers to use the human-friendly entity name in mutations.
 */
export function resolveEntityId(model: DesignerModel, idOrName: string): string | null {
  if (!idOrName) return null;
  // Exact ID match first
  const byId = model.entities.find((e) => e.id === idOrName);
  if (byId) return byId.id;
  // Case-sensitive name match
  const byName = model.entities.find((e) => e.name === idOrName);
  if (byName) return byName.id;
  // Case-insensitive name match (last resort)
  const byNameLower = model.entities.find((e) => e.name.toLowerCase() === idOrName.toLowerCase());
  if (byNameLower) return byNameLower.id;
  return null;
}

export function addEntity(model: DesignerModel, name: string): DesignerModel {
  if (!name.trim()) return model;
  return { ...model, entities: [...model.entities, createEntity(name)] };
}

export function removeEntity(model: DesignerModel, entityId: string): DesignerModel {
  const id = resolveEntityId(model, entityId) ?? entityId;
  return {
    ...model,
    entities: model.entities.filter((e) => e.id !== id),
    relationships: model.relationships.filter(
      (r) => r.fromTableId !== id && r.toTableId !== id,
    ),
  };
}

export function renameEntity(model: DesignerModel, entityId: string, name: string): DesignerModel {
  const id = resolveEntityId(model, entityId) ?? entityId;
  return {
    ...model,
    entities: model.entities.map((e) => e.id === id ? { ...e, name } : e),
  };
}

export function addColumn(model: DesignerModel, entityId: string, column?: Partial<DesignerColumn>): DesignerModel {
  const id = resolveEntityId(model, entityId) ?? entityId;
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === id ? { ...e, columns: [...e.columns, createColumn(column)] } : e,
    ),
  };
}

export function updateColumn(
  model: DesignerModel,
  entityId: string,
  columnId: string,
  patch: Partial<DesignerColumn>,
): DesignerModel {
  const id = resolveEntityId(model, entityId) ?? entityId;
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === id
        ? { ...e, columns: e.columns.map((c) => c.id === columnId ? { ...c, ...patch } : c) }
        : e,
    ),
  };
}

export function removeColumn(model: DesignerModel, entityId: string, columnId: string): DesignerModel {
  const id = resolveEntityId(model, entityId) ?? entityId;
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === id
        ? { ...e, columns: e.columns.filter((c) => c.id !== columnId) }
        : e,
    ),
    relationships: model.relationships.filter(
      (r) => !(r.fromTableId === id && r.fromColumnIds.includes(columnId))
        && !(r.toTableId === id && r.toColumnIds.includes(columnId)),
    ),
  };
}

export function addRelationship(model: DesignerModel, rel: Partial<DesignerRelationship>): DesignerModel {
  if (!rel.fromTableId || !rel.toTableId) return model;
  if (!rel.fromColumnIds?.length || !rel.toColumnIds?.length) return model;
  return { ...model, relationships: [...model.relationships, createRelationship(rel)] };
}

export function removeRelationship(model: DesignerModel, relId: string): DesignerModel {
  return {
    ...model,
    relationships: model.relationships.filter((r) => r.id !== relId),
  };
}

// ---------------------------------------------------------------------------
// Reserved words per dialect (curated common set)
// ---------------------------------------------------------------------------

const ANSI_RESERVED = new Set<string>([
  "select", "from", "where", "insert", "update", "delete", "create", "drop", "alter",
  "table", "index", "view", "schema", "database", "column", "constraint", "primary",
  "foreign", "key", "unique", "check", "default", "null", "not", "and", "or", "between",
  "in", "like", "is", "as", "on", "join", "inner", "left", "right", "full", "outer",
  "cross", "group", "by", "order", "having", "asc", "desc", "limit", "offset", "union",
  "all", "distinct", "case", "when", "then", "else", "end", "exists", "any", "some",
  "values", "into", "set", "with", "recursive", "begin", "commit", "rollback",
  "transaction", "savepoint", "grant", "revoke", "user", "role", "session", "system",
  "current", "current_date", "current_time", "current_timestamp", "current_user",
  "row", "rows", "fetch", "next", "only", "first", "last", "cast", "convert",
  "truncate", "merge", "using", "natural", "procedure", "function", "trigger",
  "return", "returns", "if", "else", "for", "while", "loop", "exit", "continue",
]);

const MYSQL_RESERVED = new Set<string>([
  ...ANSI_RESERVED,
  "auto_increment", "engine", "charset", "collate", "unsigned", "zerofill",
  "binary", "varbinary", "enum", "set", "tinyint", "mediumint", "smallint",
  "bigint", "int", "integer", "double", "float", "decimal", "numeric", "real",
  "char", "varchar", "text", "tinytext", "mediumtext", "longtext", "blob",
  "tinyblob", "mediumblob", "longblob", "date", "datetime", "timestamp", "time",
  "year", "boolean", "bool", "json", "geometry", "point", "linestring", "polygon",
  "use", "describe", "explain", "show", "lock", "unlock", "distinctrow",
  "straight_join", "sql_small_result", "sql_big_result", "sql_buffer_result",
  "sql_cache", "sql_no_cache", "sql_calc_found_rows", "high_priority",
  "low_priority", "delayed", "write", "read", "local", "ignore", "replace",
]);

const POSTGRES_RESERVED = new Set<string>([
  ...ANSI_RESERVED,
  "serial", "bigserial", "smallserial", "money", "bytea", "oid", "regclass",
  "regproc", "regtype", "returning", "return", "language", "plpgsql", "volatile",
  "stable", "immutable", "strict", "security", "definer", "invoker", "window",
  "partition", "over", "range", "rows", "preceding", "following", "unbounded",
  "materialized", "vacuum", "analyze", "reindex", "cluster", "copy", "do",
  "raise", "notice", "exception", "aggregate", "operator", "cast", "domain",
  "extension", "foreign", "server", "user", "mapping", "option", "wrapper",
  "tablespace", "sequence", "increment", "minvalue", "maxvalue", "start",
  "cache", "cycle", "owned", "restart", "asc", "desc", "nulls", "first", "last",
]);

const SQLITE_RESERVED = new Set<string>([
  ...ANSI_RESERVED,
  "autoincrement", "integer", "text", "real", "blob", "numeric", "affinity",
  "rowid", "row", "autoincrement", "conflict", "abort", "fail", "ignore",
  "replace", "rollback", "deferred", "immediate", "exclusive", "savepoint",
  "release", "vacuum", "pragma", "attach", "detach", "reindex", "analyze",
  "load", "extension", "match", "glob", "regexp", "like", "escape",
]);

const SQLSERVER_RESERVED = new Set<string>([
  ...ANSI_RESERVED,
  "identity", "bigint", "int", "smallint", "tinyint", "bit", "decimal", "numeric",
  "money", "smallmoney", "float", "real", "datetime", "datetime2", "smalldatetime",
  "date", "time", "datetimeoffset", "char", "varchar", "varchar", "text", "nchar",
  "nvarchar", "ntext", "binary", "varbinary", "image", "cursor", "sql_variant",
  "table", "rowversion", "hierarchyid", "uniqueidentifier", "xml", "geography",
  "geometry", "top", "percent", "with", "ties", "rowset", "rowguidcol", "apply",
  "pivot", "unpivot", "merge", "output", "inserted", "deleted", "trunc", "truncate",
  "checkpoint", "backup", "restore", "dbcc", "setuser", "shutdown", "kill",
  "throw", "try", "catch", "transaction", "commit", "rollback", "save",
]);

export function isReservedWord(word: string, dialect: Dialect): boolean {
  const lower = word.toLowerCase();
  switch (dialect) {
    case "postgres": return POSTGRES_RESERVED.has(lower);
    case "mysql": return MYSQL_RESERVED.has(lower);
    case "sqlite": return SQLITE_RESERVED.has(lower);
    case "sqlserver": return SQLSERVER_RESERVED.has(lower);
  }
}

export function quoteIdentifier(name: string, dialect: Dialect): string {
  // Quote if contains special chars, spaces, or is a reserved word
  const needsQuote = !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || isReservedWord(name, dialect);
  if (!needsQuote) return name;
  switch (dialect) {
    case "postgres":
    case "sqlite":
      return `"${name.replace(/"/g, '""')}"`;
    case "mysql":
      return "`" + name.replace(/`/g, "``") + "`";
    case "sqlserver":
      return `[${name.replace(/\]/g, "]]")}]`;
  }
}

// ---------------------------------------------------------------------------
// Type rendering per dialect
// ---------------------------------------------------------------------------

export function renderColumnType(col: DesignerColumn, dialect: Dialect): string {
  const t = col.type;
  switch (t) {
    case "integer":
    case "bigint":
    case "smallint":
      return t.toUpperCase();
    case "serial":
      if (dialect === "postgres") return "SERIAL";
      if (dialect === "sqlite") return "INTEGER";
      if (dialect === "mysql") return "INTEGER";
      if (dialect === "sqlserver") return "INT";
      return t.toUpperCase();
    case "bigserial":
      if (dialect === "postgres") return "BIGSERIAL";
      if (dialect === "sqlite") return "INTEGER";
      if (dialect === "mysql") return "BIGINT";
      if (dialect === "sqlserver") return "BIGINT";
      return t.toUpperCase();
    case "decimal":
    case "numeric": {
      const p = col.length ?? 10;
      const s = col.scale ?? 0;
      return s > 0 ? `${t.toUpperCase()}(${p}, ${s})` : `${t.toUpperCase()}(${p})`;
    }
    case "real":
      if (dialect === "sqlserver") return "REAL";
      if (dialect === "mysql") return "FLOAT";
      return "REAL";
    case "double":
      if (dialect === "mysql") return "DOUBLE";
      if (dialect === "sqlserver") return "FLOAT";
      if (dialect === "sqlite") return "REAL";
      return "DOUBLE PRECISION";
    case "varchar":
    case "char": {
      const len = col.length ?? 255;
      return `${t.toUpperCase()}(${len})`;
    }
    case "text":
      if (dialect === "sqlserver") return "NVARCHAR(MAX)";
      return "TEXT";
    case "date":
    case "time":
      return t.toUpperCase();
    case "timestamp":
      if (dialect === "mysql") return "DATETIME";
      return "TIMESTAMP";
    case "timestamptz":
      if (dialect === "postgres") return "TIMESTAMPTZ";
      if (dialect === "mysql") return "DATETIME";
      if (dialect === "sqlite") return "TEXT";
      if (dialect === "sqlserver") return "DATETIMEOFFSET";
      return "TIMESTAMP";
    case "boolean":
      if (dialect === "mysql") return "TINYINT(1)";
      if (dialect === "sqlserver") return "BIT";
      if (dialect === "sqlite") return "INTEGER";
      return "BOOLEAN";
    case "json":
      if (dialect === "postgres") return "JSON";
      if (dialect === "mysql") return "JSON";
      if (dialect === "sqlite") return "TEXT";
      if (dialect === "sqlserver") return "NVARCHAR(MAX)";
      return "JSON";
    case "jsonb":
      if (dialect === "postgres") return "JSONB";
      return "TEXT";
    case "uuid":
      if (dialect === "postgres") return "UUID";
      if (dialect === "sqlite") return "TEXT";
      if (dialect === "mysql") return "CHAR(36)";
      if (dialect === "sqlserver") return "UNIQUEIDENTIFIER";
      return "CHAR(36)";
    case "blob":
      if (dialect === "mysql") return "BLOB";
      if (dialect === "sqlite") return "BLOB";
      if (dialect === "postgres") return "BYTEA";
      if (dialect === "sqlserver") return "VARBINARY(MAX)";
      return "BLOB";
    case "bytea":
      if (dialect === "postgres") return "BYTEA";
      return "BLOB";
    case "enum": {
      const values = col.enumValues ?? [];
      if (values.length === 0) return "TEXT";
      if (dialect === "postgres") return "TEXT"; // emit CREATE TYPE separately
      if (dialect === "mysql") return `ENUM(${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`;
      if (dialect === "sqlite") return "TEXT";
      if (dialect === "sqlserver") return "NVARCHAR(100)";
      return "TEXT";
    }
    default:
      return String(t).toUpperCase();
  }
}

/** Should the column emit AUTO_INCREMENT / AUTOINCREMENT / IDENTITY syntax? */
function shouldEmitAutoIncrement(col: DesignerColumn, dialect: Dialect): boolean {
  if (col.autoIncrement) return true;
  if ((col.type === "serial" || col.type === "bigserial") && (dialect === "mysql" || dialect === "sqlserver" || dialect === "sqlite")) {
    return true;
  }
  return false;
}

function autoIncrementClause(dialect: Dialect): string {
  switch (dialect) {
    case "mysql": return "AUTO_INCREMENT";
    case "sqlite": return "AUTOINCREMENT";
    case "sqlserver": return "IDENTITY(1,1)";
    case "postgres": return ""; // handled via SERIAL type
  }
  return "";
}

// ---------------------------------------------------------------------------
// DDL generation
// ---------------------------------------------------------------------------

export function generateDdl(model: DesignerModel, dialect: Dialect): string {
  const sorted = topologicalSort(model);
  const lines: string[] = [];
  // Postgres enum types
  if (dialect === "postgres") {
    for (const e of model.entities) {
      for (const c of e.columns) {
        if (c.type === "enum" && c.enumValues && c.enumValues.length > 0) {
          const enumName = `${e.name}_${c.name}_enum`;
          lines.push(`CREATE TYPE ${quoteIdentifier(enumName, dialect)} AS ENUM (${c.enumValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")});`);
        }
      }
    }
    if (lines.length > 0) lines.push("");
  }
  for (const entityId of sorted.order) {
    const entity = model.entities.find((e) => e.id === entityId);
    if (!entity) continue;
    lines.push(...generateCreateTable(entity, model, dialect));
    lines.push("");
  }
  return lines.join("\n").trim();
}

function generateCreateTable(entity: DesignerEntity, model: DesignerModel, dialect: Dialect): string[] {
  const lines: string[] = [];
  const tableName = quoteIdentifier(entity.name, dialect);
  lines.push(`CREATE TABLE ${tableName} (`);
  const colLines: string[] = [];
  for (const col of entity.columns) {
    colLines.push("  " + generateColumnDef(col, dialect));
  }
  // Primary key
  const pkCols = entity.columns.filter((c) => c.primaryKey).map((c) => c.name);
  if (pkCols.length > 0) {
    const pkName = `pk_${entity.name}`;
    colLines.push(
      `  CONSTRAINT ${quoteIdentifier(pkName, dialect)} PRIMARY KEY (${pkCols.map((c) => quoteIdentifier(c, dialect)).join(", ")})`,
    );
  }
  // Single-column UNIQUE constraints (multi-col UNIQUE not modeled in this designer)
  for (const col of entity.columns) {
    if (col.unique && !col.primaryKey) {
      const uqName = `uq_${entity.name}_${col.name}`;
      colLines.push(
        `  CONSTRAINT ${quoteIdentifier(uqName, dialect)} UNIQUE (${quoteIdentifier(col.name, dialect)})`,
      );
    }
  }
  // Foreign keys for this entity
  for (const rel of model.relationships) {
    if (rel.fromTableId !== entity.id) continue;
    const fromCols = rel.fromColumnIds.map((id) => entity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
    const toEntity = model.entities.find((e) => e.id === rel.toTableId);
    if (!toEntity || fromCols.length === 0) continue;
    const toCols = rel.toColumnIds.map((id) => toEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
    if (toCols.length === 0) continue;
    const fkName = rel.name ?? `fk_${entity.name}_${fromCols.map((c) => c.name).join("_")}`;
    const fromColStr = fromCols.map((c) => quoteIdentifier(c.name, dialect)).join(", ");
    const toColStr = toCols.map((c) => quoteIdentifier(c.name, dialect)).join(", ");
    let line = `  CONSTRAINT ${quoteIdentifier(fkName, dialect)} FOREIGN KEY (${fromColStr}) REFERENCES ${quoteIdentifier(toEntity.name, dialect)} (${toColStr})`;
    if (rel.onDelete !== "NO ACTION") line += ` ON DELETE ${rel.onDelete}`;
    if (rel.onUpdate !== "NO ACTION") line += ` ON UPDATE ${rel.onUpdate}`;
    colLines.push(line);
  }
  lines.push(colLines.join(",\n"));
  lines.push(");");
  return lines;
}

function generateColumnDef(col: DesignerColumn, dialect: Dialect): string {
  const parts: string[] = [quoteIdentifier(col.name, dialect)];
  let typeStr = renderColumnType(col, dialect);
  // Postgres enum: use the custom type name
  if (col.type === "enum" && dialect === "postgres" && col.enumValues && col.enumValues.length > 0) {
    typeStr = `${col.name}_enum`; // simplified — uses the entity prefix at call site
  }
  parts.push(typeStr);
  if (shouldEmitAutoIncrement(col, dialect)) {
    const clause = autoIncrementClause(dialect);
    if (clause) parts.push(clause);
  }
  if (!col.nullable) parts.push("NOT NULL");
  if (col.unique && col.primaryKey) {
    // PK constraint is added separately; don't double-up
  } else if (col.unique) {
    // UNIQUE handled via table-level constraint for naming consistency
  }
  if (col.defaultValue !== null && col.defaultValue !== "") {
    parts.push(`DEFAULT ${col.defaultValue}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Topological sort (creation order — handles cycles)
// ---------------------------------------------------------------------------

export interface TopoSortResult {
  order: string[]; // entity IDs
  cycles: string[][];
}

export function topologicalSort(model: DesignerModel): TopoSortResult {
  const deps = new Map<string, Set<string>>();
  for (const e of model.entities) {
    deps.set(e.id, new Set<string>());
  }
  for (const rel of model.relationships) {
    // The FK owner (fromTable) depends on the referenced table (toTable)
    if (rel.fromTableId !== rel.toTableId) {
      deps.get(rel.fromTableId)?.add(rel.toTableId);
    }
  }
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycles: string[][] = [];

  function visit(id: string, path: string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      if (cycleStart !== -1) cycles.push([...path.slice(cycleStart), id]);
      return;
    }
    visiting.add(id);
    path.push(id);
    for (const dep of deps.get(id) ?? []) visit(dep, path);
    path.pop();
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  // Sort by entity name for deterministic output
  const sorted = [...model.entities].sort((a, b) => a.name.localeCompare(b.name));
  for (const e of sorted) visit(e.id, []);

  // If cycles prevented full ordering, append remaining entities in name order
  for (const e of sorted) {
    if (!order.includes(e.id)) order.push(e.id);
  }

  return { order, cycles };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateModel(model: DesignerModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entityNames = new Map<string, string>(); // name → id
  for (const e of model.entities) {
    // Empty name
    if (!e.name.trim()) {
      issues.push({ severity: "error", message: "Entity has an empty name", entityId: e.id });
    }
    // Duplicate entity name
    if (entityNames.has(e.name.toLowerCase())) {
      issues.push({ severity: "error", message: `Duplicate entity name "${e.name}"`, entityId: e.id });
    } else {
      entityNames.set(e.name.toLowerCase(), e.id);
    }
    // No columns
    if (e.columns.length === 0) {
      issues.push({ severity: "warning", message: `Entity "${e.name}" has no columns`, entityId: e.id });
    }
    // No primary key
    if (!e.columns.some((c) => c.primaryKey)) {
      issues.push({ severity: "info", message: `Entity "${e.name}" has no primary key`, entityId: e.id });
    }
    // Duplicate column names
    const colNames = new Set<string>();
    for (const c of e.columns) {
      if (!c.name.trim()) {
        issues.push({ severity: "error", message: `Column in entity "${e.name}" has an empty name`, entityId: e.id });
      }
      if (colNames.has(c.name.toLowerCase())) {
        issues.push({ severity: "error", message: `Duplicate column "${c.name}" in entity "${e.name}"`, entityId: e.id });
      }
      colNames.add(c.name.toLowerCase());
      // autoIncrement without integer type
      if (c.autoIncrement && !["integer", "bigint", "smallint", "serial", "bigserial"].includes(c.type)) {
        issues.push({
          severity: "warning",
          message: `Column "${c.name}" in "${e.name}" is auto-increment but not an integer type`,
          entityId: e.id,
        });
      }
      // enum without values
      if (c.type === "enum" && (!c.enumValues || c.enumValues.length === 0)) {
        issues.push({
          severity: "warning",
          message: `Column "${c.name}" in "${e.name}" is enum but has no values`,
          entityId: e.id,
        });
      }
    }
  }
  // Relationships
  for (const rel of model.relationships) {
    const fromEntity = model.entities.find((e) => e.id === rel.fromTableId);
    const toEntity = model.entities.find((e) => e.id === rel.toTableId);
    if (!fromEntity) {
      issues.push({ severity: "error", message: "Relationship references missing source entity", relationshipId: rel.id });
      continue;
    }
    if (!toEntity) {
      issues.push({ severity: "error", message: `Relationship in "${fromEntity.name}" references missing target entity`, relationshipId: rel.id });
      continue;
    }
    if (rel.fromColumnIds.length !== rel.toColumnIds.length) {
      issues.push({
        severity: "error",
        message: `Relationship from "${fromEntity.name}" to "${toEntity.name}" has mismatched column counts`,
        relationshipId: rel.id,
      });
    }
    if (rel.fromColumnIds.length === 0) {
      issues.push({
        severity: "warning",
        message: `Relationship from "${fromEntity.name}" to "${toEntity.name}" has no columns`,
        relationshipId: rel.id,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// DBML import / export
// ---------------------------------------------------------------------------

export function generateDbml(model: DesignerModel): string {
  const lines: string[] = [];
  for (const e of model.entities) {
    lines.push(`Table ${e.name} {`);
    for (const c of e.columns) {
      const parts = [c.name, dbmlType(c)];
      const constraints: string[] = [];
      if (c.primaryKey) constraints.push("pk");
      if (!c.nullable) constraints.push("not null");
      if (c.unique) constraints.push("unique");
      if (c.autoIncrement) constraints.push("increment");
      if (c.defaultValue) constraints.push(`default: ${c.defaultValue}`);
      if (constraints.length > 0) parts.push(`[${constraints.join(", ")}]`);
      lines.push(`  ${parts.join(" ")}`);
    }
    lines.push("}");
    lines.push("");
  }
  for (const rel of model.relationships) {
    const fromEntity = model.entities.find((e) => e.id === rel.fromTableId);
    const toEntity = model.entities.find((e) => e.id === rel.toTableId);
    if (!fromEntity || !toEntity) continue;
    const fromCols = rel.fromColumnIds.map((id) => fromEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
    const toCols = rel.toColumnIds.map((id) => toEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
    if (fromCols.length === 0 || toCols.length === 0) continue;
    lines.push(
      `Ref: ${fromEntity.name}.${fromCols.map((c) => c.name).join(",")} > ${toEntity.name}.${toCols.map((c) => c.name).join(",")}`,
    );
  }
  return lines.join("\n").trim();
}

function dbmlType(col: DesignerColumn): string {
  switch (col.type) {
    case "varchar": return "varchar";
    case "char": return "char";
    case "text": return "text";
    case "integer":
    case "serial": return "int";
    case "bigint":
    case "bigserial": return "bigint";
    case "smallint": return "smallint";
    case "decimal": return `decimal`;
    case "numeric": return "numeric";
    case "real": return "real";
    case "double": return "double";
    case "date": return "date";
    case "time": return "time";
    case "timestamp": return "timestamp";
    case "timestamptz": return "timestamp";
    case "boolean": return "bool";
    case "json":
    case "jsonb": return "json";
    case "uuid": return "uuid";
    case "blob":
    case "bytea": return "blob";
    case "enum": return "varchar";
  }
  return "varchar";
}

/** Parse a simple DBML string into a DesignerModel. Best-effort. */
export function parseDbml(dbml: string): DesignerModel {
  const model = createEmptyModel();
  // Strip block comments
  const cleaned = dbml.replace(/\/\*[\s\S]*?\*\//g, "");
  // Match: Table name { ... }
  const tableRe = /Table\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(cleaned)) !== null) {
    const name = m[1];
    const body = m[2];
    const entity = createEntity(name, { columns: [] });
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Skip "indexes { ... }" or other blocks
      if (line.startsWith("indexes") || line.startsWith("Note")) continue;
      const colMatch = line.match(/^(\w+)\s+(\w+)(?:\s*\[(.*?)\])?$/);
      if (colMatch) {
        const cname = colMatch[1];
        const ctype = colMatch[2];
        const constraintsStr = colMatch[3] ?? "";
        const col = createColumn({ name: cname, type: dbmlTypeToColumnType(ctype) });
        if (constraintsStr.includes("pk")) col.primaryKey = true;
        if (constraintsStr.includes("not null")) col.nullable = false;
        if (constraintsStr.includes("unique")) col.unique = true;
        if (constraintsStr.includes("increment")) col.autoIncrement = true;
        const defaultMatch = constraintsStr.match(/default:\s*([^,\]]+)/);
        if (defaultMatch) col.defaultValue = defaultMatch[1].trim();
        entity.columns.push(col);
      }
    }
    model.entities.push(entity);
  }
  // Match: Ref: from.col > to.col
  const refRe = /Ref:\s+(\w+)\.([\w,]+)\s*>\s*(\w+)\.([\w,]+)/g;
  let rm: RegExpExecArray | null;
  while ((rm = refRe.exec(cleaned)) !== null) {
    const fromName = rm[1];
    const fromCols = rm[2].split(",").map((s) => s.trim());
    const toName = rm[3];
    const toCols = rm[4].split(",").map((s) => s.trim());
    const fromEntity = model.entities.find((e) => e.name === fromName);
    const toEntity = model.entities.find((e) => e.name === toName);
    if (!fromEntity || !toEntity) continue;
    const fromColIds = fromCols.map((n) => fromEntity.columns.find((c) => c.name === n)?.id).filter(Boolean) as string[];
    const toColIds = toCols.map((n) => toEntity.columns.find((c) => c.name === n)?.id).filter(Boolean) as string[];
    if (fromColIds.length === 0 || toColIds.length === 0) continue;
    model.relationships.push(createRelationship({
      fromTableId: fromEntity.id,
      fromColumnIds: fromColIds,
      toTableId: toEntity.id,
      toColumnIds: toColIds,
    }));
  }
  return model;
}

function dbmlTypeToColumnType(t: string): ColumnType {
  const lower = t.toLowerCase();
  if (lower.startsWith("varchar") || lower === "varchar") return "varchar";
  if (lower.startsWith("char")) return "char";
  if (lower === "text") return "text";
  if (lower === "int" || lower === "integer") return "integer";
  if (lower === "bigint") return "bigint";
  if (lower === "smallint") return "smallint";
  if (lower === "decimal" || lower.startsWith("decimal")) return "decimal";
  if (lower === "numeric" || lower.startsWith("numeric")) return "numeric";
  if (lower === "real") return "real";
  if (lower === "double") return "double";
  if (lower === "date") return "date";
  if (lower === "time") return "time";
  if (lower === "timestamp") return "timestamp";
  if (lower === "datetime") return "timestamp";
  if (lower === "bool" || lower === "boolean") return "boolean";
  if (lower === "json") return "json";
  if (lower === "uuid") return "uuid";
  if (lower === "blob" || lower === "binary") return "blob";
  return "varchar";
}

// ---------------------------------------------------------------------------
// Migration diff engine
// ---------------------------------------------------------------------------

export function diffModels(oldModel: DesignerModel, newModel: DesignerModel, dialect: Dialect): MigrationOp[] {
  const ops: MigrationOp[] = [];
  const oldEntities = new Map(oldModel.entities.map((e) => [e.id, e]));
  const newEntities = new Map(newModel.entities.map((e) => [e.id, e]));
  // Created tables
  for (const e of newModel.entities) {
    if (!oldEntities.has(e.id)) {
      const ddl = generateCreateTable(e, newModel, dialect).join("\n");
      ops.push({ type: "create_table", sql: ddl, detail: `Create table ${e.name}` });
    }
  }
  // Dropped tables
  for (const e of oldModel.entities) {
    if (!newEntities.has(e.id)) {
      ops.push({
        type: "drop_table",
        sql: `DROP TABLE ${quoteIdentifier(e.name, dialect)};`,
        detail: `Drop table ${e.name}`,
      });
    }
  }
  // Renamed tables (heuristic: same columns but different name)
  for (const newE of newModel.entities) {
    const oldE = oldEntities.get(newE.id);
    if (!oldE) continue;
    if (oldE.name !== newE.name) {
      let renameSql: string;
      if (dialect === "sqlserver") {
        renameSql = `EXEC sp_rename '${oldE.name}', '${newE.name}';`;
      } else {
        renameSql = `ALTER TABLE ${quoteIdentifier(oldE.name, dialect)} RENAME TO ${quoteIdentifier(newE.name, dialect)};`;
      }
      ops.push({
        type: "rename_table",
        sql: renameSql,
        detail: `Rename table ${oldE.name} → ${newE.name}`,
      });
    }
  }
  // Per-entity changes
  for (const newE of newModel.entities) {
    const oldE = oldEntities.get(newE.id);
    if (!oldE) continue;
    const oldCols = new Map(oldE.columns.map((c) => [c.id, c]));
    const newCols = new Map(newE.columns.map((c) => [c.id, c]));
    // Added columns
    for (const c of newE.columns) {
      if (!oldCols.has(c.id)) {
        ops.push({
          type: "add_column",
          sql: `ALTER TABLE ${quoteIdentifier(newE.name, dialect)} ADD COLUMN ${generateColumnDef(c, dialect)};`,
          detail: `Add column ${newE.name}.${c.name}`,
        });
      }
    }
    // Dropped columns
    for (const c of oldE.columns) {
      if (!newCols.has(c.id)) {
        ops.push({
          type: "drop_column",
          sql: `ALTER TABLE ${quoteIdentifier(newE.name, dialect)} DROP COLUMN ${quoteIdentifier(c.name, dialect)};`,
          detail: `Drop column ${newE.name}.${c.name}`,
        });
      }
    }
    // Renamed columns (heuristic: same type, same position, different name)
    for (const newC of newE.columns) {
      const oldC = oldCols.get(newC.id);
      if (!oldC) continue;
      if (oldC.name !== newC.name && oldC.type === newC.type) {
        let renameSql: string;
        if (dialect === "postgres") {
          renameSql = `ALTER TABLE ${quoteIdentifier(newE.name, dialect)} RENAME COLUMN ${quoteIdentifier(oldC.name, dialect)} TO ${quoteIdentifier(newC.name, dialect)};`;
        } else if (dialect === "mysql") {
          // Need full column redef for MySQL
          renameSql = `ALTER TABLE ${quoteIdentifier(newE.name, dialect)} CHANGE COLUMN ${quoteIdentifier(oldC.name, dialect)} ${generateColumnDef(newC, dialect)};`;
        } else if (dialect === "sqlite") {
          // SQLite older versions don't support RENAME COLUMN — emit a comment
          renameSql = `-- SQLite: rename column ${oldC.name} → ${newC.name} on ${newE.name} (recreate table or use SQLite 3.25+)`;
          renameSql += `\nALTER TABLE ${quoteIdentifier(newE.name, dialect)} RENAME COLUMN ${quoteIdentifier(oldC.name, dialect)} TO ${quoteIdentifier(newC.name, dialect)};`;
        } else {
          renameSql = `EXEC sp_rename '${newE.name}.${oldC.name}', '${newC.name}', 'COLUMN';`;
        }
        ops.push({ type: "rename_column", sql: renameSql, detail: `Rename column ${oldC.name} → ${newC.name} on ${newE.name}` });
      }
    }
  }
  // Added relationships
  const oldRels = new Map(oldModel.relationships.map((r) => [r.id, r]));
  const newRels = new Map(newModel.relationships.map((r) => [r.id, r]));
  for (const r of newModel.relationships) {
    if (!oldRels.has(r.id)) {
      const fromEntity = newModel.entities.find((e) => e.id === r.fromTableId);
      if (!fromEntity) continue;
      const fromCols = r.fromColumnIds.map((id) => fromEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
      const toEntity = newModel.entities.find((e) => e.id === r.toTableId);
      if (!toEntity) continue;
      const toCols = r.toColumnIds.map((id) => toEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
      const fkName = r.name ?? `fk_${fromEntity.name}_${fromCols.map((c) => c.name).join("_")}`;
      let sql = `ALTER TABLE ${quoteIdentifier(fromEntity.name, dialect)} ADD CONSTRAINT ${quoteIdentifier(fkName, dialect)} FOREIGN KEY (${fromCols.map((c) => quoteIdentifier(c.name, dialect)).join(", ")}) REFERENCES ${quoteIdentifier(toEntity.name, dialect)} (${toCols.map((c) => quoteIdentifier(c.name, dialect)).join(", ")})`;
      if (r.onDelete !== "NO ACTION") sql += ` ON DELETE ${r.onDelete}`;
      if (r.onUpdate !== "NO ACTION") sql += ` ON UPDATE ${r.onUpdate}`;
      ops.push({ type: "add_fk", sql: sql + ";", detail: `Add FK ${fkName}` });
    }
  }
  // Dropped relationships
  for (const r of oldModel.relationships) {
    if (!newRels.has(r.id)) {
      const fromEntity = oldModel.entities.find((e) => e.id === r.fromTableId);
      if (!fromEntity) continue;
      const fromCols = r.fromColumnIds.map((id) => fromEntity.columns.find((c) => c.id === id)).filter(Boolean) as DesignerColumn[];
      const fkName = r.name ?? `fk_${fromEntity.name}_${fromCols.map((c) => c.name).join("_")}`;
      ops.push({
        type: "drop_fk",
        sql: `ALTER TABLE ${quoteIdentifier(fromEntity.name, dialect)} DROP CONSTRAINT ${quoteIdentifier(fkName, dialect)};`,
        detail: `Drop FK ${fkName}`,
      });
    }
  }
  return ops;
}

export function generateMigration(oldModel: DesignerModel, newModel: DesignerModel, dialect: Dialect): string {
  const ops = diffModels(oldModel, newModel, dialect);
  if (ops.length === 0) return "-- No schema changes detected";
  const lines: string[] = [
    "-- Migration script",
    `-- Dialect: ${dialect}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- ${ops.length} operation(s)`,
    "",
    "BEGIN;",
    "",
  ];
  for (const op of ops) {
    lines.push(`-- ${op.detail}`);
    lines.push(op.sql);
    lines.push("");
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Schema JSON (for share URL & round-trip with #267)
// ---------------------------------------------------------------------------

export function serializeModel(model: DesignerModel): string {
  return JSON.stringify(model);
}

export function deserializeModel(json: string): DesignerModel | null {
  try {
    const parsed = JSON.parse(json) as DesignerModel;
    if (!parsed || !Array.isArray(parsed.entities) || !Array.isArray(parsed.relationships)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Import a SchemaModel JSON from the SQL DDL to ER Diagram Generator (#267). */
export function importFromSchemaModel(json: string): DesignerModel | null {
  try {
    const parsed = JSON.parse(json) as {
      tables: Array<{
        name: string;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          primaryKey: boolean;
          unique: boolean;
          autoIncrement: boolean;
          defaultValue: string | null;
        }>;
        foreignKeys: Array<{
          fromColumns: string[];
          toTable: string;
          toColumns: string[];
        }>;
      }>;
    };
    if (!parsed || !Array.isArray(parsed.tables)) return null;
    const model = createEmptyModel();
    for (const t of parsed.tables) {
      const entity = createEntity(t.name, { columns: [] });
      for (const c of t.columns) {
        entity.columns.push(createColumn({
          name: c.name,
          type: guessTypeFromSql(c.type),
          nullable: c.nullable,
          primaryKey: c.primaryKey,
          unique: c.unique,
          autoIncrement: c.autoIncrement,
          defaultValue: c.defaultValue,
        }));
      }
      model.entities.push(entity);
    }
    // Convert FKs to relationships
    for (const t of parsed.tables) {
      const fromEntity = model.entities.find((e) => e.name === t.name);
      if (!fromEntity) continue;
      for (const fk of t.foreignKeys) {
        const toEntity = model.entities.find((e) => e.name === fk.toTable);
        if (!toEntity) continue;
        const fromColIds = fk.fromColumns.map((n) => fromEntity.columns.find((c) => c.name === n)?.id).filter(Boolean) as string[];
        const toColIds = fk.toColumns.map((n) => toEntity.columns.find((c) => c.name === n)?.id).filter(Boolean) as string[];
        if (fromColIds.length === 0 || toColIds.length === 0) continue;
        model.relationships.push(createRelationship({
          fromTableId: fromEntity.id,
          fromColumnIds: fromColIds,
          toTableId: toEntity.id,
          toColumnIds: toColIds,
        }));
      }
    }
    return model;
  } catch {
    return null;
  }
}

function guessTypeFromSql(sqlType: string): ColumnType {
  const upper = sqlType.toUpperCase().replace(/\s*\(.*\)$/, "").trim();
  if (upper.startsWith("CHARACTER VARYING") || upper.startsWith("VARCHAR")) return "varchar";
  if (upper.startsWith("CHAR") || upper.startsWith("CHARACTER")) return "char";
  if (upper === "TEXT" || upper === "LONGTEXT" || upper === "MEDIUMTEXT" || upper === "TINYTEXT") return "text";
  if (upper === "BIGINT") return "bigint";
  if (upper === "SMALLINT") return "smallint";
  if (upper === "TINYINT") return "smallint";
  if (upper === "MEDIUMINT") return "integer";
  if (upper === "INTEGER" || upper === "INT") return "integer";
  if (upper === "SERIAL") return "serial";
  if (upper === "BIGSERIAL") return "bigserial";
  if (upper.startsWith("DECIMAL")) return "decimal";
  if (upper.startsWith("NUMERIC")) return "numeric";
  if (upper === "REAL") return "real";
  if (upper === "DOUBLE" || upper === "DOUBLE PRECISION" || upper === "FLOAT") return "double";
  if (upper === "DATE") return "date";
  if (upper === "TIME") return "time";
  if (upper === "DATETIME" || upper === "TIMESTAMP") return "timestamp";
  if (upper === "TIMESTAMPTZ") return "timestamptz";
  if (upper === "BOOLEAN" || upper === "BOOL" || upper === "BIT") return "boolean";
  if (upper === "JSON") return "json";
  if (upper === "JSONB") return "jsonb";
  if (upper === "UUID" || upper === "UNIQUEIDENTIFIER") return "uuid";
  if (upper === "BLOB" || upper === "BYTEA" || upper === "VARBINARY" || upper === "BINARY") return "blob";
  if (upper.startsWith("ENUM")) return "enum";
  return "varchar";
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS: { name: string; description: string; build: () => DesignerModel }[] = [
  {
    name: "Blog (users + posts)",
    description: "Two entities with a one-to-many FK",
    build: () => {
      let m = createEmptyModel();
      m = addEntity(m, "users");
      const usersId = m.entities[0].columns[0].id;
      m = addColumn(m, "users", { name: "email", type: "varchar", length: 255, nullable: false, unique: true });
      m = addColumn(m, "users", { name: "name", type: "varchar", length: 100, nullable: false });
      m = addColumn(m, "users", { name: "created_at", type: "timestamp", defaultValue: "CURRENT_TIMESTAMP" });
      m = addEntity(m, "posts");
      const postsId = m.entities[1].columns[0].id;
      m = addColumn(m, "posts", { name: "author_id", type: "integer", nullable: false });
      m = addColumn(m, "posts", { name: "title", type: "varchar", length: 200, nullable: false });
      m = addColumn(m, "posts", { name: "body", type: "text" });
      m = addColumn(m, "posts", { name: "published", type: "boolean", defaultValue: "FALSE" });
      const authorCol = m.entities[1].columns.find((c) => c.name === "author_id")!.id;
      m = addRelationship(m, {
        fromTableId: m.entities[1].id,
        fromColumnIds: [authorCol],
        toTableId: m.entities[0].id,
        toColumnIds: [usersId],
        onDelete: "CASCADE",
      });
      void postsId;
      return m;
    },
  },
  {
    name: "E-commerce (composite PK)",
    description: "Products, customers, orders, line_items with composite PK",
    build: () => {
      let m = createEmptyModel();
      m = addEntity(m, "products");
      m = updateColumn(m, "products", m.entities[0].columns[0].id, { autoIncrement: true });
      m = addColumn(m, "products", { name: "sku", type: "varchar", length: 50, nullable: false, unique: true });
      m = addColumn(m, "products", { name: "name", type: "varchar", length: 200, nullable: false });
      m = addColumn(m, "products", { name: "price", type: "decimal", length: 10, scale: 2, nullable: false });
      m = addEntity(m, "customers");
      m = updateColumn(m, "customers", m.entities[1].columns[0].id, { autoIncrement: true });
      m = addColumn(m, "customers", { name: "email", type: "varchar", length: 255, nullable: false, unique: true });
      m = addColumn(m, "customers", { name: "name", type: "varchar", length: 100, nullable: false });
      m = addEntity(m, "orders");
      m = updateColumn(m, "orders", m.entities[2].columns[0].id, { autoIncrement: true });
      m = addColumn(m, "orders", { name: "customer_id", type: "integer", nullable: false });
      m = addColumn(m, "orders", { name: "status", type: "varchar", length: 20, defaultValue: "'pending'" });
      m = addColumn(m, "orders", { name: "created_at", type: "timestamp", defaultValue: "CURRENT_TIMESTAMP" });
      m = addEntity(m, "order_items");
      // Replace default id column with composite PK
      m = removeColumn(m, "order_items", m.entities[3].columns[0].id);
      m = addColumn(m, "order_items", { name: "order_id", type: "integer", nullable: false, primaryKey: true });
      m = addColumn(m, "order_items", { name: "product_id", type: "integer", nullable: false, primaryKey: true });
      m = addColumn(m, "order_items", { name: "quantity", type: "integer", nullable: false, defaultValue: "1" });
      m = addColumn(m, "order_items", { name: "unit_price", type: "decimal", length: 10, scale: 2, nullable: false });
      // FKs
      const ordersEntity = m.entities.find((e) => e.name === "orders")!;
      const productsEntity = m.entities.find((e) => e.name === "products")!;
      const orderItemsEntity = m.entities.find((e) => e.name === "order_items")!;
      const customerIdCol = ordersEntity.columns.find((c) => c.name === "customer_id")!.id;
      const ordersIdCol = ordersEntity.columns[0].id;
      const productsIdCol = productsEntity.columns[0].id;
      const oiOrderId = orderItemsEntity.columns.find((c) => c.name === "order_id")!.id;
      const oiProductId = orderItemsEntity.columns.find((c) => c.name === "product_id")!.id;
      m = addRelationship(m, {
        fromTableId: ordersEntity.id,
        fromColumnIds: [customerIdCol],
        toTableId: m.entities.find((e) => e.name === "customers")!.id,
        toColumnIds: [m.entities.find((e) => e.name === "customers")!.columns[0].id],
      });
      m = addRelationship(m, {
        fromTableId: orderItemsEntity.id,
        fromColumnIds: [oiOrderId],
        toTableId: ordersEntity.id,
        toColumnIds: [ordersIdCol],
        onDelete: "CASCADE",
      });
      m = addRelationship(m, {
        fromTableId: orderItemsEntity.id,
        fromColumnIds: [oiProductId],
        toTableId: productsEntity.id,
        toColumnIds: [productsIdCol],
      });
      return m;
    },
  },
  {
    name: "Empty schema",
    description: "Start from scratch",
    build: () => createEmptyModel(),
  },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:er-diagram-designer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  entityCount: number;
  columnCount: number;
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
// Shareable URL (base64-encoded model JSON in the fragment)
// ---------------------------------------------------------------------------

function encodeBase64Url(s: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
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

export function buildShareUrl(model: DesignerModel, dialect: Dialect): string {
  const payload = { m: model, d: dialect };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  if (typeof window === "undefined") return `?s=${encoded}`;
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

export function parseShareUrl(hash: string): { model: DesignerModel | null; dialect: Dialect } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean.startsWith("s=")) return { model: null, dialect: "postgres" };
  const encoded = clean.slice(2);
  try {
    const json = decodeBase64Url(encoded);
    const parsed = JSON.parse(json) as { m: DesignerModel; d: Dialect };
    const model = deserializeModel(JSON.stringify(parsed.m));
    return { model, dialect: parsed.d ?? "postgres" };
  } catch {
    return { model: null, dialect: "postgres" };
  }
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

export function countColumns(model: DesignerModel): number {
  return model.entities.reduce((acc, e) => acc + e.columns.length, 0);
}

export function summarizeModel(model: DesignerModel): {
  entities: number;
  columns: number;
  relationships: number;
  pkFkIssues: number;
} {
  const issues = validateModel(model);
  return {
    entities: model.entities.length,
    columns: countColumns(model),
    relationships: model.relationships.length,
    pkFkIssues: issues.filter((i) => i.severity === "error").length,
  };
}

/** Render an ASCII preview of the model for quick visual inspection. */
export function renderAsciiPreview(model: DesignerModel): string {
  const lines: string[] = [];
  for (const e of model.entities) {
    lines.push(`┌── ${e.name} ──┐`);
    for (const c of e.columns) {
      const badge = c.primaryKey ? "PK" : c.unique ? "UK" : "· ";
      lines.push(`│ ${badge} ${c.name} ${renderColumnType(c, "postgres")}${c.nullable ? "" : " NN"}  │`);
    }
    lines.push("└──────┘");
  }
  return lines.join("\n");
}
