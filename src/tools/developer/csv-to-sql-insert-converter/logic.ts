/**
 * CSV to SQL INSERT Converter — pure logic.
 *
 * Parses RFC 4180 CSV (handling embedded quotes, commas, and newlines),
 * infers per-column types (integer/decimal/boolean/date/text), and emits
 * dialect-aware INSERT statements — optionally batched, with NULL handling,
 * an optional CREATE TABLE, and an UPSERT mode for the major dialects.
 *
 * 100% client-side; no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SqlDialect = "ansi" | "mysql" | "postgresql" | "sqlite" | "sqlserver";

export type InsertMode = "single" | "batched" | "upsert";

export type ColumnType = "integer" | "decimal" | "boolean" | "date" | "text";

export type Delimiter = "," | ";" | "\t" | "|";

export interface ConvertOptions {
  dialect: SqlDialect;
  tableName: string;
  hasHeader: boolean;
  delimiter: Delimiter | "auto";
  /** Rows per INSERT statement in batched mode. */
  batchSize: number;
  mode: InsertMode;
  /** Token that represents NULL in the CSV (case-insensitive). Default "NULL". */
  nullToken: string;
  /** Treat empty cells as NULL. */
  emptyAsNull: boolean;
  /** Generate a CREATE TABLE before the INSERTs. */
  includeCreateTable: boolean;
  /** Wrap identifiers in dialect-appropriate quotes. */
  quoteIdentifiers: boolean;
  /** For upsert mode: the conflict column (typically the PK). */
  conflictColumn: string;
}

export interface ConvertStats {
  rowCount: number;
  columnCount: number;
  insertCount: number;
  bytes: number;
  nullCount: number;
  typeCounts: Record<ColumnType, number>;
}

export type ConvertResult =
  | { ok: true; sql: string; stats: ConvertStats; types: ColumnType[]; headers: string[]; rows: string[][] }
  | { ok: false; error: string };

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

export const DELIMITER_OPTIONS: ReadonlyArray<{ value: Delimiter | "auto"; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

export const INSERT_MODES: ReadonlyArray<{ value: InsertMode; label: string }> = [
  { value: "single", label: "Single-row INSERTs" },
  { value: "batched", label: "Batched multi-row INSERTs" },
  { value: "upsert", label: "UPSERT (ON CONFLICT / DUPLICATE KEY)" },
];

export const DEFAULT_OPTIONS: ConvertOptions = {
  dialect: "ansi",
  tableName: "my_table",
  hasHeader: true,
  delimiter: "auto",
  batchSize: 100,
  mode: "batched",
  nullToken: "NULL",
  emptyAsNull: true,
  includeCreateTable: true,
  quoteIdentifiers: false,
  conflictColumn: "id",
};

export const TYPE_LABELS: Record<ColumnType, string> = {
  integer: "INTEGER",
  decimal: "DECIMAL",
  boolean: "BOOLEAN",
  date: "DATE",
  text: "TEXT",
};

// ---------------------------------------------------------------------------
// CSV parser (RFC 4180)
// ---------------------------------------------------------------------------

/** Parse RFC 4180 CSV into a 2D array of strings. Handles quoted fields with
 *  embedded commas, quotes (escaped by doubling), and newlines. */
export function parseCsv(input: string, delimiter: string = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Strip a leading BOM if present.
  const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const n = s.length;
  let lineStarted = false; // true once we've seen any character on this line

  const finalizeRow = (): void => {
    // Push the current field (even if empty) when the line has content or
    // we already have accumulated fields for this row.
    if (lineStarted || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    row = [];
    field = "";
    lineStarted = false;
  };

  while (i < n) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      lineStarted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      lineStarted = true;
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF or lone CR
      finalizeRow();
      if (s[i + 1] === "\n") i += 2; else i++;
      continue;
    }
    if (ch === "\n") {
      finalizeRow();
      i++;
      continue;
    }
    field += ch;
    lineStarted = true;
    i++;
  }
  // Final field/row
  if (lineStarted || row.length > 0 || field.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Auto-detect the most likely delimiter from the first non-empty line. */
export function detectDelimiter(input: string): Delimiter {
  // Get first non-empty line, but be careful — quoted fields can contain commas
  // so we count delimiters outside quotes.
  const candidates: Delimiter[] = [",", ";", "\t", "|"];
  const firstLine = firstUnquotedLine(input);
  if (!firstLine) return ",";
  let best: Delimiter = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = countUnquoted(firstLine, d);
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

function firstUnquotedLine(input: string): string {
  let inQuotes = false;
  let i = 0;
  const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      return s.slice(0, i);
    }
    i++;
  }
  return s;
}

function countUnquoted(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delim && !inQuotes) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

const INT_RE = /^-?\d+$/;
const DEC_RE = /^-?\d+\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Returns true if a value looks like an integer with no leading zeros (unless "0"). */
export function isIntegerLike(value: string): boolean {
  if (!INT_RE.test(value)) return false;
  // Reject leading zeros (zip codes etc.)
  if (value.length > 1 && value.startsWith("0")) return false;
  if (value.length > 2 && value.startsWith("-0")) return false;
  return true;
}

export function isDecimalLike(value: string): boolean {
  if (!DEC_RE.test(value)) return false;
  // Allow "0.5", "-0.5", "1.0", etc. — but reject leading zeros like "007.5".
  const abs = value.startsWith("-") ? value.slice(1) : value;
  if (abs.length > 1 && abs.startsWith("0") && !abs.startsWith("0.")) return false;
  return true;
}

export function isBooleanLike(value: string): boolean {
  const v = value.toLowerCase();
  return v === "true" || v === "false";
}

export function isDateLike(value: string): boolean {
  return DATE_RE.test(value) || DATE_TIME_RE.test(value);
}

/** Infer a column type from a sample of values (skipping NULLs / empties). */
export function inferColumnType(values: string[], nullToken: string = "NULL", emptyAsNull: boolean = true): ColumnType {
  const nonNull = values.filter((v) => !isNullValue(v, nullToken, emptyAsNull));
  if (nonNull.length === 0) return "text";

  let allInt = true, allDec = true, allBool = true, allDate = true;
  for (const v of nonNull) {
    if (allInt && !isIntegerLike(v)) allInt = false;
    if (allDec && !isIntegerLike(v) && !isDecimalLike(v)) allDec = false;
    if (allBool && !isBooleanLike(v)) allBool = false;
    if (allDate && !isDateLike(v)) allDate = false;
  }
  if (allInt) return "integer";
  if (allDec) return "decimal";
  if (allBool) return "boolean";
  if (allDate) return "date";
  return "text";
}

/** Infer types for every column in a row set. */
export function inferColumnTypes(rows: string[][], hasHeader: boolean, nullToken: string, emptyAsNull: boolean): ColumnType[] {
  if (rows.length === 0) return [];
  const colCount = rows[0].length;
  const types: ColumnType[] = [];
  const dataStart = hasHeader ? 1 : 0;
  for (let c = 0; c < colCount; c++) {
    const col = rows.slice(dataStart).map((r) => r[c] ?? "");
    types.push(inferColumnType(col, nullToken, emptyAsNull));
  }
  return types;
}

/** Is this cell value considered NULL? */
export function isNullValue(value: string, nullToken: string, emptyAsNull: boolean): boolean {
  if (value === null) return true;
  if (emptyAsNull && value === "") return true;
  if (nullToken && value.toLowerCase() === nullToken.toLowerCase()) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Dialect helpers
// ---------------------------------------------------------------------------

/** Escape a string literal value for the given dialect. */
export function escapeString(value: string, dialect: SqlDialect): string {
  if (dialect === "mysql") {
    // MySQL supports backslash escapes; escape backslash then single quote.
    return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }
  // ANSI / PostgreSQL / SQLite / SQL Server — double the single quote.
  return "'" + value.replace(/'/g, "''") + "'";
}

/** Quote an identifier if quoteIdentifiers is on, using dialect-appropriate quotes. */
export function quoteIdentifier(name: string, dialect: SqlDialect, quote: boolean): string {
  if (!quote) return name;
  if (dialect === "mysql") return "`" + name.replace(/`/g, "``") + "`";
  if (dialect === "sqlserver") return "[" + name.replace(/]/g, "]]") + "]";
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Format a cell value as a SQL literal, applying NULL handling and type rules. */
export function formatValue(
  value: string,
  type: ColumnType,
  dialect: SqlDialect,
  opts: ConvertOptions,
): string {
  if (isNullValue(value, opts.nullToken, opts.emptyAsNull)) return "NULL";
  switch (type) {
    case "integer":
    case "decimal":
      // Emit the numeric literal unquoted.
      return value;
    case "boolean":
      if (dialect === "sqlserver") {
        return value.toLowerCase() === "true" ? "1" : "0";
      }
      return value.toLowerCase() === "true" ? "TRUE" : "FALSE";
    case "date":
      return escapeString(value, dialect);
    case "text":
    default:
      return escapeString(value, dialect);
  }
}

/** Map an inferred type to a column DDL type for CREATE TABLE. */
export function ddlType(type: ColumnType, dialect: SqlDialect): string {
  switch (type) {
    case "integer": return dialect === "sqlserver" ? "BIGINT" : "BIGINT";
    case "decimal": return "DECIMAL(18,6)";
    case "boolean": return dialect === "sqlserver" ? "BIT" : "BOOLEAN";
    case "date": return "TEXT"; // We can't tell DATE vs TIMESTAMP from inference alone.
    case "text":
    default: return "TEXT";
  }
}

// ---------------------------------------------------------------------------
// CREATE TABLE
// ---------------------------------------------------------------------------

export function generateCreateTable(
  tableName: string,
  headers: string[],
  types: ColumnType[],
  dialect: SqlDialect,
  opts: ConvertOptions,
): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE ${quoteIdentifier(tableName, dialect, opts.quoteIdentifiers)} (`);
  const cols: string[] = headers.map((h, i) => {
    const t = types[i] ?? "text";
    return `  ${quoteIdentifier(h, dialect, opts.quoteIdentifiers)} ${ddlType(t, dialect)}`;
  });
  lines.push(cols.join(",\n"));
  lines.push(");");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// INSERT generation
// ---------------------------------------------------------------------------

/** Generate the column list clause: (col1, col2, ...) — quoted per opts. */
export function columnList(headers: string[], dialect: SqlDialect, opts: ConvertOptions): string {
  return "(" + headers.map((h) => quoteIdentifier(h, dialect, opts.quoteIdentifiers)).join(", ") + ")";
}

/** Format one row's VALUES tuple as `(v1, v2, ...)`. */
export function valuesTuple(
  row: string[],
  types: ColumnType[],
  dialect: SqlDialect,
  opts: ConvertOptions,
): string {
  const vals = row.map((v, i) => formatValue(v, types[i] ?? "text", dialect, opts));
  return "(" + vals.join(", ") + ")";
}

/** Generate INSERT (or UPSERT) statements. */
export function generateInserts(
  rows: string[][],
  headers: string[],
  types: ColumnType[],
  opts: ConvertOptions,
): { sql: string; insertCount: number; nullCount: number } {
  if (rows.length === 0) return { sql: "", insertCount: 0, nullCount: 0 };
  const dialect = opts.dialect;
  const table = quoteIdentifier(opts.tableName, dialect, opts.quoteIdentifiers);
  const cols = columnList(headers, dialect, opts);
  const out: string[] = [];
  let insertCount = 0;
  let nullCount = 0;

  // Count NULLs across the data.
  for (const r of rows) {
    for (let i = 0; i < r.length; i++) {
      if (isNullValue(r[i] ?? "", opts.nullToken, opts.emptyAsNull)) nullCount++;
    }
  }

  if (opts.mode === "single") {
    for (const r of rows) {
      const tuple = valuesTuple(r, types, dialect, opts);
      out.push(`INSERT INTO ${table} ${cols} VALUES ${tuple};`);
      insertCount++;
    }
  } else if (opts.mode === "batched") {
    const batch = Math.max(1, opts.batchSize);
    for (let i = 0; i < rows.length; i += batch) {
      const chunk = rows.slice(i, i + batch);
      const tuples = chunk.map((r) => valuesTuple(r, types, dialect, opts)).join(",\n  ");
      out.push(`INSERT INTO ${table} ${cols} VALUES\n  ${tuples};`);
      insertCount++;
    }
  } else {
    // upsert
    if (dialect === "mysql") {
      const batch = Math.max(1, opts.batchSize);
      const updateCols = headers.filter((h) => h !== opts.conflictColumn);
      const updateClause = updateCols.length === 0
        ? "id=VALUES(id)"
        : updateCols.map((h) => `${quoteIdentifier(h, dialect, opts.quoteIdentifiers)}=VALUES(${quoteIdentifier(h, dialect, opts.quoteIdentifiers)})`).join(", ");
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const tuples = chunk.map((r) => valuesTuple(r, types, dialect, opts)).join(",\n  ");
        out.push(`INSERT INTO ${table} ${cols} VALUES\n  ${tuples}\nON DUPLICATE KEY UPDATE ${updateClause};`);
        insertCount++;
      }
    } else if (dialect === "postgresql" || dialect === "sqlite") {
      const batch = Math.max(1, opts.batchSize);
      const updateCols = headers.filter((h) => h !== opts.conflictColumn);
      const updateClause = updateCols.length === 0
        ? "id=EXCLUDED.id"
        : updateCols.map((h) => `${quoteIdentifier(h, dialect, opts.quoteIdentifiers)}=EXCLUDED.${quoteIdentifier(h, dialect, opts.quoteIdentifiers)}`).join(", ");
      const conflictCol = quoteIdentifier(opts.conflictColumn, dialect, opts.quoteIdentifiers);
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const tuples = chunk.map((r) => valuesTuple(r, types, dialect, opts)).join(",\n  ");
        out.push(`INSERT INTO ${table} ${cols} VALUES\n  ${tuples}\nON CONFLICT (${conflictCol}) DO UPDATE SET ${updateClause};`);
        insertCount++;
      }
    } else if (dialect === "sqlserver") {
      // MERGE statement
      const colsCsv = headers.map((h) => quoteIdentifier(h, dialect, opts.quoteIdentifiers)).join(", ");
      const srcCols = headers.map((h) => quoteIdentifier(h, dialect, opts.quoteIdentifiers)).join(", ");
      const conflictCol = quoteIdentifier(opts.conflictColumn, dialect, opts.quoteIdentifiers);
      const updateCols = headers.filter((h) => h !== opts.conflictColumn);
      const setClause = updateCols.length === 0
        ? `${conflictCol} = source.${conflictCol}`
        : updateCols.map((h) => `target.${quoteIdentifier(h, dialect, opts.quoteIdentifiers)} = source.${quoteIdentifier(h, dialect, opts.quoteIdentifiers)}`).join(", ");
      const insertCols = headers.map((h) => quoteIdentifier(h, dialect, opts.quoteIdentifiers)).join(", ");
      const insertVals = headers.map((h) => `source.${quoteIdentifier(h, dialect, opts.quoteIdentifiers)}`).join(", ");
      for (const r of rows) {
        const tuple = valuesTuple(r, types, dialect, opts);
        out.push(
          `MERGE INTO ${table} AS target\n` +
          `USING (SELECT ${tuple.split(",").map((v, idx) => `${v.trim()} AS ${quoteIdentifier(headers[idx], dialect, opts.quoteIdentifiers)}`).join(", ")}) AS source (${srcCols})\n` +
          `ON target.${conflictCol} = source.${conflictCol}\n` +
          `WHEN MATCHED THEN UPDATE SET ${setClause}\n` +
          `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`,
        );
        insertCount++;
      }
    } else {
      // ANSI: fall back to plain batched INSERT.
      const batch = Math.max(1, opts.batchSize);
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const tuples = chunk.map((r) => valuesTuple(r, types, dialect, opts)).join(",\n  ");
        out.push(`INSERT INTO ${table} ${cols} VALUES\n  ${tuples};`);
        insertCount++;
      }
    }
  }

  return { sql: out.join("\n"), insertCount, nullCount };
}

// ---------------------------------------------------------------------------
// Top-level convert
// ---------------------------------------------------------------------------

export function convertCsv(input: string, opts: ConvertOptions = DEFAULT_OPTIONS): ConvertResult {
  if (input == null) return { ok: false, error: "Input is null." };
  const trimmed = input.replace(/^\uFEFF/, "");
  if (!trimmed.trim()) return { ok: false, error: "Input is empty." };

  const delim = opts.delimiter === "auto" ? detectDelimiter(trimmed) : opts.delimiter;
  const allRows = parseCsv(trimmed, delim);
  if (allRows.length === 0) return { ok: false, error: "No rows found." };

  // Normalize ragged rows to the width of the first row.
  const width = allRows[0].length;
  const normRows = allRows.map((r) => {
    if (r.length === width) return r;
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });

  let headers: string[];
  let dataRows: string[][];
  if (opts.hasHeader) {
    headers = normRows[0].map((h, i) => h && h.trim() ? h.trim() : `col${i + 1}`);
    dataRows = normRows.slice(1);
  } else {
    headers = normRows[0].map((_, i) => `col${i + 1}`);
    dataRows = normRows;
  }

  if (dataRows.length === 0) {
    // Still produce a CREATE TABLE-only result.
    const types = opts.hasHeader
      ? inferColumnTypes(normRows, opts.hasHeader, opts.nullToken, opts.emptyAsNull)
      : headers.map(() => "text" as ColumnType);
    const parts: string[] = [];
    if (opts.includeCreateTable) {
      parts.push(generateCreateTable(opts.tableName, headers, types, opts.dialect, opts));
      parts.push("");
    }
    return {
      ok: true,
      sql: parts.join("\n"),
      stats: {
        rowCount: 0, columnCount: headers.length, insertCount: 0, bytes: parts.join("\n").length,
        nullCount: 0,
        typeCounts: countTypes(types),
      },
      types, headers, rows: [],
    };
  }

  const types = inferColumnTypes(normRows, opts.hasHeader, opts.nullToken, opts.emptyAsNull);
  const { sql: insertSql, insertCount, nullCount } = generateInserts(dataRows, headers, types, opts);

  const parts: string[] = [];
  if (opts.includeCreateTable) {
    parts.push(generateCreateTable(opts.tableName, headers, types, opts.dialect, opts));
    parts.push("");
  }
  parts.push(insertSql);

  const sql = parts.join("\n").trim() + "\n";
  return {
    ok: true,
    sql,
    stats: {
      rowCount: dataRows.length,
      columnCount: headers.length,
      insertCount,
      bytes: sql.length,
      nullCount,
      typeCounts: countTypes(types),
    },
    types, headers, rows: dataRows,
  };
}

function countTypes(types: ColumnType[]): Record<ColumnType, number> {
  const out: Record<ColumnType, number> = { integer: 0, decimal: 0, boolean: 0, date: 0, text: 0 };
  for (const t of types) out[t]++;
  return out;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:csv-to-sql-insert-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dialect: SqlDialect;
  mode: InsertMode;
  tableName: string;
  rowCount: number;
  columnCount: number;
  insertCount: number;
  nullCount: number;
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

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  params.set("d", opts.dialect);
  params.set("t", opts.tableName);
  params.set("h", opts.hasHeader ? "1" : "0");
  params.set("del", opts.delimiter);
  params.set("bs", String(opts.batchSize));
  params.set("m", opts.mode);
  params.set("null", opts.nullToken);
  params.set("en", opts.emptyAsNull ? "1" : "0");
  params.set("ct", opts.includeCreateTable ? "1" : "0");
  params.set("qi", opts.quoteIdentifiers ? "1" : "0");
  params.set("cc", opts.conflictColumn);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConvertOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: ConvertOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (d && (["ansi", "mysql", "postgresql", "sqlite", "sqlserver"] as SqlDialect[]).includes(d as SqlDialect)) {
    base.dialect = d as SqlDialect;
  }
  const t = params.get("t");
  if (t) base.tableName = t;
  if (params.get("h") === "0") base.hasHeader = false;
  if (params.get("h") === "1") base.hasHeader = true;
  const del = params.get("del");
  if (del && [",", ";", "\t", "|", "auto"].includes(del)) base.delimiter = del as Delimiter | "auto";
  const bs = parseInt(params.get("bs") ?? "", 10);
  if (!Number.isNaN(bs) && bs > 0) base.batchSize = bs;
  const m = params.get("m");
  if (m && ["single", "batched", "upsert"].includes(m)) base.mode = m as InsertMode;
  const nullTok = params.get("null");
  if (nullTok !== null) base.nullToken = nullTok;
  if (params.get("en") === "0") base.emptyAsNull = false;
  if (params.get("en") === "1") base.emptyAsNull = true;
  if (params.get("ct") === "0") base.includeCreateTable = false;
  if (params.get("ct") === "1") base.includeCreateTable = true;
  if (params.get("qi") === "0") base.quoteIdentifiers = false;
  if (params.get("qi") === "1") base.quoteIdentifiers = true;
  const cc = params.get("cc");
  if (cc) base.conflictColumn = cc;
  return base;
}

// ---------------------------------------------------------------------------
// Sample CSV
// ---------------------------------------------------------------------------

export const SAMPLE_CSV = `id,name,email,age,is_active,created_at,balance
1,Alice Johnson,alice@example.com,30,true,2024-01-15,1250.50
2,Bob Smith,bob@example.com,25,false,2024-02-20,875.00
3,Carol O'Brien,carol@example.com,,true,2024-03-10,0.00
4,Dave Lee,dave@example.com,NULL,true,2024-04-05,3200.75
5,Eve "Eva" Martinez,eve@example.com,28,true,2024-05-12,99.99`;
