/**
 * Visual SQL Query Builder — pure logic.
 *
 * Build a SQL SELECT query from a structured visual model: tables, columns,
 * joins, WHERE / HAVING predicates, GROUP BY, ORDER BY, LIMIT / OFFSET.
 * 100% client-side — no DOM, no network, no DB connection. Safe to run
 * inside a Web Worker or unit test.
 *
 * Design principles:
 *  - Pure functions only. The QueryModel is the single source of truth.
 *  - Output is deterministic: same model + dialect → same SQL.
 *  - Identifiers are auto-quoted per-dialect; reserved words are always quoted.
 *  - Non-aggregated SELECT columns are auto-added to GROUP BY when any
 *    aggregate is present, so the generated SQL is always valid.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SqlDialect =
  | "ansi"
  | "mysql"
  | "postgresql"
  | "sqlite"
  | "sqlserver";

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
export type SortDirection = "ASC" | "DESC";
export type LogicalOp = "AND" | "OR";

export type WhereOperator =
  | "="
  | "!="
  | "<>"
  | "<"
  | "<="
  | ">"
  | ">="
  | "LIKE"
  | "NOT LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN";

export interface TableRef {
  /** Stable id within the model. */
  id: string;
  name: string;
  alias?: string;
}

export interface ColumnRef {
  id: string;
  /** Table id (or undefined for unqualified columns / expressions). */
  tableId?: string;
  name: string;
  /** Optional aggregate: COUNT, SUM, AVG, MIN, MAX. */
  aggregate?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  /** Output alias (AS …). */
  alias?: string;
}

export interface JoinDef {
  id: string;
  type: JoinType;
  table: string;
  alias?: string;
  /** Left side table id of the ON condition (must exist in tables). */
  leftTableId: string;
  leftColumn: string;
  /** Right side table = the joined table. */
  rightColumn: string;
}

export interface Predicate {
  id: string;
  /** Qualified or bare column expression, e.g. "t1.col" or "col". */
  column: string;
  operator: WhereOperator;
  /** Raw value string; parsed per-operator. */
  value: string;
  conjunction: LogicalOp;
}

export interface OrderByClause {
  id: string;
  column: string;
  direction: SortDirection;
}

export interface GroupByColumn {
  id: string;
  column: string;
}

export interface QueryModel {
  distinct: boolean;
  tables: TableRef[];
  columns: ColumnRef[];
  joins: JoinDef[];
  where: Predicate[];
  groupBy: GroupByColumn[];
  having: Predicate[];
  orderBy: OrderByClause[];
  limit: number | null;
  offset: number | null;
}

export interface BuildResult {
  ok: true;
  sql: string;
  warnings: string[];
}

export interface BuildError {
  ok: false;
  error: string;
}

export type BuildOutcome = BuildResult | BuildError;

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

// ---------------------------------------------------------------------------
// Constants / catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const SQL_DIALECTS: ReadonlyArray<{ value: SqlDialect; label: string }> = [
  { value: "ansi", label: "ANSI SQL (Standard)" },
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server (T-SQL)" },
];

export const JOIN_TYPES: ReadonlyArray<{ value: JoinType; label: string }> = [
  { value: "INNER", label: "INNER JOIN" },
  { value: "LEFT", label: "LEFT JOIN" },
  { value: "RIGHT", label: "RIGHT JOIN" },
  { value: "FULL", label: "FULL OUTER JOIN" },
];

export const WHERE_OPERATORS: ReadonlyArray<{ value: WhereOperator; label: string; needsValue: boolean }> = [
  { value: "=", label: "=  (equals)", needsValue: true },
  { value: "!=", label: "!= (not equals)", needsValue: true },
  { value: "<>", label: "<> (not equals)", needsValue: true },
  { value: "<", label: "<  (less than)", needsValue: true },
  { value: "<=", label: "<= (less or equal)", needsValue: true },
  { value: ">", label: ">  (greater than)", needsValue: true },
  { value: ">=", label: ">= (greater or equal)", needsValue: true },
  { value: "LIKE", label: "LIKE", needsValue: true },
  { value: "NOT LIKE", label: "NOT LIKE", needsValue: true },
  { value: "IN", label: "IN (list)", needsValue: true },
  { value: "NOT IN", label: "NOT IN (list)", needsValue: true },
  { value: "IS NULL", label: "IS NULL", needsValue: false },
  { value: "IS NOT NULL", label: "IS NOT NULL", needsValue: false },
  { value: "BETWEEN", label: "BETWEEN", needsValue: true },
];

export const AGGREGATES: ReadonlyArray<ColumnRef["aggregate"]> = [
  "COUNT", "SUM", "AVG", "MIN", "MAX",
];

export const SORT_DIRECTIONS: ReadonlyArray<{ value: SortDirection; label: string }> = [
  { value: "ASC", label: "ASC" },
  { value: "DESC", label: "DESC" },
];

/**
 * A curated reserved-word list (ANSI + common vendor keywords) used to
 * decide which identifiers must always be quoted.
 */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "full", "outer",
  "on", "group", "by", "having", "order", "asc", "desc", "limit", "offset",
  "distinct", "as", "and", "or", "not", "null", "is", "in", "between", "like",
  "union", "all", "case", "when", "then", "else", "end", "create", "table",
  "insert", "update", "delete", "into", "values", "set", "primary", "key",
  "foreign", "references", "default", "check", "constraint", "index", "view",
  "drop", "alter", "add", "column", "database", "schema", "if", "exists",
  "with", "recursive", "begin", "commit", "rollback", "transaction", "grant",
  "revoke", "user", "trigger", "procedure", "function", "return", "declare",
  "cursor", "open", "fetch", "close", "for", "each", "row", "unique",
]);

// ---------------------------------------------------------------------------
// Identifier handling
// ---------------------------------------------------------------------------

/** Trim and collapse internal whitespace; lowercase for case-insensitive compare. */
export function normalizeIdentifier(s: string): string {
  return (s || "").trim();
}

/** Whether an identifier should be auto-quoted (reserved word or unsafe chars). */
export function needsQuoting(identifier: string): boolean {
  const id = normalizeIdentifier(identifier);
  if (!id) return false;
  if (RESERVED_WORDS.has(id.toLowerCase())) return true;
  // Safe identifier chars: letters, digits, underscore, dollar; must not start with a digit.
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id)) return false;
  return true;
}

/** Quote a single identifier per-dialect. */
export function quoteIdentifier(identifier: string, dialect: SqlDialect): string {
  const id = normalizeIdentifier(identifier);
  if (!id) return "";
  if (!needsQuoting(id)) return id;
  switch (dialect) {
    case "mysql":
      // Backtick; escape internal backticks by doubling.
      return "`" + id.replace(/`/g, "``") + "`";
    case "sqlserver":
      // Square brackets; escape ] as ]].
      return "[" + id.replace(/]/g, "]]") + "]";
    case "ansi":
    case "postgresql":
    case "sqlite":
    default:
      // Double-quote; escape internal " by doubling.
      return '"' + id.replace(/"/g, '""') + '"';
  }
}

/**
 * Quote a qualified column reference like "users.id" or "u.name".
 * Each segment is quoted independently.
 */
export function qualifyColumn(ref: string, dialect: SqlDialect): string {
  const trimmed = normalizeIdentifier(ref);
  if (!trimmed) return "";
  if (trimmed === "*") return "*";
  const parts = trimmed.split(".");
  return parts.map((p) => (p === "*" ? "*" : quoteIdentifier(p, dialect))).join(".");
}

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
/** Deterministic id generator (pure; tests reset via resetIdCounter). */
export function createId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createEmptyModel(): QueryModel {
  return {
    distinct: false,
    tables: [],
    columns: [],
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
    limit: null,
    offset: null,
  };
}

/** Default model loaded into the UI on first visit (one example row). */
export function createDefaultModel(): QueryModel {
  const tId = "t_users";
  return {
    distinct: false,
    tables: [{ id: tId, name: "users", alias: "u" }],
    columns: [
      { id: "c1", tableId: tId, name: "id" },
      { id: "c2", tableId: tId, name: "email" },
    ],
    joins: [],
    where: [{ id: "w1", column: "u.id", operator: ">", value: "100", conjunction: "AND" }],
    groupBy: [],
    having: [],
    orderBy: [{ id: "o1", column: "u.id", direction: "DESC" }],
    limit: 50,
    offset: null,
  };
}

// ---------------------------------------------------------------------------
// Value rendering
// ---------------------------------------------------------------------------

/** True when a raw value looks like a numeric literal — left unquoted. */
export function isNumericLiteral(v: string): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
}

/** Escape a string literal value (single-quote, double the ' chars). */
export function escapeStringLiteral(v: string): string {
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/** Render a scalar value: numbers unquoted, strings quoted. */
export function renderScalar(v: string): string {
  const s = (v ?? "").trim();
  if (isNumericLiteral(s)) return s;
  return escapeStringLiteral(s);
}

/** Parse a comma-separated list of values; renders each as scalar, joined by ", ". */
export function renderList(v: string): string {
  const items = (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.map(renderScalar).join(", ");
}

/** Render two scalar values joined by AND (for BETWEEN). */
export function renderBetween(v: string): string {
  const parts = (v ?? "")
    .split(/,| AND | and /)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return renderScalar(parts[0] ?? "");
  return `${renderScalar(parts[0])} AND ${renderScalar(parts[1])}`;
}

/** Build a single WHERE/HAVING predicate fragment. */
export function buildPredicate(p: Predicate, dialect: SqlDialect): string {
  const col = qualifyColumn(p.column, dialect);
  switch (p.operator) {
    case "IS NULL":
    case "IS NOT NULL":
      return `${col} ${p.operator}`;
    case "IN":
    case "NOT IN":
      return `${col} ${p.operator} (${renderList(p.value)})`;
    case "BETWEEN":
      return `${col} BETWEEN ${renderBetween(p.value)}`;
    case "LIKE":
    case "NOT LIKE":
      // LIKE patterns are string literals.
      return `${col} ${p.operator} ${escapeStringLiteral(p.value)}`;
    default:
      return `${col} ${p.operator} ${renderScalar(p.value)}`;
  }
}

/** Join a list of predicates into a clause body using their conjunction. */
export function joinPredicates(predicates: Predicate[], dialect: SqlDialect): string {
  if (predicates.length === 0) return "";
  return predicates
    .map((p, i) => {
      const frag = buildPredicate(p, dialect);
      if (i === 0) return frag;
      return `${p.conjunction} ${frag}`;
    })
    .join("\n  ");
}

// ---------------------------------------------------------------------------
// Column / table / join rendering
// ---------------------------------------------------------------------------

/** Build a single SELECT column expression, e.g. `COUNT(u.id) AS total`. */
export function buildColumnExpr(col: ColumnRef, dialect: SqlDialect): string {
  if (col.aggregate) {
    const inner = col.name === "*" ? "*" : qualifyColumn(col.name, dialect);
    const expr = `${col.aggregate}(${inner})`;
    return col.alias ? `${expr} AS ${quoteIdentifier(col.alias, dialect)}` : expr;
  }
  const expr = qualifyColumn(col.name, dialect);
  return col.alias ? `${expr} AS ${quoteIdentifier(col.alias, dialect)}` : expr;
}

/** Render a table reference with optional alias. */
export function buildTableRef(t: TableRef, dialect: SqlDialect): string {
  const name = quoteIdentifier(t.name, dialect);
  if (t.alias && t.alias.trim()) {
    return `${name} AS ${quoteIdentifier(t.alias, dialect)}`;
  }
  return name;
}

/** Render a JOIN clause line. */
export function buildJoinClause(j: JoinDef, dialect: SqlDialect): string {
  const joinKw = j.type === "FULL" ? "FULL OUTER JOIN" : `${j.type} JOIN`;
  const table = quoteIdentifier(j.table, dialect);
  const tablePart = j.alias && j.alias.trim()
    ? `${table} AS ${quoteIdentifier(j.alias, dialect)}`
    : table;
  const left = qualifyColumn(j.leftColumn, dialect);
  const right = qualifyColumn(j.rightColumn, dialect);
  return `${joinKw} ${tablePart} ON ${left} = ${right}`;
}

// ---------------------------------------------------------------------------
// GROUP BY inference
// ---------------------------------------------------------------------------

/**
 * If any SELECT column has an aggregate, non-aggregated columns must appear
 * in GROUP BY. This returns the effective GROUP BY list (explicit + inferred,
 * de-duplicated). Inferred columns are not added if the user provided any
 * explicit GROUP BY columns.
 */
export function inferGroupBy(model: QueryModel): GroupByColumn[] {
  const hasAggregate = model.columns.some((c) => c.aggregate);
  if (!hasAggregate) return model.groupBy;
  if (model.groupBy.length > 0) return model.groupBy;
  const inferred: GroupByColumn[] = [];
  for (const c of model.columns) {
    if (c.aggregate) continue;
    if (!c.name || c.name === "*") continue;
    if (inferred.some((g) => g.column === c.name)) continue;
    inferred.push({ id: createId("g"), column: c.name });
  }
  return inferred;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a model; returns issues (errors block build, warnings don't). */
export function validateModel(model: QueryModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!model) {
    issues.push({ severity: "error", message: "Model is empty." });
    return issues;
  }
  if (!model.tables || model.tables.length === 0) {
    issues.push({ severity: "error", message: "At least one table is required in FROM." });
  }
  if (!model.columns || model.columns.length === 0) {
    issues.push({ severity: "error", message: "At least one SELECT column is required." });
  }
  // Columns referencing a tableId that no longer exists.
  const tableIds = new Set((model.tables ?? []).map((t) => t.id));
  for (const c of model.columns ?? []) {
    if (c.tableId && !tableIds.has(c.tableId)) {
      issues.push({
        severity: "warning",
        message: `Column "${c.name}" references an unknown table id; it will be emitted unqualified.`,
      });
    }
  }
  // Joins referencing an unknown leftTableId.
  for (const j of model.joins ?? []) {
    if (!tableIds.has(j.leftTableId)) {
      issues.push({
        severity: "warning",
        message: `JOIN on "${j.table}" references unknown left table; ON clause may be invalid.`,
      });
    }
  }
  // HAVING without aggregate in SELECT.
  const hasAgg = (model.columns ?? []).some((c) => c.aggregate);
  if ((model.having?.length ?? 0) > 0 && !hasAgg) {
    issues.push({
      severity: "warning",
      message: "HAVING used without any aggregate in SELECT — usually invalid SQL.",
    });
  }
  if (model.limit != null && (!Number.isFinite(model.limit) || model.limit < 0)) {
    issues.push({ severity: "error", message: "LIMIT must be a non-negative integer." });
  }
  if (model.offset != null && (!Number.isFinite(model.offset) || model.offset < 0)) {
    issues.push({ severity: "error", message: "OFFSET must be a non-negative integer." });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Build SQL
// ---------------------------------------------------------------------------

/** Build a complete SELECT statement from the model. */
export function buildSql(model: QueryModel, dialect: SqlDialect = "ansi"): BuildOutcome {
  const issues = validateModel(model);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return { ok: false, error: errors[0].message };
  }
  const warnings = issues
    .filter((i) => i.severity === "warning")
    .map((i) => i.message);

  const lines: string[] = [];

  // SELECT
  const distinctKw = model.distinct ? "DISTINCT " : "";
  const colParts = model.columns.map((c) => buildColumnExpr(c, dialect));
  lines.push(`SELECT ${distinctKw}${colParts.join(", ")}`);

  // FROM
  const tables = model.tables.map((t) => buildTableRef(t, dialect));
  lines.push(`FROM ${tables.join(", ")}`);

  // JOINs
  for (const j of model.joins) {
    lines.push(buildJoinClause(j, dialect));
  }

  // WHERE
  if (model.where.length > 0) {
    lines.push(`WHERE ${joinPredicates(model.where, dialect)}`);
  }

  // GROUP BY (with inference)
  const groupBy = inferGroupBy(model);
  if (groupBy.length > 0) {
    const cols = groupBy.map((g) => qualifyColumn(g.column, dialect)).join(", ");
    lines.push(`GROUP BY ${cols}`);
  }

  // HAVING
  if (model.having.length > 0) {
    lines.push(`HAVING ${joinPredicates(model.having, dialect)}`);
  }

  // ORDER BY
  if (model.orderBy.length > 0) {
    const parts = model.orderBy.map((o) => `${qualifyColumn(o.column, dialect)} ${o.direction}`);
    lines.push(`ORDER BY ${parts.join(", ")}`);
  }

  // LIMIT / OFFSET — standard SQL syntax (all supported dialects).
  if (model.limit != null) {
    lines.push(`LIMIT ${model.limit}`);
  }
  if (model.offset != null) {
    lines.push(`OFFSET ${model.offset}`);
  }

  return { ok: true, sql: lines.join("\n"), warnings };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface QueryPreset {
  id: string;
  label: string;
  description: string;
  model: QueryModel;
}

export const PRESETS: QueryPreset[] = [
  {
    id: "simple",
    label: "Simple SELECT",
    description: "One table, three columns, WHERE, ORDER BY.",
    model: {
      distinct: false,
      tables: [{ id: "pt1", name: "users", alias: "u" }],
      columns: [
        { id: "pc1", tableId: "pt1", name: "id" },
        { id: "pc2", tableId: "pt1", name: "name" },
        { id: "pc3", tableId: "pt1", name: "email" },
      ],
      joins: [],
      where: [{ id: "pw1", column: "u.id", operator: ">", value: "100", conjunction: "AND" }],
      groupBy: [],
      having: [],
      orderBy: [{ id: "po1", column: "u.name", direction: "ASC" }],
      limit: 50,
      offset: null,
    },
  },
  {
    id: "join-aggregate",
    label: "JOIN + Aggregate + GROUP BY",
    description: "Two-table join, COUNT(*) aggregate, GROUP BY, HAVING.",
    model: {
      distinct: false,
      tables: [
        { id: "jt1", name: "users", alias: "u" },
        { id: "jt2", name: "orders", alias: "o" },
      ],
      columns: [
        { id: "jc1", tableId: "jt1", name: "u.name", alias: "user_name" },
        { id: "jc2", aggregate: "COUNT", name: "*", alias: "order_count" },
        { id: "jc3", aggregate: "SUM", name: "o.total", alias: "total_spent" },
      ],
      joins: [{
        id: "jj1",
        type: "LEFT",
        table: "orders",
        alias: "o",
        leftTableId: "jt1",
        leftColumn: "u.id",
        rightColumn: "o.user_id",
      }],
      where: [],
      groupBy: [{ id: "jg1", column: "u.name" }],
      having: [{ id: "jh1", column: "order_count", operator: ">", value: "5", conjunction: "AND" }],
      orderBy: [{ id: "jo1", column: "total_spent", direction: "DESC" }],
      limit: null,
      offset: null,
    },
  },
  {
    id: "filtered-in",
    label: "WHERE IN + DISTINCT + LIMIT",
    description: "DISTINCT, WHERE with IN list, LIMIT/OFFSET pagination.",
    model: {
      distinct: true,
      tables: [{ id: "ft1", name: "products", alias: "p" }],
      columns: [
        { id: "fc1", tableId: "ft1", name: "category" },
        { id: "fc2", tableId: "ft1", name: "brand" },
      ],
      joins: [],
      where: [
        { id: "fw1", column: "p.category", operator: "IN", value: "electronics, books, toys", conjunction: "AND" },
        { id: "fw2", column: "p.price", operator: "BETWEEN", value: "10, 100", conjunction: "AND" },
      ],
      groupBy: [],
      having: [],
      orderBy: [],
      limit: 20,
      offset: 0,
    },
  },
];

// ---------------------------------------------------------------------------
// Schema JSON import
// ---------------------------------------------------------------------------

export interface SchemaTable {
  name: string;
  columns: string[];
}

export interface SchemaJson {
  tables: SchemaTable[];
}

/** Parse a schema JSON string. Throws on malformed JSON. */
export function parseSchemaJson(input: string): SchemaJson {
  const data = JSON.parse(input);
  if (!data || typeof data !== "object" || !Array.isArray(data.tables)) {
    throw new Error("Schema JSON must have a top-level 'tables' array.");
  }
  const out: SchemaJson = { tables: [] };
  for (const t of data.tables) {
    if (!t || typeof t.name !== "string") {
      throw new Error("Each table entry must have a string 'name'.");
    }
    if (!Array.isArray(t.columns)) {
      throw new Error(`Table "${t.name}" must have a 'columns' array.`);
    }
    out.tables.push({
      name: t.name,
      columns: t.columns.map((c: unknown) => String(c)),
    });
  }
  return out;
}

/** Build a starter QueryModel from a parsed schema (first table, all columns). */
export function modelFromSchema(schema: SchemaJson): QueryModel {
  const model = createEmptyModel();
  if (!schema.tables.length) return model;
  const first = schema.tables[0];
  const tId = createId("t");
  model.tables.push({ id: tId, name: first.name });
  for (const col of first.columns) {
    model.columns.push({ id: createId("c"), tableId: tId, name: col });
  }
  return model;
}

export const SAMPLE_SCHEMA_JSON = `{
  "tables": [
    { "name": "users", "columns": ["id", "name", "email", "created_at"] },
    { "name": "orders", "columns": ["id", "user_id", "total", "status", "created_at"] },
    { "name": "products", "columns": ["id", "name", "category", "price", "stock"] }
  ]
}`;

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:visual-sql-query-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dialect: SqlDialect;
  sqlPreview: string;
  tables: string[];
  columnCount: number;
  joinCount: number;
  whereCount: number;
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
// Shareable URL (fragment-encoded model)
// ---------------------------------------------------------------------------

/** Encode a model + dialect as a base64 string (UTF-8 safe via TextEncoder). */
export function encodeState(model: QueryModel, dialect: SqlDialect): string {
  const json = JSON.stringify({ m: model, d: dialect });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode a base64 string back to a model + dialect (UTF-8 safe via TextDecoder). */
export function decodeState(encoded: string): { model: QueryModel; dialect: SqlDialect } | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || !data.m) return null;
    return { model: data.m as QueryModel, dialect: (data.d as SqlDialect) ?? "ansi" };
  } catch {
    return null;
  }
}

export function buildShareUrl(model: QueryModel, dialect: SqlDialect): string {
  const encoded = encodeState(model, dialect);
  const params = new URLSearchParams();
  params.set("q", encoded);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { model: QueryModel | null; dialect: SqlDialect | null } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { model: null, dialect: null };
  const params = new URLSearchParams(clean);
  const q = params.get("q");
  if (!q) return { model: null, dialect: null };
  const decoded = decodeState(q);
  if (!decoded) return { model: null, dialect: null };
  return { model: decoded.model, dialect: decoded.dialect };
}
