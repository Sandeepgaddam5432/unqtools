/**
 * SQL Formatter / Beautifier — pure logic.
 *
 * A small, dependency-free SQL tokenizer + pretty-printer that supports
 * ANSI/MySQL/PostgreSQL/SQLite/T-SQL dialects. 100% in-browser — no DOM,
 * no network. Safe to unit-test and run inside a Web Worker.
 *
 * Design principles:
 *  - Never change token order, never add or remove tokens.
 *  - String literals and comments are preserved verbatim.
 *  - Only whitespace, newlines, indentation, and keyword casing change.
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

export type KeywordCase = "upper" | "lower" | "preserve";
export type IdentifierCase = "preserve" | "upper" | "lower";
export type CommaStyle = "trailing" | "leading";
export type IndentStyle = "spaces" | "tabs";

export interface FormatOptions {
  dialect: SqlDialect;
  keywordCase: KeywordCase;
  identifierCase: IdentifierCase;
  indent: IndentStyle;
  indentSize: number;
  commaStyle: CommaStyle;
  newLineBeforeClause: boolean;
  alignSelectColumns: boolean;
  preserveComments: boolean;
  uppercaseOperators: boolean;
}

export type FormatResult =
  | { ok: true; output: string; stats: FormatStats }
  | { ok: false; error: string };

export interface FormatStats {
  inputBytes: number;
  outputBytes: number;
  inputLines: number;
  outputLines: number;
  tokenCount: number;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const SQL_DIALECTS: ReadonlyArray<{ value: SqlDialect; label: string }> = [
  { value: "ansi", label: "ANSI SQL (Standard)" },
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "sqlserver", label: "SQL Server (T-SQL)" },
];

export const KEYWORD_CASE_OPTIONS: ReadonlyArray<{ value: KeywordCase; label: string }> = [
  { value: "upper", label: "UPPERCASE" },
  { value: "lower", label: "lowercase" },
  { value: "preserve", label: "Preserve" },
];

export const IDENTIFIER_CASE_OPTIONS: ReadonlyArray<{ value: IdentifierCase; label: string }> = [
  { value: "preserve", label: "Preserve" },
  { value: "lower", label: "lowercase" },
  { value: "upper", label: "UPPERCASE" },
];

export const COMMA_STYLE_OPTIONS: ReadonlyArray<{ value: CommaStyle; label: string }> = [
  { value: "trailing", label: "Trailing (a, b,)" },
  { value: "leading", label: "Leading (, a, b)" },
];

export const INDENT_STYLE_OPTIONS: ReadonlyArray<{ value: IndentStyle; label: string }> = [
  { value: "spaces", label: "Spaces" },
  { value: "tabs", label: "Tabs" },
];

export const DEFAULT_OPTIONS: FormatOptions = {
  dialect: "ansi",
  keywordCase: "upper",
  identifierCase: "preserve",
  indent: "spaces",
  indentSize: 2,
  commaStyle: "trailing",
  newLineBeforeClause: true,
  alignSelectColumns: false,
  preserveComments: true,
  uppercaseOperators: false,
};

export interface Preset {
  id: string;
  label: string;
  options: FormatOptions;
}

export const PRESETS: Preset[] = [
  {
    id: "default",
    label: "Default (ANSI 2-space)",
    options: { ...DEFAULT_OPTIONS },
  },
  {
    id: "dbt",
    label: "dbt style",
    options: {
      ...DEFAULT_OPTIONS,
      dialect: "postgresql",
      keywordCase: "lower",
      commaStyle: "trailing",
      indentSize: 2,
      newLineBeforeClause: true,
    },
  },
  {
    id: "tsql",
    label: "T-SQL (Poor Man's)",
    options: {
      ...DEFAULT_OPTIONS,
      dialect: "sqlserver",
      keywordCase: "upper",
      commaStyle: "leading",
      indentSize: 2,
    },
  },
  {
    id: "mysql-classic",
    label: "MySQL classic",
    options: {
      ...DEFAULT_OPTIONS,
      dialect: "mysql",
      keywordCase: "upper",
      commaStyle: "trailing",
      indentSize: 2,
    },
  },
  {
    id: "compact",
    label: "Compact (4-space)",
    options: {
      ...DEFAULT_OPTIONS,
      indentSize: 4,
      newLineBeforeClause: true,
    },
  },
];

// ---------------------------------------------------------------------------
// Reserved-word set
// ---------------------------------------------------------------------------

/**
 * Reserved keywords across ANSI + MySQL + PostgreSQL + SQLite + T-SQL.
 * Used to (a) decide which tokens to case-ify, (b) detect clause starts.
 */
export const KEYWORDS: ReadonlySet<string> = new Set([
  // Clauses / statement keywords
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
  // Type keywords
  "BOOLEAN", "TRUE", "FALSE", "UNKNOWN", "INTEGER", "INT", "SMALLINT",
  "BIGINT", "DECIMAL", "NUMERIC", "REAL", "FLOAT", "DOUBLE", "PRECISION",
  "CHAR", "VARCHAR", "TEXT", "DATE", "TIME", "TIMESTAMP", "INTERVAL",
  "BLOB", "CLOB", "BINARY", "VARBINARY", "SERIAL", "BIGSERIAL",
  // Modifiers / sort
  "ASC", "DESC", "NULLS", "FIRST", "LAST", "CAST", "CONVERT", "EXTRACT",
  "POSITION", "SUBSTRING", "TRIM", "BOTH", "LEADING", "TRAILING",
  "PLACING", "FOR", "WITHIN", "FILTER", "GROUPING", "ROLLUP", "CUBE",
  "SETS", "DISTINCT", "TYPE", "LANGUAGE", "SQL", "DO", "DECLARE",
  "EXECUTE", "EXPLAIN", "ANALYZE", "VACUUM", "GRANT", "REVOKE",
  "PRIVILEGES", "DATABASE", "SCHEMA", "TRIGGER", "PROCEDURE", "FUNCTION",
  "RETURNS", "RETURN", "SECURITY", "DEFINER", "INVOKER", "PARALLEL",
  "SAFE", "RESTRICTED", "UNSAFE", "STABLE", "IMMUTABLE", "VOLATILE",
  "STRICT", "WHILE", "LOOP", "FOR", "FOREACH", "CONTINUE", "EXIT",
  "RAISE", "NOTICE", "EXCEPTION",
]);

/**
 * Major clause keywords — when newline-before-clause is on, the formatter
 * starts a new line immediately before any of these (except the very first
 * token of the script).
 */
const MAJOR_CLAUSE: ReadonlySet<string> = new Set([
  "SELECT", "DISTINCT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING",
  "LIMIT", "OFFSET", "FETCH", "UNION", "INTERSECT", "EXCEPT",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "NATURAL",
  "ON", "USING", "WITH", "INSERT", "INTO", "VALUES", "UPDATE",
  "SET", "DELETE", "RETURNING", "MERGE", "CREATE", "DROP", "ALTER",
  "ADD", "TRUNCATE", "BEGIN", "COMMIT", "ROLLBACK", "GRANT", "REVOKE",
  "EXPLAIN", "VACUUM", "ANALYZE", "DECLARE", "EXECUTE",
]);

/**
 * Words that combine with the previous keyword (e.g., GROUP → BY, ORDER → BY,
 * LEFT → OUTER, INNER → JOIN). The formatter will not insert a newline before
 * these even when newline-before-clause is enabled.
 */
const COMBINER: ReadonlySet<string> = new Set([
  "BY", "OUTER", "JOIN", "ALL", "DISTINCT", "ROW", "ROWS", "ONLY",
  "FIRST", "NEXT", "RECURSIVE",
]);

// ---------------------------------------------------------------------------
// Tokenizer
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
  /** Raw source text of the token (preserves original case). */
  value: string;
  /** Uppercased value — used for keyword lookup and clause detection. */
  upper: string;
}

/** True if char is a valid identifier-start (letter, underscore, or non-ASCII). */
function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch) || ch.charCodeAt(0) > 127;
}

/** True if char is a valid identifier-continuation. */
function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) > 127;
}

/** True if char is a digit. */
function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Tokenize a SQL string into a flat token list. Whitespace tokens are kept
 * so the caller can decide to strip them; formatSql() drops them.
 *
 * Quoted-identifier handling is dialect-aware:
 *   - mysql: backticks `name` and "name" (with ANSI_QUOTES off) is string
 *   - postgresql / ansi: "name" is identifier, 'literal' is string
 *   - sqlserver: [name] and "name" are identifiers, 'literal' is string
 *   - sqlite: any of ", ', ` can be identifier or string depending on context;
 *             we treat " as identifier and ' as string (SQLite's default).
 */
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

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v") {
      let j = i + 1;
      while (j < n && /\s/.test(s[j])) j++;
      push("whitespace", s.slice(i, j));
      i = j;
      continue;
    }

    // Line comment -- (ANSI / all dialects)
    if (ch === "-" && s[i + 1] === "-") {
      let j = i + 2;
      while (j < n && s[j] !== "\n") j++;
      push("comment", s.slice(i, j));
      i = j;
      continue;
    }

    // MySQL # line comment
    if (ch === "#" && (dialect === "mysql" || dialect === "ansi")) {
      let j = i + 1;
      while (j < n && s[j] !== "\n") j++;
      push("comment", s.slice(i, j));
      i = j;
      continue;
    }

    // Block comment /* */ (with PostgreSQL-style nesting)
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

    // Single-quoted string literal '…' ('' is an escaped quote)
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

    // Double-quoted: identifier (ansi/pg/sqlite/tsql) or string (mysql-default)
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

    // MySQL backtick identifier
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

    // T-SQL [bracket] identifier
    if (ch === "[" && (dialect === "sqlserver" || dialect === "ansi")) {
      let j = i + 1;
      while (j < n && s[j] !== "]") j++;
      if (j < n) j++; // include ]
      push("identifier", s.slice(i, j));
      i = j;
      continue;
    }

    // Number: digits, optional decimal, optional exponent, optional trailing identifier
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

    // Identifier or keyword
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentPart(s[j])) j++;
      const value = s.slice(i, j);
      push(KEYWORDS.has(value.toUpperCase()) ? "keyword" : "identifier", value);
      i = j;
      continue;
    }

    // Multi-char operators
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

    // Single-char punctuation / operators
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

    // Unknown character — emit as punctuation so we don't lose it
    push("punctuation", ch);
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Case helpers
// ---------------------------------------------------------------------------

export function applyCase(value: string, mode: "upper" | "lower" | "preserve"): string {
  if (mode === "upper") return value.toUpperCase();
  if (mode === "lower") return value.toLowerCase();
  return value;
}

export function isKeyword(word: string): boolean {
  return KEYWORDS.has((word ?? "").toUpperCase());
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function indentString(opts: FormatOptions, level: number): string {
  if (level <= 0) return "";
  return opts.indent === "tabs"
    ? "\t".repeat(level)
    : " ".repeat(Math.max(0, opts.indentSize) * level);
}

/** Returns true if the previous significant (non-whitespace) token exists. */
function hasPrevSig(out: Token[]): boolean {
  return out.length > 0;
}

/** Last significant token (skipping whitespace). */
function lastSig(tokens: Token[]): Token | null {
  for (let k = tokens.length - 1; k >= 0; k--) {
    if (tokens[k].type !== "whitespace") return tokens[k];
  }
  return null;
}

/**
 * Format a SQL string according to the supplied options.
 *
 * Strategy: tokenize → drop whitespace → walk tokens building a list of
 * output lines, applying indent / newline / case rules.
 */
export function formatSql(input: string, opts: FormatOptions = DEFAULT_OPTIONS): FormatResult {
  if (input == null) return { ok: false, error: "Input is null." };
  const trimmed = input;
  if (!trimmed.trim()) {
    return {
      ok: true,
      output: "",
      stats: {
        inputBytes: 0, outputBytes: 0,
        inputLines: 0, outputLines: 0, tokenCount: 0,
      },
    };
  }

  // Validate first (balanced quotes/parens, etc.).
  const v = validateSql(trimmed);
  if (!v.ok) return { ok: false, error: v.error };

  let toks: Token[];
  try {
    toks = tokenizeSql(trimmed, opts.dialect).filter((t) => t.type !== "whitespace");
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Tokenize failed" };
  }

  if (!opts.preserveComments) {
    toks = toks.filter((t) => t.type !== "comment");
  }

  // Output buffer: array of lines.
  const lines: string[] = [];
  let cur = "";
  let indent = 0;
  let inSelectList = false; // between SELECT and FROM
  let selectColStart = 0;   // index in `cur` where current column starts (for alignment)
  const colWidths: number[] = []; // recorded for alignment (best-effort)

  const startNewLine = (): void => {
    if (cur.trim() !== "") lines.push(cur);
    cur = indentString(opts, indent);
  };

  const ensureSpace = (): void => {
    if (cur !== "" && !cur.endsWith(" ") && !cur.endsWith("\t") && !cur.endsWith("(") && !cur.endsWith(".")) {
      cur += " ";
    }
  };

  // Initialize first line with current indent (0).
  cur = "";

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    const next = toks[i + 1] ?? null;
    const prev = i > 0 ? toks[i - 1] : null;

    // ----- Comments: always on their own line -----
    if (tok.type === "comment") {
      if (cur.trim() !== "") startNewLine();
      cur += tok.value;
      startNewLine();
      cur = indentString(opts, indent);
      continue;
    }

    // ----- Major clause keyword: newline before (unless combiner) -----
    if (
      tok.type === "keyword" &&
      opts.newLineBeforeClause &&
      MAJOR_CLAUSE.has(tok.upper) &&
      !COMBINER.has(tok.upper) &&
      cur.trim() !== ""
    ) {
      // End previous line.
      startNewLine();
      cur = indentString(opts, indent);
    }

    // ----- Open paren: increase indent if subquery starts -----
    if (tok.type === "punctuation" && tok.value === "(") {
      // Detect subquery: next significant token is SELECT or VALUES, or
      // previous significant token is a keyword like IN/EXISTS/VALUES.
      const startsSubquery =
        next !== null && next.type === "keyword" &&
        (next.upper === "SELECT" || next.upper === "VALUES" || next.upper === "WITH");
      const afterKeyword = prev !== null && prev.type === "keyword" &&
        (prev.upper === "IN" || prev.upper === "EXISTS" || prev.upper === "VALUES");

      // No space before "(" if previous is identifier (function call) or "." or "(".
      if (prev !== null) {
        if (prev.type === "identifier" || prev.value === "." || prev.value === "(") {
          // no space
        } else {
          ensureSpace();
        }
      }
      cur += "(";
      if (startsSubquery || afterKeyword) {
        indent++;
        startNewLine();
        cur = indentString(opts, indent);
      }
      continue;
    }

    // ----- Close paren: dedent if matching open was a subquery -----
    if (tok.type === "punctuation" && tok.value === ")") {
      // Heuristic: if we are indented and the current line is just indent,
      // or the previous token was ")" or a keyword, dedent.
      if (indent > 0 && (cur.trim() === "" || cur.trim() === ")")) {
        indent--;
        startNewLine();
        cur = indentString(opts, indent) + ")";
        // After closing a subquery, exit SELECT list.
        inSelectList = false;
        continue;
      }
      // Inline close paren (function args / value list)
      cur += ")";
      inSelectList = false;
      continue;
    }

    // ----- Comma -----
    if (tok.type === "punctuation" && tok.value === ",") {
      if (inSelectList && opts.newLineBeforeClause) {
        if (opts.commaStyle === "trailing") {
          cur += ",";
          // record column width for alignment
          const colLen = cur.length - selectColStart;
          colWidths.push(colLen);
          startNewLine();
          cur = indentString(opts, indent);
          selectColStart = cur.length;
        } else {
          // leading comma: end current line, start new line with comma
          startNewLine();
          cur = indentString(opts, indent) + ",";
          ensureSpace();
          selectColStart = cur.length;
        }
      } else {
        cur += ",";
        if (next !== null && next.type !== "punctuation") ensureSpace();
      }
      continue;
    }

    // ----- Semicolon: end of statement -----
    if (tok.type === "punctuation" && tok.value === ";") {
      cur += ";";
      inSelectList = false;
      // blank line between statements
      startNewLine();
      cur = "";
      lines.push("");
      cur = indentString(opts, indent);
      continue;
    }

    // ----- Dot (schema.table) -----
    if (tok.type === "punctuation" && tok.value === ".") {
      cur += ".";
      continue;
    }

    // ----- Keyword -----
    if (tok.type === "keyword") {
      ensureSpace();
      cur += applyCase(tok.value, opts.keywordCase);

      // Track SELECT-list mode.
      if (tok.upper === "SELECT") {
        inSelectList = true;
        selectColStart = cur.length + 1; // space after SELECT
      } else if (tok.upper === "FROM" || tok.upper === "INTO") {
        inSelectList = false;
      }
      continue;
    }

    // ----- Identifier -----
    if (tok.type === "identifier") {
      ensureSpace();
      cur += applyCase(tok.value, opts.identifierCase);
      continue;
    }

    // ----- String literal -----
    if (tok.type === "string") {
      ensureSpace();
      cur += tok.value;
      continue;
    }

    // ----- Number -----
    if (tok.type === "number") {
      ensureSpace();
      cur += tok.value;
      continue;
    }

    // ----- Operator -----
    if (tok.type === "operator") {
      // Unary minus / plus before number or identifier? Heuristic: if prev is
      // null, operator, open-paren, comma, or keyword (some), no space before.
      const unary =
        (tok.value === "-" || tok.value === "+") &&
        (prev === null ||
          prev.value === "(" ||
          prev.value === "," ||
          prev.type === "operator" ||
          (prev.type === "keyword" && (prev.upper === "BY" || prev.upper === "WHERE" || prev.upper === "AND" || prev.upper === "OR")));
      if (!unary) ensureSpace();
      cur += opts.uppercaseOperators ? tok.value.toUpperCase() : tok.value;
      if (!unary) {
        // space after handled by next token's ensureSpace
      }
      continue;
    }

    // ----- Punctuation fallback -----
    cur += tok.value;
  }

  if (cur.trim() !== "") lines.push(cur);

  // Apply SELECT-column alignment (best effort): pad columns to max width.
  // We currently don't track per-column alignment deeply; if option is on,
  // we at least ensure consistent trailing comma placement which is already
  // handled above. Future enhancement: implement full column alignment.
  void opts.alignSelectColumns;
  void colWidths;
  void hasPrevSig;
  void lastSig;

  const output = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/gm, "") + "\n";

  return {
    ok: true,
    output,
    stats: {
      inputBytes: input.length,
      outputBytes: output.length,
      inputLines: input.split(/\r?\n/).length,
      outputLines: output.split(/\r?\n/).length,
      tokenCount: toks.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Validator (lightweight sanity check — never rejects SQL, just flags obvious
// imbalances)
// ---------------------------------------------------------------------------

export function validateSql(input: string): { ok: true; warnings: string[] } | { ok: false; error: string } {
  if (input == null) return { ok: false, error: "Input is null." };
  if (!input.trim()) return { ok: false, error: "Input is empty." };

  const warnings: string[] = [];
  let parenDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBlockComment = 0;
  let inLineComment = false;
  let prevCh = "";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      prevCh = ch;
      continue;
    }
    if (inBlockComment > 0) {
      if (ch === "*" && input[i + 1] === "/") { inBlockComment--; i++; }
      else if (ch === "/" && input[i + 1] === "*") { inBlockComment++; i++; }
      prevCh = ch;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        if (input[i + 1] === "'") { i++; }
        else inSingle = false;
      }
      prevCh = ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        if (input[i + 1] === '"') { i++; }
        else inDouble = false;
      }
      prevCh = ch;
      continue;
    }
    if (inBacktick) {
      if (ch === "`") {
        if (input[i + 1] === "`") { i++; }
        else inBacktick = false;
      }
      prevCh = ch;
      continue;
    }

    if (ch === "-" && input[i + 1] === "-") { inLineComment = true; i++; continue; }
    if (ch === "/" && input[i + 1] === "*") { inBlockComment++; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === "`") { inBacktick = true; continue; }
    if (ch === "(") parenDepth++;
    if (ch === ")") {
      parenDepth--;
      if (parenDepth < 0) {
        return { ok: false, error: `Unbalanced ')' at offset ${i}.` };
      }
    }
    prevCh = ch;
  }

  if (inSingle) return { ok: false, error: "Unterminated single-quoted string literal." };
  if (inDouble) return { ok: false, error: "Unterminated double-quoted string literal." };
  if (inBacktick) return { ok: false, error: "Unterminated backtick-quoted identifier." };
  if (inBlockComment > 0) return { ok: false, error: "Unterminated block comment." };
  if (parenDepth !== 0) return { ok: false, error: `Unbalanced parentheses (depth ${parenDepth}).` };

  void prevCh;
  void warnings;
  return { ok: true, warnings: [] };
}

// ---------------------------------------------------------------------------
// Stats (input only — useful for the UI when output not yet computed)
// ---------------------------------------------------------------------------

export function computeInputStats(input: string): {
  bytes: number;
  lines: number;
  statements: number;
} {
  if (!input) return { bytes: 0, lines: 0, statements: 0 };
  const lines = input.split(/\r?\n/).length;
  // Count statements by semicolons outside strings/comments (approximate).
  const v = validateSql(input);
  if (!v.ok) return { bytes: input.length, lines, statements: 0 };
  const tokens = tokenizeSql(input).filter((t) => t.type === "punctuation" && t.value === ";");
  const statements = tokens.length === 0 ? (input.trim() ? 1 : 0) : tokens.length;
  return { bytes: input.length, lines, statements };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-formatter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dialect: SqlDialect;
  keywordCase: KeywordCase;
  commaStyle: CommaStyle;
  inputPreview: string;
  outputPreview: string;
  inputBytes: number;
  outputBytes: number;
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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: FormatOptions): string {
  const params = new URLSearchParams();
  params.set("d", opts.dialect);
  params.set("kc", opts.keywordCase);
  params.set("ic", opts.identifierCase);
  params.set("ind", opts.indent);
  params.set("is", String(opts.indentSize));
  params.set("cs", opts.commaStyle);
  params.set("nl", opts.newLineBeforeClause ? "1" : "0");
  params.set("al", opts.alignSelectColumns ? "1" : "0");
  params.set("pc", opts.preserveComments ? "1" : "0");
  params.set("uo", opts.uppercaseOperators ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): FormatOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: FormatOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (d && (["ansi", "mysql", "postgresql", "sqlite", "sqlserver"] as SqlDialect[]).includes(d as SqlDialect)) {
    base.dialect = d as SqlDialect;
  }
  const kc = params.get("kc");
  if (kc && (["upper", "lower", "preserve"] as KeywordCase[]).includes(kc as KeywordCase)) {
    base.keywordCase = kc as KeywordCase;
  }
  const ic = params.get("ic");
  if (ic && (["preserve", "upper", "lower"] as IdentifierCase[]).includes(ic as IdentifierCase)) {
    base.identifierCase = ic as IdentifierCase;
  }
  const ind = params.get("ind");
  if (ind && (["spaces", "tabs"] as IndentStyle[]).includes(ind as IndentStyle)) {
    base.indent = ind as IndentStyle;
  }
  const is = Number(params.get("is"));
  if (Number.isFinite(is) && is >= 1 && is <= 16) base.indentSize = is;
  const cs = params.get("cs");
  if (cs && (["trailing", "leading"] as CommaStyle[]).includes(cs as CommaStyle)) {
    base.commaStyle = cs as CommaStyle;
  }
  if (params.get("nl") === "0") base.newLineBeforeClause = false;
  if (params.get("nl") === "1") base.newLineBeforeClause = true;
  if (params.get("al") === "1") base.alignSelectColumns = true;
  if (params.get("pc") === "0") base.preserveComments = false;
  if (params.get("uo") === "1") base.uppercaseOperators = true;
  return base;
}

// ---------------------------------------------------------------------------
// Sample SQL for the "Load sample" button
// ---------------------------------------------------------------------------

export const SAMPLE_SQL = `-- Sample SQL for formatting
select u.id, u.name, count(o.id) as order_count, sum(o.total) as revenue
from users u
left join orders o on o.user_id = u.id and o.status != 'cancelled'
where u.created_at >= '2024-01-01' and u.deleted_at is null
group by u.id, u.name
having count(o.id) > 5
order by revenue desc
limit 10;`;
