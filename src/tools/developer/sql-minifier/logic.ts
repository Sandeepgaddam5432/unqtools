/**
 * SQL Minifier — pure logic.
 *
 * Token-aware SQL minifier: removes comments, collapses whitespace, and
 * emits a single-line compact statement — without ever altering string
 * literals or quoted identifiers. 100% client-side; no DOM, no network.
 *
 * Reuses the same proven tokenizer shape as the SQL Formatter so dialect
 * quirks (MySQL backticks, T-SQL [brackets], -- and # comments, nested
 * slash-star block comments, and '' escapes) are handled consistently.
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

export type NewlineMode = "single" | "betweenStatements";

export interface MinifyOptions {
  dialect: SqlDialect;
  removeComments: boolean;
  /** Single line (default) or keep newlines between semicolon-separated statements. */
  newlines: NewlineMode;
  /** Normalize consecutive semicolons to one. */
  normalizeSemicolons: boolean;
  /** Collapse runs of whitespace inside the SQL (always on for minify). */
  collapseWhitespace: boolean;
  /** Output SQL escaped as a JS/JSON string literal (useful for embedding). */
  asJsString: boolean;
}

export type MinifyResult =
  | { ok: true; output: string; stats: MinifyStats }
  | { ok: false; error: string };

export interface MinifyStats {
  inputBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedPercent: number;
  inputLines: number;
  outputLines: number;
  statementCount: number;
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

export const NEWLINE_MODES: ReadonlyArray<{ value: NewlineMode; label: string }> = [
  { value: "single", label: "Single line" },
  { value: "betweenStatements", label: "Keep newlines between statements" },
];

export const DEFAULT_OPTIONS: MinifyOptions = {
  dialect: "ansi",
  removeComments: true,
  newlines: "single",
  normalizeSemicolons: true,
  collapseWhitespace: true,
  asJsString: false,
};

// ---------------------------------------------------------------------------
// Reserved-word set (for keyword detection — kept identical to formatter)
// ---------------------------------------------------------------------------

export const KEYWORDS: ReadonlySet<string> = new Set([
  "SELECT", "DISTINCT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER",
  "LIMIT", "OFFSET", "FETCH", "NEXT", "FIRST", "ONLY", "ROW", "ROWS",
  "UNION", "INTERSECT", "EXCEPT", "ALL", "AS", "AND", "OR", "NOT", "IN",
  "IS", "NULL", "LIKE", "BETWEEN", "EXISTS", "ANY", "SOME", "ESCAPE",
  "CASE", "WHEN", "THEN", "ELSE", "END", "IF", "BEGIN", "COMMIT",
  "ROLLBACK", "TRANSACTION", "SAVEPOINT", "WITH", "RECURSIVE",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "RETURNING",
  "MERGE", "MATCHED", "SOURCE", "TARGET", "TRUNCATE", "CREATE", "TABLE",
  "VIEW", "INDEX", "UNIQUE", "DROP", "ALTER", "ADD", "COLUMN", "CONSTRAINT",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CHECK", "DEFAULT",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL",
  "ON", "USING", "LATERAL", "TABLESAMPLE", "PARTITION", "OVER", "WINDOW",
  "BOOLEAN", "TRUE", "FALSE", "UNKNOWN", "INTEGER", "INT", "SMALLINT",
  "BIGINT", "DECIMAL", "NUMERIC", "REAL", "FLOAT", "DOUBLE", "PRECISION",
  "CHAR", "VARCHAR", "TEXT", "DATE", "TIME", "TIMESTAMP", "INTERVAL",
  "BLOB", "CLOB", "BINARY", "VARBINARY", "SERIAL", "BIGSERIAL",
  "ASC", "DESC", "NULLS", "FIRST", "LAST", "CAST", "CONVERT", "EXTRACT",
  "POSITION", "SUBSTRING", "TRIM", "BOTH", "LEADING", "TRAILING",
  "PLACING", "FOR", "WITHIN", "FILTER", "GROUPING", "ROLLUP", "CUBE",
  "SETS", "TYPE", "LANGUAGE", "SQL", "DO", "DECLARE", "EXECUTE",
  "EXPLAIN", "ANALYZE", "VACUUM", "GRANT", "REVOKE", "PRIVILEGES",
  "DATABASE", "SCHEMA", "TRIGGER", "PROCEDURE", "FUNCTION", "RETURNS",
  "RETURN", "SECURITY", "DEFINER", "INVOKER", "PARALLEL", "SAFE",
  "RESTRICTED", "UNSAFE", "STABLE", "IMMUTABLE", "VOLATILE", "STRICT",
  "WHILE", "LOOP", "FOREACH", "CONTINUE", "EXIT", "RAISE", "NOTICE",
  "EXCEPTION",
]);

export function isKeyword(word: string): boolean {
  return KEYWORDS.has((word ?? "").toUpperCase());
}

// ---------------------------------------------------------------------------
// Tokenizer (identical contract to formatter; kept independent so the
// minifier has no cross-tool imports)
// ---------------------------------------------------------------------------

export type TokenType =
  | "keyword"
  | "identifier"
  | "string"
  | "number"
  | "comment"
  | "punctuation"
  | "operator"
  | "whitespace";

export interface Token {
  type: TokenType;
  value: string;
  upper: string;
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch) || ch.charCodeAt(0) > 127;
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) > 127;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

export function tokenizeSql(input: string, dialect: SqlDialect = "ansi"): Token[] {
  const tokens: Token[] = [];
  const s = input ?? "";
  let i = 0;
  const n = s.length;

  const push = (type: TokenType, value: string): void => {
    tokens.push({ type, value, upper: value.toUpperCase() });
  };

  while (i < n) {
    const ch = s[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v") {
      let j = i + 1;
      while (j < n && /\s/.test(s[j])) j++;
      push("whitespace", s.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "-" && s[i + 1] === "-") {
      let j = i + 2;
      while (j < n && s[j] !== "\n") j++;
      push("comment", s.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "#" && (dialect === "mysql" || dialect === "ansi")) {
      let j = i + 1;
      while (j < n && s[j] !== "\n") j++;
      push("comment", s.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "/" && s[i + 1] === "*") {
      let j = i + 2;
      let depth = 1;
      while (j < n && depth > 0) {
        if (s[j] === "/" && s[j + 1] === "*") { depth++; j += 2; }
        else if (s[j] === "*" && s[j + 1] === "/") { depth--; j += 2; }
        else { j++; }
      }
      push("comment", s.slice(i, j));
      i = j;
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
      const value = s.slice(i, j);
      push(dialect === "mysql" ? "string" : "identifier", value);
      i = j;
      continue;
    }

    if (ch === "`" && (dialect === "mysql" || dialect === "ansi" || dialect === "sqlite")) {
      let j = i + 1;
      while (j < n) {
        if (s[j] === "`") {
          if (s[j + 1] === "`") { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      push("identifier", s.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "[" && (dialect === "sqlserver" || dialect === "ansi")) {
      let j = i + 1;
      while (j < n && s[j] !== "]") j++;
      if (j < n) j++;
      push("identifier", s.slice(i, j));
      i = j;
      continue;
    }

    if (isDigit(ch) || (ch === "." && isDigit(s[i + 1]))) {
      let j = i;
      while (j < n && isDigit(s[j])) j++;
      if (s[j] === ".") {
        j++;
        while (j < n && isDigit(s[j])) j++;
      }
      if (s[j] === "e" || s[j] === "E") {
        j++;
        if (s[j] === "+" || s[j] === "-") j++;
        while (j < n && isDigit(s[j])) j++;
      }
      push("number", s.slice(i, j));
      i = j;
      continue;
    }

    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentPart(s[j])) j++;
      const value = s.slice(i, j);
      push(KEYWORDS.has(value.toUpperCase()) ? "keyword" : "identifier", value);
      i = j;
      continue;
    }

    const two = s.slice(i, i + 2);
    if (
      two === "<>" || two === "!=" || two === "<=" || two === ">=" ||
      two === "||" || two === "::" || two === ":=" || two === "==" ||
      two === ">>" || two === "<<"
    ) {
      push("operator", two);
      i += 2;
      continue;
    }

    if ("(),.;".includes(ch)) {
      push("punctuation", ch);
      i++;
      continue;
    }
    if ("+-*/%=<>".includes(ch)) {
      push("operator", ch);
      i++;
      continue;
    }

    push("punctuation", ch);
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateSql(input: string): { ok: true; warnings: string[] } | { ok: false; error: string } {
  if (input == null) return { ok: false, error: "Input is null." };
  if (!input.trim()) return { ok: false, error: "Input is empty." };

  let parenDepth = 0;
  let inSingle = false, inDouble = false, inBacktick = false;
  let inBlockComment = 0, inLineComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inLineComment) { if (ch === "\n") inLineComment = false; continue; }
    if (inBlockComment > 0) {
      if (ch === "*" && input[i + 1] === "/") { inBlockComment--; i++; }
      else if (ch === "/" && input[i + 1] === "*") { inBlockComment++; i++; }
      continue;
    }
    if (inSingle) { if (ch === "'") { if (input[i + 1] === "'") i++; else inSingle = false; } continue; }
    if (inDouble) { if (ch === '"') { if (input[i + 1] === '"') i++; else inDouble = false; } continue; }
    if (inBacktick) { if (ch === "`") { if (input[i + 1] === "`") i++; else inBacktick = false; } continue; }
    if (ch === "-" && input[i + 1] === "-") { inLineComment = true; i++; continue; }
    if (ch === "/" && input[i + 1] === "*") { inBlockComment++; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === "`") { inBacktick = true; continue; }
    if (ch === "(") parenDepth++;
    if (ch === ")") {
      parenDepth--;
      if (parenDepth < 0) return { ok: false, error: `Unbalanced ')' at offset ${i}.` };
    }
  }

  if (inSingle) return { ok: false, error: "Unterminated single-quoted string literal." };
  if (inDouble) return { ok: false, error: "Unterminated double-quoted string literal." };
  if (inBacktick) return { ok: false, error: "Unterminated backtick-quoted identifier." };
  if (inBlockComment > 0) return { ok: false, error: "Unterminated block comment." };
  if (parenDepth !== 0) return { ok: false, error: `Unbalanced parentheses (depth ${parenDepth}).` };

  return { ok: true, warnings: [] };
}

// ---------------------------------------------------------------------------
// Spacing helper — decide whether two adjacent tokens need a space between
// them. Without this, "SELECT name" would become "SELECTname" after we drop
// whitespace tokens.
// ---------------------------------------------------------------------------

function needsSpace(prev: Token, cur: Token): boolean {
  // Punctuation rules: no space around "." "(", ")" or before "," ";"
  if (prev.value === "." || cur.value === ".") return false;
  if (prev.value === "(") return false;
  if (cur.value === ")") return false;
  if (cur.value === ",") return false;
  if (cur.value === ";") return false;
  // After ")" we need a space before word-like tokens, "(", or operators.
  // e.g. `count(*) from`, `(a)(b)`, `(a)+1`.
  if (prev.value === ")") {
    const wordLike = (t: Token) =>
      t.type === "keyword" || t.type === "identifier" || t.type === "number" || t.type === "string";
    if (wordLike(cur) || cur.value === "(" || cur.type === "operator") return true;
    return false;
  }
  // Function-call: identifier directly followed by "(" — no space.
  if (prev.type === "identifier" && cur.value === "(") return false;
  // Keyword followed by "(" — space (e.g., IN (, EXISTS ().
  if (prev.type === "keyword" && cur.value === "(") return true;
  // Operator spacing: keep space around binary operators.
  if (prev.type === "operator" || cur.type === "operator") {
    // Unary +/- directly before number/identifier: no space.
    if ((prev.value === "-" || prev.value === "+") && (cur.type === "number" || cur.type === "identifier")) {
      // Heuristic: if prev-prev was an operator / open-paren / null → unary.
      // We can't see prev-prev here; default to space which is always safe.
      return true;
    }
    return true;
  }
  // Two word-like tokens always need a space.
  const wordLike = (t: Token) =>
    t.type === "keyword" || t.type === "identifier" || t.type === "number" || t.type === "string";
  if (wordLike(prev) && wordLike(cur)) return true;
  // Default: no space (e.g., between identifier and "," ).
  return false;
}

// ---------------------------------------------------------------------------
// Minifier
// ---------------------------------------------------------------------------

export function minifySql(input: string, opts: MinifyOptions = DEFAULT_OPTIONS): MinifyResult {
  if (input == null) return { ok: false, error: "Input is null." };
  if (!input.trim()) {
    return {
      ok: true,
      output: "",
      stats: {
        inputBytes: 0, outputBytes: 0, savedBytes: 0, savedPercent: 0,
        inputLines: 0, outputLines: 0, statementCount: 0,
      },
    };
  }

  const v = validateSql(input);
  if (!v.ok) return { ok: false, error: v.error };

  let toks: Token[];
  try {
    toks = tokenizeSql(input, opts.dialect).filter((t) => t.type !== "whitespace");
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Tokenize failed" };
  }

  if (opts.removeComments) {
    toks = toks.filter((t) => t.type !== "comment");
  }

  // Build minified output.
  let out = "";
  let prev: Token | null = null;
  let statementCount = 0;

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];

    // Normalize consecutive semicolons.
    if (
      tok.value === ";" && opts.normalizeSemicolons &&
      prev !== null && prev.value === ";"
    ) {
      continue;
    }

    if (tok.value === ";") statementCount++;

    if (prev !== null) {
      if (tok.value === ";" && opts.newlines === "betweenStatements") {
        out += ";\n";
      } else if (needsSpace(prev, tok)) {
        out += " " + tok.value;
      } else {
        out += tok.value;
      }
    } else {
      out += tok.value;
    }
    prev = tok;
  }

  if (statementCount === 0 && out.trim()) statementCount = 1;

  let finalOutput = out.trim();
  if (opts.asJsString) {
    finalOutput = '"' + finalOutput.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
  }

  const inputBytes = input.length;
  const outputBytes = finalOutput.length;
  const savedBytes = Math.max(0, inputBytes - outputBytes);
  const savedPercent = inputBytes === 0 ? 0 : Math.round((savedBytes / inputBytes) * 1000) / 10;

  return {
    ok: true,
    output: finalOutput,
    stats: {
      inputBytes,
      outputBytes,
      savedBytes,
      savedPercent,
      inputLines: input.split(/\r?\n/).length,
      outputLines: finalOutput.split(/\r?\n/).length,
      statementCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Savings helper (used by UI when output not yet computed)
// ---------------------------------------------------------------------------

export function computeSavings(inputBytes: number, outputBytes: number): {
  savedBytes: number;
  savedPercent: number;
} {
  if (inputBytes <= 0) return { savedBytes: 0, savedPercent: 0 };
  const savedBytes = Math.max(0, inputBytes - outputBytes);
  const savedPercent = Math.round((savedBytes / inputBytes) * 1000) / 10;
  return { savedBytes, savedPercent };
}

/** Escape SQL output as a JS/JSON string literal (for embedding in code). */
export function escapeForJs(input: string): string {
  return '"' + input.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-minifier:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dialect: SqlDialect;
  removeComments: boolean;
  inputPreview: string;
  outputPreview: string;
  inputBytes: number;
  outputBytes: number;
  savedPercent: number;
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

export function buildShareUrl(opts: MinifyOptions): string {
  const params = new URLSearchParams();
  params.set("d", opts.dialect);
  params.set("rc", opts.removeComments ? "1" : "0");
  params.set("nl", opts.newlines);
  params.set("ns", opts.normalizeSemicolons ? "1" : "0");
  params.set("js", opts.asJsString ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): MinifyOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: MinifyOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (d && (["ansi", "mysql", "postgresql", "sqlite", "sqlserver"] as SqlDialect[]).includes(d as SqlDialect)) {
    base.dialect = d as SqlDialect;
  }
  if (params.get("rc") === "0") base.removeComments = false;
  if (params.get("rc") === "1") base.removeComments = true;
  const nl = params.get("nl");
  if (nl === "single" || nl === "betweenStatements") base.newlines = nl;
  if (params.get("ns") === "0") base.normalizeSemicolons = false;
  if (params.get("ns") === "1") base.normalizeSemicolons = true;
  if (params.get("js") === "1") base.asJsString = true;
  return base;
}

// ---------------------------------------------------------------------------
// Sample SQL
// ---------------------------------------------------------------------------

export const SAMPLE_SQL = `-- Customer revenue by region
/* This query powers the regional dashboard */
SELECT
  r.name AS region,
  COUNT(DISTINCT o.customer_id) AS customers,
  SUM(o.total) AS revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN regions r ON r.id = c.region_id
WHERE o.created_at >= '2024-01-01'
  AND o.status <> 'cancelled'
GROUP BY r.name
ORDER BY revenue DESC
LIMIT 10;`;
