/**
 * SQL Result to CSV / JSON Exporter — pure logic.
 *
 * Parses pasted SQL result grids (tab/pipe/comma/whitespace-aligned),
 * INSERT statements (single + multi-row), and Markdown tables — then
 * exports to CSV, JSON (array-of-objects), NDJSON, TSV, Markdown, or HTML
 * table — with type inference, BigInt-safe numerics, NULL disambiguation,
 * per-column rename/reorder/select, configurable CSV quoting + delimiter,
 * and round-trip with #274 (CSV→SQL).
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type InputFormat =
  | "auto"
  | "grid-tab"
  | "grid-pipe"
  | "grid-comma"
  | "grid-whitespace"
  | "insert"
  | "markdown";

export type OutputFormat =
  | "csv"
  | "json"
  | "ndjson"
  | "tsv"
  | "markdown"
  | "html";

export type ColumnType = "integer" | "decimal" | "boolean" | "date" | "text";

export type CsvDelimiter = "," | ";" | "\t" | "|";

export type CsvQuoting = "always" | "never" | "auto";

/** A scalar cell value — typed after inference. */
export type CellValue = number | string | boolean | null;

export interface ColumnDef {
  /** Original name as parsed from the header. */
  name: string;
  /** Optional renamed label for output. */
  label?: string;
  /** Inferred type. */
  type: ColumnType;
}

export interface ParsedResult {
  columns: ColumnDef[];
  /** Row data, parallel to columns — values are raw strings (before type coercion). */
  rows: string[][];
  /** Detected source format. */
  format: InputFormat;
  /** Non-fatal warnings (mismatched column counts, etc.). */
  warnings: string[];
}

export interface ParseOptions {
  format: InputFormat;
  hasHeader: boolean;
  nullToken: string;
  emptyAsNull: boolean;
  delimiter: CsvDelimiter;
}

export interface ExportOptions {
  format: OutputFormat;
  delimiter: CsvDelimiter;
  quoting: CsvQuoting;
  /** Output column order (by original name) — empty = original order. */
  columnOrder: string[];
  /** Column selects to include (by original name) — empty = all. */
  columnSelect: string[];
  /** Rename map (original → label). */
  columnLabels: Record<string, string>;
  /** Pretty-print JSON. */
  prettyJson: boolean;
  /** Include header row in CSV/TSV output. */
  includeHeader: boolean;
  /** NULL token used in TSV output. */
  tsvNullToken: string;
}

export interface ConvertStats {
  rowCount: number;
  columnCount: number;
  outputBytes: number;
  nullCount: number;
  typesByColumn: Record<string, ColumnType>;
}

export interface HistoryEntry {
  ts: number;
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
  rowCount: number;
  columnCount: number;
  outputBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INPUT_FORMATS: InputFormat[] = [
  "auto",
  "grid-tab",
  "grid-pipe",
  "grid-comma",
  "grid-whitespace",
  "insert",
  "markdown",
];

export const OUTPUT_FORMATS: OutputFormat[] = [
  "csv", "json", "ndjson", "tsv", "markdown", "html",
];

export const DEFAULT_PARSE: ParseOptions = {
  format: "auto",
  hasHeader: true,
  nullToken: "NULL",
  emptyAsNull: true,
  delimiter: ",",
};

export const DEFAULT_EXPORT: ExportOptions = {
  format: "csv",
  delimiter: ",",
  quoting: "auto",
  columnOrder: [],
  columnSelect: [],
  columnLabels: {},
  prettyJson: true,
  includeHeader: true,
  tsvNullToken: "\\N",
};

// ---------------------------------------------------------------------------
// Input-format detection
// ---------------------------------------------------------------------------

/** Detect the most likely input format from raw text. */
export function detectInputFormat(text: string): InputFormat {
  const t = (text || "").trim();
  if (!t) return "grid-tab";
  // INSERT statements (case-insensitive)
  if (/^\s*insert\s+into\s+/im.test(t)) return "insert";
  // Markdown table: a line containing |, then a separator line of dashes
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2 && /^\s*\|/.test(lines[0]) && /^\s*\|?\s*:?-{3,}/.test(lines[1])) {
    return "markdown";
  }
  // Tab-separated (most common from DB clients like DBeaver/psql)
  if (lines.some((l) => l.includes("\t"))) return "grid-tab";
  // Pipe-separated (MySQL CLI default)
  if (lines.some((l) => l.includes("|")) && lines.every((l) => (l.match(/\|/g) || []).length >= 2 || !l.trim())) {
    return "grid-pipe";
  }
  // Comma-separated
  if (lines.every((l) => (l.match(/,/g) || []).length >= 2 || !l.trim())) {
    return "grid-comma";
  }
  // Whitespace-aligned columns (aligned by multiple spaces)
  if (lines.some((l) => /\s{2,}/.test(l))) return "grid-whitespace";
  return "grid-tab";
}

// ---------------------------------------------------------------------------
// Grid parsers
// ---------------------------------------------------------------------------

/** Parse a delimiter-separated grid (tab / pipe / comma). */
export function parseGrid(text: string, delimiter: CsvDelimiter | "auto" = "auto", opts: ParseOptions = DEFAULT_PARSE): ParsedResult {
  const warnings: string[] = [];
  const raw = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [], format: opts.format, warnings };

  const delim: string = delimiter === "auto"
    ? (opts.format === "grid-pipe" ? "|" : opts.format === "grid-comma" ? "," : opts.format === "grid-tab" ? "\t" : "\t")
    : delimiter;

  // Parse each line into cells, handling RFC 4180 quotes when delim is comma/semicolon
  const useRfc = delim === "," || delim === ";";
  const parsedLines: string[][] = [];
  for (const line of lines) {
    if (useRfc) parsedLines.push(splitQuotedRow(line, delim));
    else if (delim === "|") parsedLines.push(splitPipeRow(line));
    else parsedLines.push(line.split(delim).map((c) => c.trim()));
  }

  const headerCells = opts.hasHeader ? parsedLines.shift()!.map((c) => c.trim()) : makeAutoHeader(parsedLines[0]?.length ?? 0);
  const dataRows = opts.hasHeader ? parsedLines : parsedLines;
  const colCount = headerCells.length;
  const rows: string[][] = [];
  for (const r of dataRows) {
    if (r.length === 0) continue;
    if (r.length !== colCount) {
      warnings.push(`Row has ${r.length} cells; expected ${colCount}. Padded/truncated.`);
    }
    const norm = r.slice(0, colCount);
    while (norm.length < colCount) norm.push("");
    rows.push(norm);
  }

  const columns = headerCells.map((name) => ({ name, type: "text" as ColumnType }));
  return { columns, rows, format: opts.format, warnings };
}

/** Parse a whitespace-aligned grid (e.g. psql expanded output or aligned tables). */
export function parseWhitespaceGrid(text: string, opts: ParseOptions = DEFAULT_PARSE): ParsedResult {
  const warnings: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [], format: "grid-whitespace", warnings };
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = line.trim().split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length > 0) rows.push(cells);
  }
  const headerCells = opts.hasHeader ? rows.shift()! : makeAutoHeader(rows[0]?.length ?? 0);
  const colCount = headerCells.length;
  const dataRows = opts.hasHeader ? rows : rows;
  const columns = headerCells.map((name) => ({ name, type: "text" as ColumnType }));
  const normRows = dataRows.map((r) => {
    if (r.length !== colCount) warnings.push(`Row has ${r.length} cells; expected ${colCount}.`);
    const norm = r.slice(0, colCount);
    while (norm.length < colCount) norm.push("");
    return norm;
  });
  return { columns, rows: normRows, format: "grid-whitespace", warnings };
}

/** Parse a Markdown table. */
export function parseMarkdownTable(text: string, opts: ParseOptions = DEFAULT_PARSE): ParsedResult {
  const warnings: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return { columns: [], rows: [], format: "markdown", warnings: ["Not a valid Markdown table."] };

  const splitMd = (line: string): string[] =>
    line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

  const headerCells = splitMd(lines[0]);
  // skip separator (line[1])
  const dataLines = lines.slice(2);
  const rows = dataLines.map((line) => {
    const cells = splitMd(line);
    if (cells.length !== headerCells.length) warnings.push(`Row has ${cells.length} cells; expected ${headerCells.length}.`);
    const norm = cells.slice(0, headerCells.length);
    while (norm.length < headerCells.length) norm.push("");
    return norm;
  });
  const columns = headerCells.map((name) => ({ name, type: "text" as ColumnType }));
  return { columns, rows, format: "markdown", warnings };
}

// ---------------------------------------------------------------------------
// INSERT-statement parser
// ---------------------------------------------------------------------------

/** Parse one or more INSERT statements into a ParsedResult. */
export function parseInsertStatements(text: string, opts: ParseOptions = DEFAULT_PARSE): ParsedResult {
  const warnings: string[] = [];
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { columns: [], rows: [], format: "insert", warnings };
  // Find all INSERT INTO statements
  const re = /insert\s+into\s+(\w+)\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi;
  const matches = Array.from(clean.matchAll(re));
  if (matches.length === 0) {
    // Try without explicit column list
    const re2 = /insert\s+into\s+(\w+)\s*values\s*([\s\S]*?);/gi;
    const m2 = Array.from(clean.matchAll(re2));
    if (m2.length === 0) {
      return { columns: [], rows: [], format: "insert", warnings: ["No INSERT statements found."] };
    }
    // Without column list we can't build columns from the header — derive from first row tuple count.
    const tableName = m2[0][1];
    const allRows: string[][] = [];
    for (const m of m2) {
      const tuples = parseValueTuples(m[2]);
      allRows.push(...tuples);
    }
    const colCount = allRows[0]?.length ?? 0;
    const headerCells = makeAutoHeader(colCount);
    const columns = headerCells.map((name, i) => ({ name, type: inferColumnType(allRows.map((r) => r[i] ?? "")) }));
    return { columns, rows: allRows, format: "insert", warnings };
  }
  // Parse with column lists — assume all INSERTs target the same table/columns
  const tableName = matches[0][1];
  void tableName;
  const headerCells = matches[0][2].split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const colCount = headerCells.length;
  const allRows: string[][] = [];
  for (const m of matches) {
    const cols = m[2].split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    if (cols.length !== colCount) {
      warnings.push(`INSERT column count ${cols.length} differs from first INSERT (${colCount}).`);
    }
    const tuples = parseValueTuples(m[3]);
    for (const t of tuples) {
      if (t.length !== colCount) warnings.push(`Tuple has ${t.length} values; expected ${colCount}.`);
      const norm = t.slice(0, colCount);
      while (norm.length < colCount) norm.push("");
      allRows.push(norm);
    }
  }
  const columns = headerCells.map((name, i) => ({ name, type: inferColumnType(allRows.map((r) => r[i] ?? "")) }));
  return { columns, rows: allRows, format: "insert", warnings };
}

/** Parse "VALUES (1,'a'),(2,'b')" into [["1","'a'"],["2","'b'"]]. */
function parseValueTuples(valuesClause: string): string[][] {
  const tuples: string[][] = [];
  let i = 0;
  const s = valuesClause.trim();
  while (i < s.length) {
    // skip whitespace and commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length || s[i] !== "(") break;
    i++; // skip (
    const cells: string[] = [];
    let current = "";
    let inStr = false;
    let strQuote = "";
    while (i < s.length) {
      const ch = s[i];
      if (inStr) {
        if (ch === "\\") { current += ch + (s[i + 1] ?? ""); i += 2; continue; }
        if (ch === strQuote) {
          // doubled quote escape — preserve both quotes in the raw value
          if (s[i + 1] === strQuote) { current += ch + s[i + 1]; i += 2; continue; }
          inStr = false; current += ch; i++; continue;
        }
        current += ch; i++; continue;
      } else {
        if (ch === "'" || ch === '"') { inStr = true; strQuote = ch; current += ch; i++; continue; }
        if (ch === ",") { cells.push(current.trim()); current = ""; i++; continue; }
        if (ch === ")") { cells.push(current.trim()); i++; break; }
        current += ch; i++;
      }
    }
    tuples.push(cells);
    i++; // skip )
  }
  return tuples;
}

// ---------------------------------------------------------------------------
// Format dispatcher
// ---------------------------------------------------------------------------

/** Parse input text using the configured format (auto-detect if "auto"). */
export function parseInput(text: string, opts: ParseOptions = DEFAULT_PARSE): ParsedResult {
  const fmt = opts.format === "auto" ? detectInputFormat(text) : opts.format;
  const o: ParseOptions = { ...opts, format: fmt };
  let result: ParsedResult;
  switch (fmt) {
    case "insert": result = parseInsertStatements(text, o); break;
    case "markdown": result = parseMarkdownTable(text, o); break;
    case "grid-whitespace": result = parseWhitespaceGrid(text, o); break;
    case "grid-pipe": result = parseGrid(text, "|", o); break;
    case "grid-comma": result = parseGrid(text, ",", o); break;
    case "grid-tab": result = parseGrid(text, "\t", o); break;
    default: result = parseGrid(text, "auto", o); break;
  }
  // infer types
  result.columns = result.columns.map((c, idx) => ({ ...c, type: inferColumnType(result.rows.map((r) => r[idx] ?? "")) }));
  return result;
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

const INT_RE = /^[+-]?\d+$/;
const DEC_RE = /^[+-]?(\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/;
const BOOL_RE = /^(true|false)$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Infer the column type from sample values. NULL/empty cells are skipped. */
export function inferColumnType(values: string[], nullToken = "NULL"): ColumnType {
  let isInt = true, isDec = true, isBool = true, isDate = true;
  let any = false;
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    if (t.toLowerCase() === nullToken.toLowerCase()) continue;
    any = true;
    if (isInt && !INT_RE.test(t)) isInt = false;
    if (isDec && !DEC_RE.test(t)) isDec = false;
    if (isBool && !BOOL_RE.test(t)) isBool = false;
    if (isDate && !DATE_RE.test(t)) isDate = false;
    if (!isInt && !isDec && !isBool && !isDate) break;
  }
  if (!any) return "text";
  if (isInt) return "integer";
  if (isBool) return "boolean";
  if (isDate) return "date";
  if (isDec) return "decimal";
  return "text";
}

/** Coerce a raw string cell to a typed CellValue. */
export function coerceValue(raw: string, type: ColumnType, opts: ParseOptions): CellValue {
  const t = (raw ?? "").trim();
  if (!t) return opts.emptyAsNull ? null : "";
  if (t.toLowerCase() === opts.nullToken.toLowerCase()) return null;
  switch (type) {
    case "integer": {
      if (!INT_RE.test(t)) return t;
      const n = Number(t);
      // BigInt-safe: integers outside Number.MAX_SAFE_INTEGER stay as string
      if (!Number.isSafeInteger(n)) return t;
      return n;
    }
    case "decimal": {
      if (!DEC_RE.test(t)) return t;
      const n = Number(t);
      return Number.isFinite(n) ? n : t;
    }
    case "boolean": {
      const lower = t.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
      return t;
    }
    case "date":
      return t;
    default:
      return t;
  }
}

// ---------------------------------------------------------------------------
// Column transforms
// ---------------------------------------------------------------------------

/** Reorder/select columns by original name. */
export function transformColumns(result: ParsedResult, opts: ExportOptions): ParsedResult {
  const order = opts.columnSelect.length > 0
    ? opts.columnSelect
    : (opts.columnOrder.length > 0 ? opts.columnOrder : result.columns.map((c) => c.name));
  const idxMap: number[] = [];
  const newCols: ColumnDef[] = [];
  for (const name of order) {
    const idx = result.columns.findIndex((c) => c.name === name);
    if (idx === -1) continue;
    idxMap.push(idx);
    newCols.push({
      ...result.columns[idx],
      label: opts.columnLabels[name] ?? result.columns[idx].label,
    });
  }
  const newRows = result.rows.map((r) => idxMap.map((i) => r[i] ?? ""));
  return { ...result, columns: newCols, rows: newRows };
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render as CSV (RFC 4180). */
export function toCsv(result: ParsedResult, opts: ExportOptions): string {
  const delim = opts.delimiter;
  const lines: string[] = [];
  if (opts.includeHeader) {
    lines.push(result.columns.map((c) => quote(c.label ?? c.name, delim, opts.quoting)).join(delim));
  }
  for (const row of result.rows) {
    lines.push(row.map((c) => quote(c, delim, opts.quoting)).join(delim));
  }
  return lines.join("\n");
}

/** Render as TSV. NULL → tsvNullToken (default "\\N"). */
export function toTsv(result: ParsedResult, opts: ExportOptions): string {
  const lines: string[] = [];
  if (opts.includeHeader) {
    lines.push(result.columns.map((c) => tsvEscape(c.label ?? c.name)).join("\t"));
  }
  for (const row of result.rows) {
    lines.push(row.map((c) => {
      if (c.trim().toLowerCase() === "null") return opts.tsvNullToken;
      if (c === "") return opts.tsvNullToken;
      return tsvEscape(c);
    }).join("\t"));
  }
  return lines.join("\n");
}

/** Render as JSON (array of objects, typed). */
export function toJson(result: ParsedResult, opts: ExportOptions, parseOpts: ParseOptions = DEFAULT_PARSE): string {
  const headers = result.columns.map((c) => c.label ?? c.name);
  const types = result.columns.map((c) => c.type);
  const arr = result.rows.map((row) => {
    const obj: Record<string, CellValue> = {};
    headers.forEach((h, i) => {
      obj[h] = coerceValue(row[i] ?? "", types[i], parseOpts);
    });
    return obj;
  });
  return opts.prettyJson ? JSON.stringify(arr, null, 2) : JSON.stringify(arr);
}

/** Render as NDJSON (one JSON object per line). */
export function toNdjson(result: ParsedResult, parseOpts: ParseOptions = DEFAULT_PARSE): string {
  const headers = result.columns.map((c) => c.label ?? c.name);
  const types = result.columns.map((c) => c.type);
  return result.rows.map((row) => {
    const obj: Record<string, CellValue> = {};
    headers.forEach((h, i) => {
      obj[h] = coerceValue(row[i] ?? "", types[i], parseOpts);
    });
    return JSON.stringify(obj);
  }).join("\n");
}

/** Render as Markdown table. */
export function toMarkdown(result: ParsedResult): string {
  if (result.columns.length === 0) return "";
  const headers = result.columns.map((c) => c.label ?? c.name);
  const lines: string[] = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of result.rows) {
    lines.push(`| ${row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`);
  }
  return lines.join("\n");
}

/** Render as HTML table. */
export function toHtml(result: ParsedResult): string {
  if (result.columns.length === 0) return "";
  const esc = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const headers = result.columns.map((c) => c.label ?? c.name);
  const lines: string[] = ['<table>', "  <thead>", "    <tr>"];
  for (const h of headers) lines.push(`      <th>${esc(h)}</th>`);
  lines.push("    </tr>", "  </thead>", "  <tbody>");
  for (const row of result.rows) {
    lines.push("    <tr>");
    for (const c of row) lines.push(`      <td>${esc(c)}</td>`);
    lines.push("    </tr>");
  }
  lines.push("  </tbody>", "</table>");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

/** Run the full convert pipeline: parse → transform → render. */
export function convert(text: string, parseOpts: ParseOptions, exportOpts: ExportOptions): { output: string; result: ParsedResult; stats: ConvertStats } {
  const parsed = parseInput(text, parseOpts);
  const transformed = transformColumns(parsed, exportOpts);
  let output = "";
  switch (exportOpts.format) {
    case "csv": output = toCsv(transformed, exportOpts); break;
    case "json": output = toJson(transformed, exportOpts, parseOpts); break;
    case "ndjson": output = toNdjson(transformed, parseOpts); break;
    case "tsv": output = toTsv(transformed, exportOpts); break;
    case "markdown": output = toMarkdown(transformed); break;
    case "html": output = toHtml(transformed); break;
  }
  const nullCount = countNulls(transformed, parseOpts);
  const typesByColumn: Record<string, ColumnType> = {};
  for (const c of transformed.columns) typesByColumn[c.label ?? c.name] = c.type;
  const stats: ConvertStats = {
    rowCount: transformed.rows.length,
    columnCount: transformed.columns.length,
    outputBytes: output.length,
    nullCount,
    typesByColumn,
  };
  return { output, result: transformed, stats };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAutoHeader(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `col_${i + 1}`);
}

function splitQuotedRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out.map((c) => c.trim());
}

function splitPipeRow(line: string): string[] {
  // Strip leading/trailing pipes, then split on |
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map((c) => c.trim());
}

function quote(s: string, delim: string, mode: CsvQuoting): string {
  if (mode === "never") return s;
  const needsQuote = mode === "always" || s.includes(delim) || s.includes('"') || s.includes("\n") || s.includes("\r");
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function tsvEscape(s: string): string {
  return s.replace(/\t/g, "\\t").replace(/\r?\n/g, " ");
}

function countNulls(result: ParsedResult, opts: ParseOptions): number {
  let n = 0;
  for (const row of result.rows) {
    for (const cell of row) {
      const t = (cell ?? "").trim();
      if (!t && opts.emptyAsNull) n++;
      else if (t.toLowerCase() === opts.nullToken.toLowerCase()) n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sql-result-to-csv-json-exporter:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(parseOpts: ParseOptions, exportOpts: ExportOptions): string {
  const params = new URLSearchParams();
  params.set("inFmt", parseOpts.format);
  params.set("hdr", parseOpts.hasHeader ? "1" : "0");
  params.set("null", parseOpts.nullToken);
  params.set("eAsNull", parseOpts.emptyAsNull ? "1" : "0");
  params.set("outFmt", exportOpts.format);
  params.set("delim", exportOpts.delimiter);
  params.set("quote", exportOpts.quoting);
  params.set("pretty", exportOpts.prettyJson ? "1" : "0");
  params.set("hdrOut", exportOpts.includeHeader ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { parseOpts: Partial<ParseOptions>; exportOpts: Partial<ExportOptions> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { parseOpts: {}, exportOpts: {} };
  const params = new URLSearchParams(clean);
  const parseOpts: Partial<ParseOptions> = {};
  const exportOpts: Partial<ExportOptions> = {};
  const inFmt = params.get("inFmt");
  if (inFmt && INPUT_FORMATS.includes(inFmt as InputFormat)) parseOpts.format = inFmt as InputFormat;
  if (params.get("hdr") !== null) parseOpts.hasHeader = params.get("hdr") === "1";
  const nullTok = params.get("null");
  if (nullTok !== null) parseOpts.nullToken = nullTok;
  if (params.get("eAsNull") !== null) parseOpts.emptyAsNull = params.get("eAsNull") === "1";
  const outFmt = params.get("outFmt");
  if (outFmt && OUTPUT_FORMATS.includes(outFmt as OutputFormat)) exportOpts.format = outFmt as OutputFormat;
  const delim = params.get("delim");
  if (delim === "," || delim === ";" || delim === "\t" || delim === "|") exportOpts.delimiter = delim;
  const quote = params.get("quote");
  if (quote === "always" || quote === "never" || quote === "auto") exportOpts.quoting = quote;
  if (params.get("pretty") !== null) exportOpts.prettyJson = params.get("pretty") === "1";
  if (params.get("hdrOut") !== null) exportOpts.includeHeader = params.get("hdrOut") === "1";
  return { parseOpts, exportOpts };
}
