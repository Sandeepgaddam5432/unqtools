/**
 * SQL Index Advisor — pure logic.
 *
 * Parses a SQL query and (optionally) table DDL, then recommends indexes with
 * CREATE INDEX statements. Applies equality-before-range column ordering,
 * detects redundant/overlapping existing indexes, and warns about edge cases
 * (leading-wildcard LIKE, functions on columns, low-selectivity columns,
 * write amplification).
 *
 * 100% client-side — no DB required. Heuristic, explainable, deterministic.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PredicateType =
  | "equality"
  | "range"
  | "in"
  | "like"
  | "function"
  | "or";

export interface ColumnRef {
  /** Table alias or name (without schema). */
  table?: string;
  column: string;
}

export interface Predicate {
  type: PredicateType;
  column: ColumnRef;
  operator?: string;
  value?: string;
  isFunction?: boolean;
  isLeadingWildcard?: boolean;
  raw?: string;
}

export interface TableRef {
  schema?: string;
  name: string;
  alias?: string;
}

export interface JoinInfo {
  type: string; // INNER, LEFT, RIGHT, FULL, CROSS
  table: TableRef;
  onPredicates: Predicate[];
}

export interface OrderByColumn {
  column: ColumnRef;
  direction: "ASC" | "DESC";
}

export interface QueryInfo {
  selectColumns: ColumnRef[];
  fromTables: TableRef[];
  joins: JoinInfo[];
  wherePredicates: Predicate[];
  orderByColumns: OrderByColumn[];
  groupByColumns: ColumnRef[];
  warnings: string[];
}

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableInfo {
  schema?: string;
  name: string;
  columns: TableColumn[];
}

export interface ExistingIndex {
  name: string;
  schema?: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPartial: boolean;
  whereClause?: string;
  includeColumns: string[];
  isPrimary: boolean;
}

export type Confidence = "high" | "medium" | "low";

export interface IndexRecommendation {
  id: string;
  table: string;
  schema?: string;
  columns: string[];
  equalityColumns: string[];
  rangeColumns: string[];
  sortColumns: string[];
  includeColumns: string[];
  isExpression: boolean;
  expression?: string;
  reasoning: string;
  createIndexSql: string;
  caveats: string[];
  confidence: Confidence;
  coversExisting?: ExistingIndex;
}

export interface AdviceStats {
  tables: number;
  predicates: number;
  recommendations: number;
  highConfidence: number;
  redundantDetected: number;
  warnings: number;
}

export interface AdviceResult {
  query: QueryInfo;
  ddl: { tables: TableInfo[]; indexes: ExistingIndex[] };
  recommendations: IndexRecommendation[];
  warnings: string[];
  redundantExisting: ExistingIndex[];
  stats: AdviceStats;
}

export type AdviceOutcome =
  | { ok: true; result: AdviceResult }
  | { ok: false; error: string };

export interface ShareOptions {
  includeCaveats: boolean;
  recommendCovering: boolean;
  dialect: "ansi" | "postgres" | "mysql" | "sqlserver";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SAMPLE_QUERY = `SELECT u.id, u.email, o.id AS order_id, o.total
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE u.status = 'active'
  AND u.created_at > '2023-01-01'
  AND o.status IN ('paid', 'shipped')
ORDER BY o.created_at DESC`;

export const SAMPLE_DDL = `CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email VARCHAR(255),
  status VARCHAR(20),
  created_at TIMESTAMP
);
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT,
  status VARCHAR(20),
  total DECIMAL(10,2),
  created_at TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);`;

export const HOWTO_USE = [
  "1. Paste your SQL query (SELECT, UPDATE, DELETE — anything with a WHERE/JOIN/ORDER BY/GROUP BY).",
  "2. Optionally paste your table DDL (CREATE TABLE + CREATE INDEX statements).",
  "3. The advisor parses predicates, groups them per table, and orders columns equality-first then range then sort.",
  "4. Existing indexes are checked for redundancy — recommendations that overlap are flagged.",
  "5. Review each recommendation's reasoning, caveats, and CREATE INDEX statement.",
  "6. Always validate with EXPLAIN ANALYZE on real data (use the EXPLAIN Plan Visualizer, #271).",
];

export const LOW_SELECTIVITY_TYPES = new Set([
  "boolean", "bool", "tinyint(1)",
]);

export const LOW_SELECTIVITY_COLUMN_NAMES = new Set([
  "is_active", "is_published", "is_deleted", "active", "deleted",
  "gender", "status", "type", "kind", "enabled", "disabled",
]);

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  includeCaveats: true,
  recommendCovering: true,
  dialect: "ansi",
};

// ---------------------------------------------------------------------------
// SQL tokenizer (lightweight)
// ---------------------------------------------------------------------------

export interface Token {
  type: "word" | "punct" | "string" | "number" | "whitespace" | "comment" | "eof";
  value: string;
}

/** Tokenize a SQL string into words, punctuation, string literals, numbers, comments. */
export function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Whitespace
    if (/\s/.test(ch)) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: "whitespace", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // Line comment (-- or #)
    if (ch === "-" && sql[i + 1] === "-") {
      let j = i + 2;
      while (j < sql.length && sql[j] !== "\n") j++;
      tokens.push({ type: "comment", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "#") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== "\n") j++;
      tokens.push({ type: "comment", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // Block comment /* */
    if (ch === "/" && sql[i + 1] === "*") {
      let j = i + 2;
      while (j < sql.length && !(sql[j] === "*" && sql[j + 1] === "/")) j++;
      j = Math.min(sql.length, j + 2);
      tokens.push({ type: "comment", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // String literal (single-quote, with '' escapes)
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: "string", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // Double-quoted identifier
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j++;
      j = Math.min(sql.length, j + 1);
      tokens.push({ type: "word", value: sql.slice(i + 1, j - 1) });
      i = j;
      continue;
    }
    // Backtick identifier
    if (ch === "`") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== "`") j++;
      j = Math.min(sql.length, j + 1);
      tokens.push({ type: "word", value: sql.slice(i + 1, j - 1) });
      i = j;
      continue;
    }
    // Bracket identifier [name]
    if (ch === "[") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== "]") j++;
      tokens.push({ type: "word", value: sql.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    // Number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(sql[i + 1] || ""))) {
      let j = i;
      while (j < sql.length && /[0-9.eE+\-]/.test(sql[j])) j++;
      tokens.push({ type: "number", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // Word (identifier or keyword)
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j])) j++;
      tokens.push({ type: "word", value: sql.slice(i, j) });
      i = j;
      continue;
    }
    // Punctuation
    tokens.push({ type: "punct", value: ch });
    i++;
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

/** Strip whitespace + comments; return only significant tokens. */
export function stripTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== "whitespace" && t.type !== "comment");
}

// ---------------------------------------------------------------------------
// Clause splitter
// ---------------------------------------------------------------------------

export interface Clauses {
  select: string;
  from: string;
  where: string;
  groupBy: string;
  having: string;
  orderBy: string;
  limit: string;
  joins: { type: string; table: string; on: string }[];
}

/** Split a SQL statement into clause segments. */
export function splitClauses(sql: string): Clauses {
  const tokens = stripTokens(tokenizeSql(sql));
  const upper = tokens.map((t) => t.type === "word" ? t.value.toUpperCase() : t.value);
  const out: Clauses = {
    select: "", from: "", where: "", groupBy: "", having: "", orderBy: "", limit: "",
    joins: [],
  };
  let i = 0;
  const readUntil = (stopWords: string[]): { text: string; stopIdx: number } => {
    let j = i;
    const parts: string[] = [];
    while (j < tokens.length && tokens[j].type !== "eof") {
      const v = upper[j];
      if (stopWords.includes(v)) break;
      parts.push(tokens[j].value);
      j++;
    }
    return { text: normalizeClauseText(parts.join(" ")), stopIdx: j };
  };
  while (i < tokens.length && tokens[i].type !== "eof") {
    const v = upper[i];
    if (v === "SELECT") {
      i++;
      const r = readUntil(["FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT", "EOF"]);
      out.select = r.text;
      i = r.stopIdx;
    } else if (v === "FROM") {
      i++;
      const r = readUntil(["WHERE", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "JOIN", "GROUP", "HAVING", "ORDER", "LIMIT", "ON", "EOF"]);
      out.from = r.text;
      i = r.stopIdx;
    } else if (v === "WHERE") {
      i++;
      const r = readUntil(["GROUP", "HAVING", "ORDER", "LIMIT", "EOF"]);
      out.where = r.text;
      i = r.stopIdx;
    } else if (v === "GROUP") {
      i++;
      if (upper[i] === "BY") i++;
      const r = readUntil(["HAVING", "ORDER", "LIMIT", "EOF"]);
      out.groupBy = r.text;
      i = r.stopIdx;
    } else if (v === "HAVING") {
      i++;
      const r = readUntil(["ORDER", "LIMIT", "EOF"]);
      out.having = r.text;
      i = r.stopIdx;
    } else if (v === "ORDER") {
      i++;
      if (upper[i] === "BY") i++;
      const r = readUntil(["LIMIT", "EOF"]);
      out.orderBy = r.text;
      i = r.stopIdx;
    } else if (v === "LIMIT") {
      i++;
      const r = readUntil(["EOF"]);
      out.limit = r.text;
      i = r.stopIdx;
    } else if (["INNER", "LEFT", "RIGHT", "FULL", "CROSS", "JOIN"].includes(v)) {
      // Read join type
      let jtype = "";
      while (["INNER", "LEFT", "RIGHT", "FULL", "CROSS", "OUTER", "JOIN"].includes(upper[i])) {
        jtype += (jtype ? " " : "") + upper[i];
        i++;
      }
      // Read table reference until ON or next clause
      const r = readUntil(["ON", "WHERE", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "JOIN", "GROUP", "HAVING", "ORDER", "LIMIT", "EOF"]);
      const tableText = r.text;
      i = r.stopIdx;
      let onText = "";
      if (upper[i] === "ON") {
        i++;
        const r2 = readUntil(["WHERE", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "JOIN", "GROUP", "HAVING", "ORDER", "LIMIT", "EOF"]);
        onText = r2.text;
        i = r2.stopIdx;
      }
      out.joins.push({ type: jtype, table: tableText, on: onText });
    } else {
      i++;
    }
  }
  return out;
}

function normalizeClauseText(s: string): string {
  // Collapse spaces around dots so qualified identifiers like `u . id` become `u.id`.
  // Normalize commas so `a , b` becomes `a, b`.
  return s
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ") ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Predicate parser
// ---------------------------------------------------------------------------

/** Parse a table reference like "users u" or "public.users AS u". */
export function parseTableRef(s: string): TableRef {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: "" };
  let schema: string | undefined;
  let name = parts[0];
  let alias: string | undefined;
  if (name.includes(".")) {
    const [s2, n2] = name.split(".");
    schema = s2;
    name = n2;
  }
  // Handle "AS alias" or implicit alias
  if (parts.length >= 2) {
    if (parts[1].toUpperCase() === "AS" && parts[2]) {
      alias = parts[2];
    } else if (parts[1].toUpperCase() !== "AS") {
      alias = parts[1];
    }
  }
  return { schema, name, alias };
}

/** Parse a column reference like "u.id" or "email". */
export function parseColumnRef(s: string): ColumnRef {
  const trimmed = s.trim();
  if (trimmed.includes(".")) {
    const [t, c] = trimmed.split(".");
    return { table: t, column: c };
  }
  return { column: trimmed };
}

const OPERATORS = ["<=", ">=", "!=", "<>", "=", "<", ">", "LIKE", "IN", "IS", "BETWEEN"];

/** Parse predicates from a WHERE/ON clause string. */
export function parsePredicates(clause: string): Predicate[] {
  if (!clause.trim()) return [];
  const out: Predicate[] = [];
  // Split on AND, but treat `BETWEEN X AND Y` as atomic.
  const andParts = splitOnAndRespectingBetween(clause);
  for (const part of andParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // OR inside? Wrap as OR type.
    const orParts = splitTopLevel(trimmed, /\bOR\b/i);
    if (orParts.length > 1) {
      const inner = orParts.map((p) => parsePredicates(p)).flat();
      // Take the first column as representative
      const first = inner[0];
      if (first) {
        out.push({
          type: "or",
          column: first.column,
          raw: trimmed,
        });
      }
      continue;
    }
    const p = parseSinglePredicate(trimmed);
    if (p) out.push(p);
  }
  return out;
}

/** Split a clause on AND, but treat `BETWEEN X AND Y` as atomic. */
export function splitOnAndRespectingBetween(clause: string): string[] {
  const tokens = stripTokens(tokenizeSql(clause));
  const out: string[] = [];
  let current: string[] = [];
  let depth = 0;
  let betweenActive = false;
  for (const t of tokens) {
    const v = t.value.toUpperCase();
    if (t.value === "(") depth++;
    else if (t.value === ")") depth--;
    if (depth === 0 && v === "AND" && !betweenActive) {
      out.push(normalizeClauseText(current.join(" ")));
      current = [];
      continue;
    }
    if (v === "BETWEEN") betweenActive = true;
    else if (betweenActive && v === "AND") betweenActive = false;
    current.push(t.value);
  }
  if (current.length) out.push(normalizeClauseText(current.join(" ")));
  return out;
}

/** Strip a single pair of outer parens only if they wrap the entire string. */
function stripOuterParens(s: string): string {
  let t = s.trim();
  while (t.startsWith("(") && balancedClosingParenIndex(t) === t.length - 1) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function balancedClosingParenIndex(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseSinglePredicate(s: string): Predicate | null {
  const trimmed = stripOuterParens(s.trim());
  // Detect function call: FUNC(col) OP value
  const funcMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]+)\)\s*(<>|!=|<=|>=|=|<|>|LIKE|IN|IS|BETWEEN)\s*(.+)$/i.exec(trimmed);
  if (funcMatch) {
    const funcName = funcMatch[1];
    const arg = funcMatch[2].trim();
    const op = funcMatch[3].toUpperCase();
    const val = funcMatch[4].trim();
    const isLike = op === "LIKE";
    const isLeadingWildcard = isLike && /^'[%]/.test(val);
    return {
      type: isLike ? "like" : op === "IN" ? "in" : op === "BETWEEN" ? "range" : "function",
      column: parseColumnRef(arg),
      operator: op,
      value: val,
      isFunction: true,
      isLeadingWildcard,
      raw: trimmed,
    };
  }
  // Detect LIKE
  const likeMatch = /^(.+?)\s+LIKE\s+(.+)$/i.exec(trimmed);
  if (likeMatch) {
    const col = likeMatch[1].trim();
    const val = likeMatch[2].trim();
    const isLeadingWildcard = /^'[%]/.test(val);
    return {
      type: "like",
      column: parseColumnRef(col),
      operator: "LIKE",
      value: val,
      isLeadingWildcard,
      raw: trimmed,
    };
  }
  // Detect IN (...)
  const inMatch = /^(.+?)\s+IN\s*\((.+)\)$/i.exec(trimmed);
  if (inMatch) {
    const col = inMatch[1].trim();
    return {
      type: "in",
      column: parseColumnRef(col),
      operator: "IN",
      value: inMatch[2].trim(),
      raw: trimmed,
    };
  }
  // Detect BETWEEN
  const betweenMatch = /^(.+?)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i.exec(trimmed);
  if (betweenMatch) {
    const col = betweenMatch[1].trim();
    return {
      type: "range",
      column: parseColumnRef(col),
      operator: "BETWEEN",
      value: `${betweenMatch[2].trim()} AND ${betweenMatch[3].trim()}`,
      raw: trimmed,
    };
  }
  // Detect IS NULL / IS NOT NULL
  const isMatch = /^(.+?)\s+IS\s+(NOT\s+)?NULL$/i.exec(trimmed);
  if (isMatch) {
    const col = isMatch[1].trim();
    return {
      type: "equality", // IS NULL is an equality on the null bit
      column: parseColumnRef(col),
      operator: "IS NULL",
      raw: trimmed,
    };
  }
  // Detect comparison operators
  for (const op of ["<=", ">=", "!=", "<>", "=", "<", ">"]) {
    const re = new RegExp(`^(.+?)\\s*${op.replace(/[<>=!]/g, (m) => `\\${m}`)}\\s*(.+)$`);
    const m = re.exec(trimmed);
    if (m) {
      const col = m[1].trim();
      const val = m[2].trim();
      // Make sure col is a column reference (contains letter, not a string/number)
      if (!/^[A-Za-z_]/.test(col)) continue;
      // Equality
      if (op === "=" || op === "!=" || op === "<>") {
        return {
          type: "equality",
          column: parseColumnRef(col),
          operator: op,
          value: val,
          raw: trimmed,
        };
      }
      // Range
      return {
        type: "range",
        column: parseColumnRef(col),
        operator: op,
        value: val,
        raw: trimmed,
      };
    }
  }
  return null;
}

/** Split string at top-level occurrences of a regex (ignoring parentheses/quotes). */
export function splitTopLevel(s: string, regex: RegExp): string[] {
  const sticky = new RegExp(regex.source, regex.flags.includes("y") ? regex.flags : regex.flags + "y");
  const out: string[] = [];
  let depth = 0;
  let inStr: false | "'" | '"' = false;
  let current = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (inStr) {
      current += ch;
      if (ch === inStr) {
        if (s[i + 1] === inStr) { current += s[i + 1]; i += 2; continue; }
        inStr = false;
      }
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; current += ch; i++; continue; }
    if (ch === "(") { depth++; current += ch; i++; continue; }
    if (ch === ")") { depth--; current += ch; i++; continue; }
    if (depth === 0) {
      // Try sticky regex match at current position.
      sticky.lastIndex = i;
      const m = sticky.exec(s);
      if (m && m.index === i) {
        out.push(current);
        current = "";
        i += m[0].length;
        continue;
      }
    }
    current += ch;
    i++;
  }
  out.push(current);
  return out;
}

// ---------------------------------------------------------------------------
// Query parser
// ---------------------------------------------------------------------------

/** Parse a SQL query into structured info. */
export function parseQuery(sql: string): QueryInfo {
  const clauses = splitClauses(sql);
  const warnings: string[] = [];
  // FROM tables (comma-separated list of refs)
  const fromTables: TableRef[] = splitTopLevel(clauses.from, /,/).map((s) => parseTableRef(s)).filter((t) => t.name);
  // Joins
  const joins: JoinInfo[] = clauses.joins.map((j) => ({
    type: j.type,
    table: parseTableRef(j.table),
    onPredicates: parsePredicates(j.on),
  }));
  // WHERE
  const wherePredicates = parsePredicates(clauses.where);
  // ORDER BY
  const orderByColumns: OrderByColumn[] = splitTopLevel(clauses.orderBy, /,/).map((s): OrderByColumn => {
    const parts = s.trim().split(/\s+/);
    const col = parts[0] || "";
    const direction: "ASC" | "DESC" = (parts[1] || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    return { column: parseColumnRef(col), direction };
  }).filter((o) => o.column.column);
  // GROUP BY
  const groupByColumns: ColumnRef[] = splitTopLevel(clauses.groupBy, /,/).map((s) => parseColumnRef(s.trim())).filter((c) => c.column);
  // SELECT columns
  const selectColumns: ColumnRef[] = splitTopLevel(clauses.select, /,/).map((s) => {
    // Strip "AS alias"
    const cleaned = s.replace(/\s+AS\s+\S+$/i, "").trim();
    // Could be expression — only keep simple column refs
    if (/^[A-Za-z_][\w.]*$/.test(cleaned)) {
      return parseColumnRef(cleaned);
    }
    return { column: cleaned };
  }).filter((c) => c.column);

  // Build warnings
  for (const p of wherePredicates) {
    if (p.isLeadingWildcard) {
      warnings.push(`Leading-wildcard LIKE on ${fmtCol(p.column)} cannot use a B-tree index — consider a trigram/GIN index (Postgres pg_trgm) or a full-text index.`);
    }
    if (p.isFunction) {
      warnings.push(`Function on column ${fmtCol(p.column)} — a plain B-tree index won't help. Create an expression index on the function result.`);
    }
  }
  if (wherePredicates.some((p) => p.type === "or")) {
    warnings.push("OR conditions detected — the planner may not be able to use a single index. Consider UNION of two indexed queries, or a composite index covering both branches.");
  }

  return {
    selectColumns,
    fromTables,
    joins,
    wherePredicates,
    orderByColumns,
    groupByColumns,
    warnings,
  };
}

function fmtCol(c: ColumnRef): string {
  return c.table ? `${c.table}.${c.column}` : c.column;
}

// ---------------------------------------------------------------------------
// DDL parser
// ---------------------------------------------------------------------------

/** Parse DDL statements (CREATE TABLE, CREATE INDEX) into structured info. */
export function parseDdl(ddl: string): { tables: TableInfo[]; indexes: ExistingIndex[] } {
  const tables: TableInfo[] = [];
  const indexes: ExistingIndex[] = [];
  if (!ddl.trim()) return { tables, indexes };
  // Split by semicolons at top level (respecting parens).
  const statements = splitTopLevel(ddl, /;/).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const tableMatch = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\(([\s\S]*)\)$/i.exec(stmt);
    if (tableMatch) {
      const ref = parseTableRef(tableMatch[1]);
      const body = tableMatch[2];
      const columns: TableColumn[] = [];
      const colParts = splitTopLevel(body, /,/);
      for (const cp of colParts) {
        const trimmed = cp.trim();
        if (!trimmed) continue;
        // Skip constraint clauses (PRIMARY KEY, FOREIGN KEY, CONSTRAINT, UNIQUE, CHECK)
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK|KEY|INDEX)\b/i.test(trimmed)) continue;
        // Column def: <name> <type> [constraints...]
        const colMatch = /^("?`?\[?[\w]+"?`?\]?)\s+(\w+(?:\([^)]+\))?)/.exec(trimmed);
        if (colMatch) {
          const colName = colMatch[1].replace(/["`\[\]]/g, "");
          columns.push({ name: colName, type: colMatch[2].toLowerCase() });
        }
      }
      tables.push({ schema: ref.schema, name: ref.name, columns });
      continue;
    }
    const idxMatch = /^CREATE\s+(UNIQUE\s+)?(PRIMARY\s+)?(?:INDEX|KEY)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)?\s*ON\s+([^\s(]+)\s*\(([^)]+)\)(\s+INCLUDE\s*\(([^)]+)\))?(\s+WHERE\s+(.+))?$/i.exec(stmt);
    if (idxMatch) {
      const isUnique = Boolean(idxMatch[1]);
      const isPrimary = Boolean(idxMatch[2]);
      const idxName = idxMatch[3] ?? (isPrimary ? `${idxMatch[4]}_pkey` : `idx_${idxMatch[4]}_${idxMatch[5].split(",")[0].trim()}`);
      const ref = parseTableRef(idxMatch[4]);
      const columns = idxMatch[5].split(",").map((s) => s.trim().replace(/["`\[\]]/g, ""));
      const includeColumns = idxMatch[7] ? idxMatch[7].split(",").map((s) => s.trim().replace(/["`\[\]]/g, "")) : [];
      const whereClause = idxMatch[9];
      indexes.push({
        name: idxName,
        schema: ref.schema,
        table: ref.name,
        columns,
        isUnique,
        isPartial: Boolean(whereClause),
        whereClause,
        includeColumns,
        isPrimary,
      });
    }
  }
  return { tables, indexes };
}

// ---------------------------------------------------------------------------
// Index recommendation engine
// ---------------------------------------------------------------------------

/** Resolve a column's table alias to the actual table name using FROM/JOIN context. */
export function resolveTableForColumn(col: ColumnRef, query: QueryInfo): string | undefined {
  if (!col.table) {
    // If only one table, infer
    const allTables = [...query.fromTables, ...query.joins.map((j) => j.table)];
    if (allTables.length === 1) return allTables[0].name;
    return undefined;
  }
  // col.table could be alias or table name
  for (const t of query.fromTables) {
    if (t.alias === col.table || t.name === col.table) return t.name;
  }
  for (const j of query.joins) {
    if (j.table.alias === col.table || j.table.name === col.table) return j.table.name;
  }
  return col.table;
}

/** Group predicates by their owning table. */
export function groupPredicatesByTable(query: QueryInfo): Map<string, Predicate[]> {
  const out = new Map<string, Predicate[]>();
  const add = (table: string, p: Predicate) => {
    if (!out.has(table)) out.set(table, []);
    out.get(table)!.push(p);
  };
  for (const p of query.wherePredicates) {
    const t = resolveTableForColumn(p.column, query);
    if (t) add(t, p);
  }
  for (const j of query.joins) {
    for (const p of j.onPredicates) {
      // ON predicates apply to both tables in the join
      const t1 = resolveTableForColumn(p.column, query);
      if (t1) add(t1, p);
    }
  }
  return out;
}

/** Recommend indexes for the query, given optional DDL. */
export function recommendIndexes(
  query: QueryInfo,
  ddl: { tables: TableInfo[]; indexes: ExistingIndex[] },
  opts: ShareOptions = DEFAULT_SHARE_OPTIONS,
): IndexRecommendation[] {
  const out: IndexRecommendation[] = [];
  const byTable = groupPredicatesByTable(query);
  // Group ORDER BY / GROUP BY by table
  const sortColsByTable = new Map<string, string[]>();
  for (const o of query.orderByColumns) {
    const t = resolveTableForColumn(o.column, query);
    if (t) {
      if (!sortColsByTable.has(t)) sortColsByTable.set(t, []);
      sortColsByTable.get(t)!.push(o.column.column);
    }
  }
  for (const g of query.groupByColumns) {
    const t = resolveTableForColumn(g, query);
    if (t) {
      if (!sortColsByTable.has(t)) sortColsByTable.set(t, []);
      const arr = sortColsByTable.get(t)!;
      if (!arr.includes(g.column)) arr.push(g.column);
    }
  }
  // Group SELECT columns by table (for covering index)
  const selectColsByTable = new Map<string, Set<string>>();
  for (const s of query.selectColumns) {
    const t = resolveTableForColumn(s, query);
    if (t && s.column && !s.column.includes("(")) {
      if (!selectColsByTable.has(t)) selectColsByTable.set(t, new Set());
      selectColsByTable.get(t)!.add(s.column);
    }
  }

  let id = 0;
  for (const [table, preds] of byTable) {
    // Split into equality, range, like, function
    const equality: Predicate[] = [];
    const range: Predicate[] = [];
    const likes: Predicate[] = [];
    const funcs: Predicate[] = [];
    const ors: Predicate[] = [];
    for (const p of preds) {
      if (p.type === "or") ors.push(p);
      else if (p.isFunction) funcs.push(p);
      else if (p.type === "equality" || p.type === "in") equality.push(p);
      else if (p.type === "range") range.push(p);
      else if (p.type === "like" && !p.isLeadingWildcard) likes.push(p);
    }

    const tableInfo = ddl.tables.find((t) => t.name === table);
    const equalityCols = dedup(equality.map((p) => p.column.column));
    const rangeCols = dedup(range.map((p) => p.column.column));
    const likeCols = dedup(likes.map((p) => p.column.column));
    const sortCols = sortColsByTable.get(table) ?? [];
    const selectCols = selectColsByTable.get(table) ?? new Set<string>();
    // Composite index columns: equality first, then range, then sort
    const compositeCols = [...equalityCols, ...rangeCols, ...likeCols];
    // Add sort cols only if they're not already in composite
    for (const sc of sortCols) {
      if (!compositeCols.includes(sc)) compositeCols.push(sc);
    }

    const caveats: string[] = [];
    let confidence: Confidence = "high";
    if (ors.length > 0) {
      caveats.push("OR conditions present — a single composite index may not serve all branches; consider UNION with separate indexes.");
      confidence = "medium";
    }
    // Low-selectivity columns
    for (const ec of equalityCols) {
      if (LOW_SELECTIVITY_COLUMN_NAMES.has(ec.toLowerCase())) {
        caveats.push(`Column "${ec}" appears low-selectivity (boolean/flag/status). An index may not be selective enough to help — validate with EXPLAIN.`);
        confidence = "medium";
      } else if (tableInfo) {
        const colInfo = tableInfo.columns.find((c) => c.name === ec);
        if (colInfo && LOW_SELECTIVITY_TYPES.has(colInfo.type)) {
          caveats.push(`Column "${ec}" has low-cardinality type (${colInfo.type}). An index may not be selective enough to help.`);
          confidence = "medium";
        }
      }
    }

    // Build main recommendation
    if (compositeCols.length > 0) {
      // Compute covering INCLUDE columns
      const includeCols: string[] = [];
      if (opts.recommendCovering) {
        for (const sc of selectCols) {
          if (!compositeCols.includes(sc)) includeCols.push(sc);
        }
        if (includeCols.length > 5) {
          caveats.push(`Covering index would INCLUDE ${includeCols.length} columns — consider whether the write-amplification is justified.`);
          includeCols.length = 0; // too many — skip
        }
      }
      const rec: IndexRecommendation = {
        id: `idx-${id++}`,
        table,
        schema: tableInfo?.schema,
        columns: compositeCols,
        equalityColumns: equalityCols,
        rangeColumns: rangeCols,
        sortColumns: sortCols,
        includeColumns: includeCols,
        isExpression: false,
        reasoning: buildReasoning(equalityCols, rangeCols, likeCols, sortCols, includeCols),
        createIndexSql: buildCreateIndex(table, tableInfo?.schema, compositeCols, includeCols, opts.dialect),
        caveats,
        confidence,
      };
      // Check for redundancy with existing indexes
      const existing = ddl.indexes.filter((e) => e.table === table);
      const redundant = existing.find((e) => isCoveredBy(rec, e));
      if (redundant) {
        rec.coversExisting = redundant;
        rec.caveats.unshift(`Existing index "${redundant.name}" already covers this — recommendation may be redundant.`);
        rec.confidence = "low";
      }
      out.push(rec);
    }

    // Expression-index recommendations for function predicates
    for (const f of funcs) {
      const exprRaw = f.raw?.replace(/\s*(<>|!=|<=|>=|=|<|>|LIKE|IN|IS|BETWEEN)\s*.*/i, "").trim() || fmtCol(f.column);
      const expr = normalizeExpression(exprRaw);
      out.push({
        id: `idx-${id++}`,
        table,
        schema: tableInfo?.schema,
        columns: [expr],
        equalityColumns: [],
        rangeColumns: [],
        sortColumns: [],
        includeColumns: [],
        isExpression: true,
        expression: expr,
        reasoning: `Function on ${fmtCol(f.column)} prevents a plain B-tree index from being used. Create an expression index on the function result so the planner can match the predicate.`,
        createIndexSql: buildExpressionIndex(table, tableInfo?.schema, expr, opts.dialect),
        caveats: ["Expression indexes must match the exact function call in the query.", "Supported in PostgreSQL, SQLite, and SQL Server (computed column). MySQL does not support expression indexes prior to 8.0.13."],
        confidence: "medium",
      });
    }

    // Trigram/GIN suggestion for leading-wildcard LIKE
    for (const p of preds) {
      if (p.isLeadingWildcard) {
        out.push({
          id: `idx-${id++}`,
          table,
          schema: tableInfo?.schema,
          columns: [p.column.column],
          equalityColumns: [],
          rangeColumns: [],
          sortColumns: [],
          includeColumns: [],
          isExpression: false,
          reasoning: `Leading-wildcard LIKE on ${fmtCol(p.column)} cannot use a B-tree index. Use a trigram (pg_trgm GIN) index (Postgres) or a full-text index for substring search.`,
          createIndexSql: `CREATE INDEX idx_${table}_${p.column.column}_trgm ON ${tableSchema(table, tableInfo?.schema)} USING gin (${p.column.column} gin_trgm_ops); -- requires CREATE EXTENSION pg_trgm`,
          caveats: ["Requires the pg_trgm extension in PostgreSQL.", "Other DBMS: use FULLTEXT indexes (MySQL) or contains() predicates (SQL Server)."],
          confidence: "low",
        });
      }
    }
  }

  return out;
}

function normalizeExpression(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ") ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function buildReasoning(eq: string[], range: string[], like: string[], sort: string[], include: string[]): string {
  const parts: string[] = [];
  if (eq.length > 0) parts.push(`equality predicates on ${eq.join(", ")}`);
  if (range.length > 0) parts.push(`range predicates on ${range.join(", ")}`);
  if (like.length > 0) parts.push(`LIKE-prefix on ${like.join(", ")}`);
  if (sort.length > 0) parts.push(`sort/group on ${sort.join(", ")}`);
  if (include.length > 0) parts.push(`covering INCLUDE (${include.join(", ")})`);
  if (parts.length === 0) return "Index recommendation.";
  const order: string[] = [];
  if (eq.length > 0) order.push("equality-first");
  if (range.length > 0) order.push("range-last");
  if (sort.length > 0) order.push("sort-trailing");
  return `Recommendation based on ${parts.join("; ")}. Column order: ${order.join(" → ") || "single column"}.`;
}

function tableSchema(table: string, schema?: string): string {
  return schema ? `${schema}.${table}` : table;
}

function buildCreateIndex(table: string, schema: string | undefined, cols: string[], include: string[], dialect: ShareOptions["dialect"]): string {
  const tableRef = tableSchema(table, schema);
  const idxName = `idx_${table}_${cols.join("_")}`.slice(0, 63);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  const includeSql = include.length > 0 && (dialect === "postgres" || dialect === "sqlserver")
    ? ` INCLUDE (${include.map((c) => `"${c}"`).join(", ")})`
    : "";
  if (dialect === "mysql") {
    // MySQL: no INCLUDE; use a regular composite index (the columns will be appended if needed).
    return `CREATE INDEX ${idxName} ON ${tableRef} (${colsSql});`;
  }
  return `CREATE INDEX ${idxName} ON ${tableRef} (${colsSql})${includeSql};`;
}

function buildExpressionIndex(table: string, schema: string | undefined, expr: string, dialect: ShareOptions["dialect"]): string {
  const tableRef = tableSchema(table, schema);
  if (dialect === "mysql") {
    return `-- MySQL 8.0.13+: CREATE INDEX idx_${table}_expr ON ${tableRef} ((${expr}));`;
  }
  if (dialect === "sqlserver") {
    return `-- SQL Server: add a PERSISTED computed column, then index it.\nALTER TABLE ${tableRef} ADD ${expr.replace(/[^A-Za-z0-9_]/g, "_")}_col AS ${expr} PERSISTED;\nCREATE INDEX idx_${table}_expr ON ${tableRef} (${expr.replace(/[^A-Za-z0-9_]/g, "_")}_col);`;
  }
  return `CREATE INDEX idx_${table}_expr ON ${tableRef} ((${expr}));`;
}

/** Returns true if the recommended index is already covered by an existing index. */
export function isCoveredBy(rec: IndexRecommendation, existing: ExistingIndex): boolean {
  if (rec.isExpression) return false;
  // Covered if the existing index has at least as many leading columns as the rec, all matching.
  if (existing.columns.length < rec.columns.length) return false;
  for (let i = 0; i < rec.columns.length; i++) {
    if (existing.columns[i].toLowerCase() !== rec.columns[i].toLowerCase()) return false;
  }
  return true;
}

/** Detect existing indexes that are redundant given the recommendations. */
export function detectRedundantExisting(
  recs: IndexRecommendation[],
  existing: ExistingIndex[],
): ExistingIndex[] {
  const out: ExistingIndex[] = [];
  for (const e of existing) {
    if (e.isPrimary) continue;
    // e is redundant if some recommendation r covers e (r is at least as long and matches e's prefix).
    const redundant = recs.some((r) => {
      if (r.isExpression) return false;
      if (r.table !== e.table) return false;
      if (r.columns.length < e.columns.length) return false;
      for (let i = 0; i < e.columns.length; i++) {
        if (r.columns[i].toLowerCase() !== e.columns[i].toLowerCase()) return false;
      }
      return true;
    });
    if (redundant) out.push(e);
  }
  return out;
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Top-level advice entry
// ---------------------------------------------------------------------------

/** Run the full index-advice pipeline. */
export function advise(query: string, ddl: string, opts: ShareOptions = DEFAULT_SHARE_OPTIONS): AdviceOutcome {
  if (!query.trim()) return { ok: false, error: "Empty query. Paste a SELECT/UPDATE/DELETE statement." };
  let parsed: QueryInfo;
  try {
    parsed = parseQuery(query);
  } catch (e) {
    return { ok: false, error: `Failed to parse query: ${(e as Error).message}` };
  }
  const parsedDdl = parseDdl(ddl);
  const recommendations = recommendIndexes(parsed, parsedDdl, opts);
  const redundantExisting = detectRedundantExisting(recommendations, parsedDdl.indexes);
  const warnings = [...parsed.warnings];
  if (recommendations.length === 0) {
    warnings.push("No indexable predicates detected. The query may already be optimal, or it lacks WHERE/JOIN/ORDER BY clauses that benefit from indexes.");
  }
  if (parsed.fromTables.length === 0 && parsed.joins.length === 0) {
    warnings.push("No FROM clause detected — index advisor works on queries that touch tables.");
  }
  if (recommendations.length > 5) {
    warnings.push(`${recommendations.length} recommendations generated — review each carefully; too many indexes increase write cost.`);
  }
  const stats: AdviceStats = {
    tables: parsed.fromTables.length + parsed.joins.length,
    predicates: parsed.wherePredicates.length + parsed.joins.reduce((s, j) => s + j.onPredicates.length, 0),
    recommendations: recommendations.length,
    highConfidence: recommendations.filter((r) => r.confidence === "high").length,
    redundantDetected: redundantExisting.length,
    warnings: warnings.length,
  };
  return {
    ok: true,
    result: {
      query: parsed,
      ddl: parsedDdl,
      recommendations,
      warnings,
      redundantExisting,
      stats,
    },
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render recommendations as a Markdown report. */
export function renderMarkdown(result: AdviceResult, opts: ShareOptions = DEFAULT_SHARE_OPTIONS): string {
  const lines: string[] = [];
  lines.push("# SQL Index Advisor Report");
  lines.push("");
  lines.push(`- **Tables analyzed:** ${result.stats.tables}`);
  lines.push(`- **Predicates found:** ${result.stats.predicates}`);
  lines.push(`- **Recommendations:** ${result.stats.recommendations} (${result.stats.highConfidence} high-confidence)`);
  lines.push(`- **Redundant existing indexes detected:** ${result.stats.redundantDetected}`);
  lines.push(`- **Warnings:** ${result.stats.warnings}`);
  lines.push("");
  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    for (const w of result.warnings) lines.push(`- ⚠ ${w}`);
    lines.push("");
  }
  if (result.recommendations.length > 0) {
    lines.push("## Recommendations");
    for (const r of result.recommendations) {
      lines.push("");
      lines.push(`### ${r.id} — \`${r.table}\` (${r.confidence} confidence)`);
      lines.push("");
      lines.push(`**Columns:** ${r.columns.map((c) => `\`${c}\``).join(", ")}`);
      if (r.equalityColumns.length) lines.push(`- Equality: ${r.equalityColumns.join(", ")}`);
      if (r.rangeColumns.length) lines.push(`- Range: ${r.rangeColumns.join(", ")}`);
      if (r.sortColumns.length) lines.push(`- Sort/Group: ${r.sortColumns.join(", ")}`);
      if (r.includeColumns.length) lines.push(`- INCLUDE: ${r.includeColumns.join(", ")}`);
      lines.push("");
      lines.push(`**Reasoning:** ${r.reasoning}`);
      if (opts.includeCaveats && r.caveats.length > 0) {
        lines.push("");
        lines.push("**Caveats:**");
        for (const c of r.caveats) lines.push(`- ${c}`);
      }
      lines.push("");
      lines.push("```sql");
      lines.push(r.createIndexSql);
      lines.push("```");
    }
  }
  if (result.redundantExisting.length > 0) {
    lines.push("");
    lines.push("## Redundant Existing Indexes");
    for (const e of result.redundantExisting) {
      lines.push(`- \`${e.name}\` on \`${e.table}\` (${e.columns.join(", ")}) — covered by a recommended index.`);
    }
  }
  return lines.join("\n");
}

/** Render recommendations as plain SQL script. */
export function renderSqlScript(result: AdviceResult): string {
  const lines: string[] = [
    "-- SQL Index Advisor — recommended indexes",
    "-- Generated client-side; validate with EXPLAIN ANALYZE on real data.",
    "",
  ];
  for (const r of result.recommendations) {
    lines.push(`-- ${r.id} on ${r.table} (${r.confidence})`);
    lines.push(`-- ${r.reasoning}`);
    if (r.caveats.length > 0) {
      for (const c of r.caveats) lines.push(`-- Caveat: ${c}`);
    }
    lines.push(r.createIndexSql);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render recommendations as CSV. */
export function renderCsv(result: AdviceResult): string {
  const header = "id,table,columns,equality,range,sort,include,is_expression,confidence,reasoning,create_index_sql";
  const rows = result.recommendations.map((r) => {
    const cells = [
      r.id,
      csvEscape(r.table),
      csvEscape(r.columns.join("|")),
      csvEscape(r.equalityColumns.join("|")),
      csvEscape(r.rangeColumns.join("|")),
      csvEscape(r.sortColumns.join("|")),
      csvEscape(r.includeColumns.join("|")),
      String(r.isExpression),
      r.confidence,
      csvEscape(r.reasoning),
      csvEscape(r.createIndexSql),
    ];
    return cells.join(",");
  });
  return [header, ...rows].join("\n");
}

/** Render the analysis as JSON. */
export function renderJson(result: AdviceResult): string {
  return JSON.stringify(result, null, 2);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-index-advisor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  tableCount: number;
  predicateCount: number;
  recommendationCount: number;
  queryPreview: string;
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

export function buildShareUrl(opts: ShareOptions): string {
  const params = new URLSearchParams();
  params.set("caveats", String(opts.includeCaveats));
  params.set("covering", String(opts.recommendCovering));
  params.set("dialect", opts.dialect);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_SHARE_OPTIONS };
  const params = new URLSearchParams(clean);
  const dialect = (params.get("dialect") ?? "ansi") as ShareOptions["dialect"];
  const validDialects: ShareOptions["dialect"][] = ["ansi", "postgres", "mysql", "sqlserver"];
  return {
    includeCaveats: params.get("caveats") !== "false",
    recommendCovering: params.get("covering") !== "false",
    dialect: validDialects.includes(dialect) ? dialect : "ansi",
  };
}
