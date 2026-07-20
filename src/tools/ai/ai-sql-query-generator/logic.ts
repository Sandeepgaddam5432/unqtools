/**
 * AI SQL Query Generator — pure logic.
 *
 * Schema parser (CREATE TABLE DDL or comma-separated table.column list).
 * Natural-language → SQL pattern matching (SELECT, WHERE, JOIN, GROUP BY,
 * ORDER BY, HAVING, LIMIT). Dialect selection (SQLite / PostgreSQL / MySQL).
 * SELECT-only safety guard. Syntax validator. Plain-English explainer.
 * Parameterization helper. Dialect converter. EXPLAIN hint.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Dialect = "sqlite" | "postgres" | "mysql";

export type SqlType =
  | "INTEGER" | "TEXT" | "VARCHAR" | "BOOLEAN" | "REAL" | "DECIMAL"
  | "DATE" | "DATETIME" | "TIMESTAMP" | "BLOB" | "JSON" | "UUID"
  | "SERIAL" | "BIGINT" | "FLOAT" | "NUMERIC" | "CHAR" | "UNKNOWN";

export interface ColumnDef {
  name: string;
  type: SqlType;
  nullable: boolean;
  primaryKey: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  raw?: string;            // original DDL line if parsed from CREATE TABLE
}

export interface ParsedSchema {
  tables: TableDef[];
  tableNames: string[];
  columnNames: string[];   // flat list across tables (deduped, lowercase)
  errors: string[];        // parse errors / warnings
}

export interface Intent {
  count: boolean;          // COUNT(*) or COUNT(col)
  distinct: boolean;       // SELECT DISTINCT
  aggregate: ("SUM" | "AVG" | "MIN" | "MAX" | "COUNT")[];
  join: boolean;
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL" | null;
  groupBy: boolean;
  orderBy: boolean;
  orderDirection: "ASC" | "DESC" | null;
  having: boolean;
  limit: number | null;
  filter: boolean;
}

export interface TableMatch {
  table: TableDef;
  matchedOn: string;       // keyword in the question that matched
}

export interface ColumnMatch {
  column: ColumnDef;
  table: string;
  matchedOn: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationResult {
  question: string;
  dialect: Dialect;
  sql: string;
  parameterized: string;
  parameters: string[];      // literal values extracted for parameterization
  explanation: string;
  intent: Intent;
  tables: TableMatch[];
  columns: ColumnMatch[];
  validation: ValidationResult;
  destructive: boolean;
  explainHint: string | null;
  generatedAt: number;
}

export interface HistoryEntry {
  ts: number;
  question: string;
  dialect: Dialect;
  sql: string;
  tableCount: number;
}

export interface ShareState {
  schema: string;
  question: string;
  dialect: Dialect;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-sql-query-generator:history";
export const HISTORY_MAX = 20;

export const DIALECT_LABELS: Record<Dialect, string> = {
  sqlite: "SQLite",
  postgres: "PostgreSQL",
  mysql: "MySQL",
};

export const ALL_DIALECTS: Dialect[] = ["sqlite", "postgres", "mysql"];

/** Destructive SQL keywords that the SELECT-only guard blocks. */
export const DESTRUCTIVE_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
  "GRANT", "REVOKE", "CREATE", "REPLACE", "MERGE", "VACUUM",
  "ATTACH", "DETACH", "PRAGMA",
];

/** Map of dialect-appropriate identifier quotes. */
export const IDENT_QUOTE: Record<Dialect, string> = {
  sqlite: '"',
  postgres: '"',
  mysql: "`",
};

export const SAMPLE_SCHEMA = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  country TEXT
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  stock INTEGER DEFAULT 0
);`;

export const SAMPLE_QUESTIONS: { label: string; question: string }[] = [
  { label: "Count users by country", question: "Count the number of users grouped by country" },
  { label: "Top 10 spenders", question: "Show the top 10 users by total order amount" },
  { label: "Pending orders", question: "List all orders with status pending, ordered by placed_at descending" },
  { label: "Products under $50", question: "Find products with price less than 50 in the electronics category" },
  { label: "Average order by status", question: "What is the average order total for each status" },
];

// ---------- Schema parsing ----------

/** Normalize a SQL type string into a known SqlType. */
export function normalizeType(raw: string): SqlType {
  const u = (raw || "").toUpperCase().trim();
  // Order matters: check more-specific patterns before broader ones.
  if (u.includes("BIGINT")) return "BIGINT";
  if (u.includes("INT")) return "INTEGER";
  if (u.includes("VARCHAR")) return "VARCHAR";
  if (u === "TEXT" || u === "CLOB" || u === "CHAR" || u.startsWith("CHAR(")) return "TEXT";
  if (u.includes("CHAR")) return "TEXT";
  if (u === "BOOL" || u === "BOOLEAN") return "BOOLEAN";
  if (u.includes("REAL") || u.includes("FLOAT") || u.includes("DOUBLE")) return "REAL";
  if (u.includes("DECIMAL") || u.includes("NUMERIC")) return "DECIMAL";
  if (u === "DATE") return "DATE";
  if (u.includes("DATETIME")) return "DATETIME";
  if (u.includes("TIMESTAMP")) return "TIMESTAMP";
  if (u.includes("BLOB")) return "BLOB";
  if (u === "JSON" || u === "JSONB") return "JSON";
  if (u === "UUID") return "UUID";
  if (u === "SERIAL" || u === "BIGSERIAL") return "SERIAL";
  return "UNKNOWN";
}

/** Parse a CREATE TABLE DDL string into a TableDef. */
export function parseCreateTable(ddl: string): TableDef | null {
  const text = (ddl || "").trim().replace(/;$/, "").replace(/\s+/g, " ");
  // Allow quoted identifiers that may contain spaces (e.g. "my table")
  const m = text.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\[][^`"\]]+[`"\]]|[\w.]+)\s*\((.+)\)$/i);
  if (!m) return null;
  const tableName = m[1].replace(/[`"\[\].]/g, "");
  const body = m[2];
  // Split on commas, respecting parentheses
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  const columns: ColumnDef[] = [];
  for (const p of parts) {
    const up = p.toUpperCase();
    // Skip table-level constraints
    if (up.startsWith("PRIMARY KEY") || up.startsWith("FOREIGN KEY")
      || up.startsWith("CONSTRAINT") || up.startsWith("UNIQUE") || up.startsWith("CHECK")) {
      continue;
    }
    // Column: name type [constraints...]
    const cm = p.match(/^([`"\[]?[\w]+[`"\]]?)\s+(\w+(?:\([^)]*\))?)(.*)$/);
    if (!cm) continue;
    const colName = cm[1].replace(/[`"\[\]]/g, "");
    const type = normalizeType(cm[2]);
    const rest = (cm[3] || "").toUpperCase();
    const primaryKey = /\bPRIMARY\s+KEY\b/.test(rest);
    const nullable = !/\bNOT\s+NULL\b/.test(rest) && !primaryKey;
    columns.push({ name: colName, type, nullable, primaryKey });
  }
  if (columns.length === 0) return null;
  return { name: tableName, columns, raw: ddl };
}

/** Parse a comma-separated list like "users.id, users.name, orders.total". */
export function parseColumnList(text: string): TableDef[] {
  const tokens = (text || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const tableMap = new Map<string, Map<string, ColumnDef>>();
  for (const t of tokens) {
    const m = t.match(/^([`"\[]?[\w]+[`"\]]?)[.]([`"\[]?[\w]+[`"\]]?)$/);
    if (!m) continue;
    const tbl = m[1].replace(/[`"\[\]]/g, "");
    const col = m[2].replace(/[`"\[\]]/g, "");
    if (!tableMap.has(tbl)) tableMap.set(tbl, new Map());
    const cols = tableMap.get(tbl)!;
    if (!cols.has(col)) {
      cols.set(col, { name: col, type: "UNKNOWN", nullable: true, primaryKey: col === "id" });
    }
  }
  const out: TableDef[] = [];
  for (const [name, cols] of tableMap) {
    out.push({ name, columns: Array.from(cols.values()) });
  }
  return out;
}

/** Parse a schema input — either CREATE TABLE DDL or a column list. */
export function parseSchema(text: string): ParsedSchema {
  const errors: string[] = [];
  if (!text || !text.trim()) {
    return { tables: [], tableNames: [], columnNames: [], errors };
  }
  const tables: TableDef[] = [];
  // Detect CREATE TABLE statements (split by semicolons that aren't inside parens)
  const statements: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      statements.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) statements.push(cur.trim());

  const hasCreate = statements.some((s) => /CREATE\s+TABLE/i.test(s));
  if (hasCreate) {
    for (const s of statements) {
      if (!/CREATE\s+TABLE/i.test(s)) continue;
      const t = parseCreateTable(s);
      if (t) tables.push(t);
      else errors.push(`Could not parse: ${s.slice(0, 80)}…`);
    }
  } else {
    // Try comma-separated column list
    const list = parseColumnList(text);
    if (list.length > 0) {
      tables.push(...list);
    } else {
      errors.push("No CREATE TABLE statements and no table.column list detected.");
    }
  }
  const tableNames = tables.map((t) => t.name);
  const colSet = new Set<string>();
  for (const t of tables) for (const c of t.columns) colSet.add(c.name.toLowerCase());
  return { tables, tableNames, columnNames: Array.from(colSet).sort(), errors };
}

// ---------- Question normalization ----------

/** Normalize a NL question: collapse whitespace, trim. */
export function normalizeQuestion(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ---------- Intent detection ----------

/** Detect SQL intent from a NL question. */
export function detectIntent(question: string): Intent {
  const q = (question || "").toLowerCase();
  const count = /\b(count|how many|number of|total number)\b/.test(q);
  const distinct = /\b(distinct|unique|different)\b/.test(q);
  const aggregate: ("SUM" | "AVG" | "MIN" | "MAX" | "COUNT")[] = [];
  if (/\b(sum|total of|sum of)\b/.test(q) && !count) aggregate.push("SUM");
  if (/\b(average|avg|mean)\b/.test(q)) aggregate.push("AVG");
  if (/\b(minimum|min|smallest|lowest|earliest)\b/.test(q)) aggregate.push("MIN");
  if (/\b(maximum|max|largest|highest|latest|most recent|top)\b/.test(q)) aggregate.push("MAX");
  if (count && !aggregate.includes("COUNT")) aggregate.push("COUNT");
  const join = /\b(join|with|across|and their|related to|associated with|per)\b/.test(q);
  let joinType: "INNER" | "LEFT" | "RIGHT" | "FULL" | null = null;
  if (/\bleft\s+join\b/.test(q) || /\ball\s+\w+\s+and their\b/.test(q)) joinType = "LEFT";
  else if (/\bright\s+join\b/.test(q)) joinType = "RIGHT";
  else if (/\bfull\s+outer\s+join\b/.test(q)) joinType = "FULL";
  else if (join) joinType = "INNER";
  const groupBy = /\b(group(ed)? by|per|for each|by (status|country|category|type))\b/.test(q)
    || /\bper\b/.test(q);
  const orderBy = /\b(order by|sort by|ordered by|sorted by|newest|oldest|latest|earliest|top \d+|top \d|alphabetical|alphabetically)\b/.test(q)
    || /\b(descending|ascending)\b/.test(q);
  let orderDirection: "ASC" | "DESC" | null = null;
  if (/\b(desc|descending|newest|latest|highest|largest|top)\b/.test(q)) orderDirection = "DESC";
  else if (/\b(asc|ascending|oldest|earliest|lowest|smallest|alphabetical|alphabetically)\b/.test(q)) orderDirection = "ASC";
  const having = /\b(having|where the (count|sum|average|total) is|at least|more than \d+)\b/.test(q);
  const limitMatch = q.match(/\b(?:top|first|limit)\s+(\d+)\b/) || q.match(/\btop\s+(\d+)\b/);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;
  const filter = /\b(where|with status|with|having|for|whose|filtered by|less than|greater than|equals|equal to|under|over|above|below|between)\b/.test(q);
  return {
    count, distinct, aggregate, join, joinType, groupBy, orderBy, orderDirection,
    having, limit, filter,
  };
}

// ---------- Table & column matching ----------

/** Find tables referenced in the question (by name, singular, or alias). */
export function findTables(question: string, schema: ParsedSchema): TableMatch[] {
  const q = " " + (question || "").toLowerCase() + " ";
  const out: TableMatch[] = [];
  const seen = new Set<string>();
  for (const t of schema.tables) {
    const lname = t.name.toLowerCase();
    // Match plural, singular, snake_case
    const variants = new Set<string>([lname]);
    if (lname.endsWith("s")) variants.add(lname.slice(0, -1));
    else variants.add(lname + "s");
    // Match the snake_case as space-separated (e.g. "order items" → "order_items")
    variants.add(lname.replace(/_/g, " "));
    for (const v of variants) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(q)) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          out.push({ table: t, matchedOn: v });
        }
        break;
      }
    }
  }
  return out;
}

/** Find columns referenced in the question. */
export function findColumns(question: string, schema: ParsedSchema): ColumnMatch[] {
  const q = " " + (question || "").toLowerCase() + " ";
  const out: ColumnMatch[] = [];
  const seen = new Set<string>();
  for (const t of schema.tables) {
    for (const c of t.columns) {
      const lname = c.name.toLowerCase();
      const re = new RegExp(`\\b${lname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(q)) {
        const key = `${t.name}.${c.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ column: c, table: t.name, matchedOn: lname });
        }
      }
    }
  }
  return out;
}

// ---------- Dialect-aware identifier quoting ----------

/** Quote an identifier for the chosen dialect. */
export function quoteIdent(name: string, dialect: Dialect): string {
  const q = IDENT_QUOTE[dialect];
  // Don't quote simple lowercase identifiers in SQLite/Postgres
  if (/^[a-z_][a-z0-9_]*$/.test(name) && dialect !== "mysql") return name;
  return `${q}${name.replace(new RegExp(q, "g"), q + q)}${q}`;
}

// ---------- SQL generation ----------

/** Detect literal values in a question (strings in quotes, numbers). */
export function extractLiterals(question: string): { value: string; kind: "string" | "number" }[] {
  const out: { value: string; kind: "string" | "number" }[] = [];
  // Quoted strings: 'pending' or "electronics"
  const strRe = /'([^']{1,100})'/g;
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(question)) !== null) {
    out.push({ value: m[1], kind: "string" });
  }
  // Category/category-name pattern: "in the X category" or "with status X"
  const catRe = /\b(?:in the|in a|with status|of status|in)\s+([a-zA-Z][a-zA-Z0-9\-_ ]{0,40}?)(?:\s+category|\s+status)?\b/g;
  while ((m = catRe.exec(question)) !== null) {
    const v = m[1].trim().toLowerCase();
    // Skip if it's a known SQL keyword or matches a table/column name
    if (["the", "a", "an", "all", "each", "every"].includes(v)) continue;
    if (!out.some((o) => o.value === v)) {
      out.push({ value: v, kind: "string" });
    }
  }
  // Comparison numbers: "less than 50", "over 100", ">= 10"
  const numRe = /\b(?:less than|greater than|under|over|above|below|more than|at least|at most|>=|<=|>|<|=)\s+(\d+(?:\.\d+)?)\b/gi;
  while ((m = numRe.exec(question)) !== null) {
    out.push({ value: m[1], kind: "number" });
  }
  return out;
}

/** Build a WHERE clause from the question + matched columns. */
export function buildWhereClause(
  question: string,
  matches: ColumnMatch[],
  dialect: Dialect,
): string | null {
  if (matches.length === 0) return null;
  const q = (question || "").toLowerCase();
  const conds: string[] = [];
  const literals = extractLiterals(question);
  let literalIdx = 0;
  for (const cm of matches) {
    const col = quoteIdent(cm.column.name, dialect);
    // Equality with a literal (string)
    const lit = literals[literalIdx];
    if (lit && lit.kind === "string") {
      conds.push(`${col} = '${lit.value.replace(/'/g, "''")}'`);
      literalIdx++;
      continue;
    }
    // Numeric comparison
    if (lit && lit.kind === "number") {
      const op = /less than|under|below|<|at most/.test(q) ? "<"
        : /greater than|over|above|>|at least/.test(q) ? ">"
        : "=";
      conds.push(`${col} ${op} ${lit.value}`);
      literalIdx++;
      continue;
    }
    // Boolean status
    if (cm.column.type === "BOOLEAN") {
      if (/\b(is|with|has|where)\b/.test(q)) {
        conds.push(`${col} = TRUE`);
      }
    }
    // LIKE for name-like columns
    if ((cm.column.name.toLowerCase().includes("name") || cm.column.name.toLowerCase().includes("email"))
        && /\b(named|called|with name|whose name)\b/.test(q)) {
      conds.push(`${col} LIKE '%${literals[literalIdx]?.value ?? ""}%'`);
      literalIdx++;
    }
  }
  if (conds.length === 0) return null;
  return conds.join(" AND ");
}

/** Build a complete SELECT query from the analysis. */
export function buildSelectQuery(
  question: string,
  schema: ParsedSchema,
  dialect: Dialect,
): {
  sql: string;
  tables: TableMatch[];
  columns: ColumnMatch[];
  intent: Intent;
  where: string | null;
} {
  const intent = detectIntent(question);
  const tables = findTables(question, schema);
  const columns = findColumns(question, schema);
  const mainTable = tables[0] || (schema.tables[0] ? { table: schema.tables[0], matchedOn: "" } : null);
  if (!mainTable) {
    return { sql: "-- no tables found in schema", tables, columns, intent, where: null };
  }
  const q = IDENT_QUOTE[dialect];
  const tbl = quoteIdent(mainTable.table.name, dialect);

  // SELECT clause
  const selectParts: string[] = [];
  if (intent.count) {
    if (intent.distinct) selectParts.push(`COUNT(DISTINCT ${quoteIdent(columns[0]?.column.name || "id", dialect)})`);
    else if (intent.groupBy && columns.length > 0) {
      selectParts.push(quoteIdent(columns[0].column.name, dialect));
      selectParts.push(`COUNT(*)`);
    } else {
      selectParts.push(`COUNT(*)`);
    }
  } else if (intent.aggregate.length > 0 && columns.length > 0) {
    // Pick the first non-id numeric column for aggregation
    const aggCol = columns.find((c) => c.column.type === "DECIMAL" || c.column.type === "REAL" || c.column.type === "INTEGER")
      || columns[0];
    for (const agg of intent.aggregate) {
      if (agg === "COUNT") continue;
      selectParts.push(`${agg}(${quoteIdent(aggCol.column.name, dialect)})`);
    }
    if (intent.groupBy) {
      // Add the group-by column first
      const groupCol = columns.find((c) => c.column.type === "TEXT") || columns[0];
      selectParts.unshift(quoteIdent(groupCol.column.name, dialect));
    }
  } else if (columns.length > 0) {
    // Select matched columns; otherwise *
    if (intent.distinct) {
      selectParts.push(`DISTINCT ${columns.map((c) => quoteIdent(c.column.name, dialect)).join(", ")}`);
    } else {
      selectParts.push(columns.map((c) => quoteIdent(c.column.name, dialect)).join(", "));
    }
  } else {
    selectParts.push("*");
  }
  const selectClause = `SELECT ${selectParts.join(", ")}`;

  // FROM + JOIN
  let fromClause = `FROM ${tbl}`;
  const joinTables = tables.slice(1);
  if (intent.join && joinTables.length > 0) {
    for (const jt of joinTables) {
      const jtName = quoteIdent(jt.table.name, dialect);
      // Find a join key: any column with same name across both tables
      const joinCol = mainTable.table.columns.find((c1) =>
        jt.table.columns.some((c2) => c2.name.toLowerCase() === c1.name.toLowerCase()),
      );
      const joinKeyName = joinCol ? quoteIdent(joinCol.name, dialect)
        : quoteIdent(`${mainTable.table.name.replace(/s$/, "")}_id`, dialect);
      const jtJoinCol = jt.table.columns.find((c) => c.name.toLowerCase() === joinCol?.name.toLowerCase())
        ? quoteIdent(joinCol!.name, dialect)
        : joinKeyName;
      fromClause += `\n${intent.joinType || "INNER"} JOIN ${jtName} ON ${tbl}.${joinKeyName} = ${jtName}.${jtJoinCol}`;
    }
  }

  // WHERE
  const where = buildWhereClause(question, columns, dialect);

  // GROUP BY
  let groupByClause = "";
  if (intent.groupBy && columns.length > 0) {
    const groupCol = columns.find((c) => c.column.type === "TEXT") || columns[0];
    groupByClause = `\nGROUP BY ${quoteIdent(groupCol.column.name, dialect)}`;
  }

  // HAVING
  let havingClause = "";
  if (intent.having && intent.aggregate.length > 0) {
    const agg = intent.aggregate[0];
    const numMatch = question.match(/\b(?:at least|more than|greater than)\s+(\d+)\b/i);
    if (numMatch) {
      havingClause = `\nHAVING ${agg}(${quoteIdent(columns[0]?.column.name || "*", dialect)}) > ${numMatch[1]}`;
    }
  }

  // ORDER BY
  let orderByClause = "";
  if (intent.orderBy) {
    const orderCol = columns.find((c) => /at|date|time|id/.test(c.column.name.toLowerCase()))
      || columns[0];
    if (orderCol) {
      const dir = intent.orderDirection || "ASC";
      orderByClause = `\nORDER BY ${quoteIdent(orderCol.column.name, dialect)} ${dir}`;
    }
  }

  // LIMIT
  let limitClause = "";
  if (intent.limit !== null && intent.limit > 0) {
    limitClause = `\nLIMIT ${intent.limit}`;
  } else if (intent.orderDirection === "DESC" && intent.aggregate.length > 0) {
    // Default limit for top-N style queries
    limitClause = `\nLIMIT 10`;
  }

  const sql = [
    selectClause,
    fromClause,
    where ? `WHERE ${where}` : null,
    groupByClause.trim() || null,
    havingClause.trim() || null,
    orderByClause.trim() || null,
    limitClause.trim() || null,
  ].filter((s) => s !== null && s !== "").join("\n") + ";";

  return { sql, tables, columns, intent, where };
}

// ---------- Validation ----------

/** Check whether a SQL string contains destructive keywords (SELECT-only guard). */
export function isDestructive(sql: string): boolean {
  const upper = (sql || "").toUpperCase();
  // Strip string literals before scanning
  const stripped = upper.replace(/'[^']*'/g, "''");
  for (const kw of DESTRUCTIVE_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(stripped)) return true;
  }
  return false;
}

/** Validate basic SQL syntax. Returns ok + error/warning arrays. */
export function validateSql(sql: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmed = (sql || "").trim();
  if (!trimmed) {
    errors.push("SQL is empty.");
    return { ok: false, errors, warnings };
  }
  if (isDestructive(trimmed)) {
    errors.push("Destructive keyword detected — only SELECT statements are allowed.");
  }
  if (!/^SELECT\b/i.test(trimmed)) {
    errors.push("Query must start with SELECT.");
  }
  // Balanced parentheses
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth < 0) {
      errors.push("Unbalanced parentheses — extra ')'.");
      break;
    }
  }
  if (depth > 0) errors.push("Unbalanced parentheses — missing ')'.");
  // Balanced single quotes
  const quoteCount = (trimmed.match(/'/g) || []).length;
  if (quoteCount % 2 !== 0) warnings.push("Odd number of single quotes — a string literal may be unclosed.");
  // FROM clause presence
  if (!/\bFROM\b/i.test(trimmed) && !/^SELECT\s+COUNT\(\*\)/i.test(trimmed)) {
    warnings.push("No FROM clause detected — most SELECT queries need a table.");
  }
  // Semicolon
  if (!trimmed.endsWith(";")) warnings.push("Query should end with a semicolon.");
  return { ok: errors.length === 0, errors, warnings };
}

// ---------- Parameterization ----------

/** Convert literal values in a SQL string to positional placeholders ($1, $2 or ?). */
export function parameterize(sql: string, dialect: Dialect): { sql: string; parameters: string[] } {
  const params: string[] = [];
  // Match string literals and numeric literals after comparison operators
  let out = sql;
  // Replace string literals
  out = out.replace(/'([^']*)'/g, (_match, val) => {
    params.push(val);
    return dialect === "postgres" ? `$${params.length}` : "?";
  });
  // Replace numeric literals after operators
  out = out.replace(/(=|<|>|<=|>=|!=|<>|\bBETWEEN\b)\s+(\d+(?:\.\d+)?)/gi, (match, op, num) => {
    params.push(num);
    return `${op} ${dialect === "postgres" ? `$${params.length}` : "?"}`;
  });
  return { sql: out, parameters: params };
}

// ---------- Dialect conversion ----------

/** Re-render a SQL string from one dialect to another by swapping identifier quotes. */
export function convertDialect(sql: string, from: Dialect, to: Dialect): string {
  if (from === to) return sql;
  const fromQuote = IDENT_QUOTE[from];
  const toQuote = IDENT_QUOTE[to];
  if (fromQuote === toQuote) return sql;
  // Swap identifier quotes (naive — assumes balanced quoting)
  return sql.replace(new RegExp(`\\${fromQuote}([^${fromQuote}]+)\\${fromQuote}`, "g"), `${toQuote}$1${toQuote}`);
}

// ---------- Explanation ----------

/** Generate a plain-English explanation of the generated SQL. */
export function explainSql(result: { sql: string; intent: Intent; tables: TableMatch[]; columns: ColumnMatch[] }): string {
  const parts: string[] = [];
  if (result.intent.count) {
    parts.push("Counts rows");
    if (result.intent.groupBy) parts.push(`grouped by ${result.columns[0]?.column.name || "column"}`);
  } else if (result.intent.aggregate.length > 0) {
    parts.push(`Computes ${result.intent.aggregate.join(", ")}`);
    if (result.intent.groupBy) parts.push(`per ${result.columns[0]?.column.name || "group"}`);
  } else {
    parts.push(`Selects ${result.columns.length > 0 ? result.columns.map((c) => c.column.name).join(", ") : "all columns"}`);
  }
  parts.push(`from the ${result.tables[0]?.table.name || "(unknown)"} table`);
  if (result.intent.join && result.tables.length > 1) {
    parts.push(`joined with ${result.tables.slice(1).map((t) => t.table.name).join(", ")}`);
  }
  if (result.intent.filter) parts.push("with a WHERE filter");
  if (result.intent.orderBy) parts.push(`sorted ${result.intent.orderDirection || "ascending"}`);
  if (result.intent.limit) parts.push(`limited to ${result.intent.limit} rows`);
  return parts.join(" ") + ".";
}

// ---------- Full generation pipeline ----------

/** Main entry point: generate SQL from a question + schema + dialect. */
export function generateSql(question: string, schema: ParsedSchema, dialect: Dialect): GenerationResult {
  const clean = normalizeQuestion(question);
  const built = buildSelectQuery(clean, schema, dialect);
  const validation = validateSql(built.sql);
  const { sql: parameterized, parameters } = parameterize(built.sql, dialect);
  const explanation = explainSql({
    sql: built.sql,
    intent: built.intent,
    tables: built.tables,
    columns: built.columns,
  });
  // EXPLAIN hint: suggest EXPLAIN QUERY PLAN for SQLite, EXPLAIN ANALYZE for Postgres
  let explainHint: string | null = null;
  if (dialect === "sqlite") explainHint = "Prefix with `EXPLAIN QUERY PLAN` to inspect the scan strategy.";
  else if (dialect === "postgres") explainHint = "Prefix with `EXPLAIN ANALYZE` to see actual costs and timings.";
  else if (dialect === "mysql") explainHint = "Prefix with `EXPLAIN` to inspect the join plan.";
  return {
    question: clean,
    dialect,
    sql: built.sql,
    parameterized,
    parameters,
    explanation,
    intent: built.intent,
    tables: built.tables,
    columns: built.columns,
    validation,
    destructive: isDestructive(built.sql),
    explainHint,
    generatedAt: Date.now(),
  };
}

// ---------- Rendering ----------

/** Render a generation result as plain text. */
export function renderText(r: GenerationResult): string {
  const lines: string[] = [];
  lines.push(`Question: ${r.question}`);
  lines.push(`Dialect: ${DIALECT_LABELS[r.dialect]}`);
  lines.push("");
  lines.push("SQL:");
  lines.push(r.sql);
  lines.push("");
  lines.push(`Explanation: ${r.explanation}`);
  lines.push("");
  if (r.parameters.length > 0) {
    lines.push("Parameterized:");
    lines.push(r.parameterized);
    lines.push(`Parameters: ${r.parameters.map((p, i) => `${i + 1}=${p}`).join(", ")}`);
    lines.push("");
  }
  if (r.validation.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of r.validation.warnings) lines.push(`  - ${w}`);
  }
  if (r.validation.errors.length > 0) {
    lines.push("Errors:");
    for (const e of r.validation.errors) lines.push(`  - ${e}`);
  }
  if (r.explainHint) {
    lines.push("");
    lines.push(`Tip: ${r.explainHint}`);
  }
  return lines.join("\n");
}

/** Render a generation result as markdown. */
export function renderMarkdown(r: GenerationResult): string {
  const lines: string[] = [];
  lines.push(`### SQL — ${DIALECT_LABELS[r.dialect]}`);
  lines.push("");
  lines.push(`> ${r.question}`);
  lines.push("");
  lines.push("```sql");
  lines.push(r.sql);
  lines.push("```");
  lines.push("");
  lines.push(`**Explanation:** ${r.explanation}`);
  if (r.parameters.length > 0) {
    lines.push("");
    lines.push("**Parameterized:**");
    lines.push("```sql");
    lines.push(r.parameterized);
    lines.push("```");
    lines.push("");
    lines.push(`**Parameters:** ${r.parameters.map((p, i) => `$${i + 1} = ${p}`).join(", ")}`);
  }
  if (r.validation.warnings.length > 0) {
    lines.push("");
    lines.push("**Warnings:**");
    for (const w of r.validation.warnings) lines.push(`- ${w}`);
  }
  if (r.explainHint) {
    lines.push("");
    lines.push(`> 💡 ${r.explainHint}`);
  }
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(schema: string, question: string, dialect: Dialect): string {
  const params = new URLSearchParams();
  if (schema) params.set("schema", schema);
  if (question) params.set("q", question);
  params.set("dialect", dialect);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { schema: "", question: "", dialect: "sqlite" };
  const params = new URLSearchParams(clean);
  const dialect = (params.get("dialect") as Dialect) || "sqlite";
  return {
    schema: params.get("schema") ?? "",
    question: params.get("q") ?? "",
    dialect: ALL_DIALECTS.includes(dialect) ? dialect : "sqlite",
  };
}

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build the prompt to send to an LLM for a richer SQL query (BYO key). */
export function buildLlmPrompt(question: string, schema: ParsedSchema, dialect: Dialect): string {
  const schemaText = schema.tables.map((t) => {
    const cols = t.columns.map((c) => `  ${c.name} ${c.type}${c.primaryKey ? " PRIMARY KEY" : c.nullable ? "" : " NOT NULL"}`).join(",\n");
    return `CREATE TABLE ${t.name} (\n${cols}\n);`;
  }).join("\n\n");
  return [
    "You are an expert SQL engineer.",
    `Target dialect: ${DIALECT_LABELS[dialect]}.`,
    "Given the following schema, write a single SELECT query (no INSERT/UPDATE/DELETE) that answers the question.",
    "Schema:",
    schemaText,
    "",
    `Question: ${question}`,
    "",
    "Return ONLY JSON: {\"sql\":\"...\",\"explanation\":\"...\"}. No commentary, no markdown fences.",
    "Always end the SQL with a semicolon. Use proper identifier quoting for the dialect.",
  ].join("\n");
}

/** Parse an LLM-returned JSON object. */
export function parseLlmResult(llmText: string): { sql: string; explanation: string } | null {
  try {
    const obj = JSON.parse(llmText);
    if (typeof obj !== "object" || obj === null) return null;
    const sql = typeof obj.sql === "string" ? obj.sql : "";
    const explanation = typeof obj.explanation === "string" ? obj.explanation : "";
    if (!sql) return null;
    return { sql, explanation };
  } catch {
    return null;
  }
}
