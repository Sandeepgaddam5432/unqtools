/**
 * Markdown Table Generator — pure logic.
 *
 * A visual, spreadsheet-like grid that outputs valid GitHub-Flavored Markdown
 * tables. Pure functions only — no DOM, no network. Supports:
 *
 *   - Add / remove / move rows & columns, edit cells.
 *   - Per-column alignment (left / center / right).
 *   - Header-row toggle (emits a blank separator row when off so GitHub still
 *     parses the result as a table).
 *   - Import from CSV / TSV (RFC 4180 — quoted fields, embedded commas,
 *     newlines, and doubled quotes).
 *   - Round-trip import from an existing markdown table.
 *   - Transpose rows ↔ columns.
 *   - Sort rows by any column (asc / desc).
 *   - Dedupe rows.
 *   - Bold first / last row.
 *   - Compact vs padded output.
 *   - Multi-format export: Markdown, HTML, CSV, JSON, Jira.
 *   - Pipe & newline escaping in cells.
 *   - History (localStorage, max 20) and a shareable URL.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Alignment = "left" | "center" | "right";

export interface TableModel {
  /** Column headers (always length = number of columns). */
  headers: string[];
  /** Body rows; each row length matches headers length. */
  rows: string[][];
  /** Per-column alignment. */
  aligns: Alignment[];
  /** Whether the first row of the output is treated as a header. */
  headerRow: boolean;
}

export interface TableStats {
  rows: number;
  cols: number;
  cells: number;
  emptyCells: number;
  chars: number;
}

export interface RenderOptions {
  /** Pad cells with spaces so columns line up. Default true. */
  padded?: boolean;
  /** Trim leading/trailing whitespace from each cell. Default true. */
  trim?: boolean;
}

export interface HistoryEntry {
  ts: number;
  rows: number;
  cols: number;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:markdown-table-generator:history";
const HISTORY_MAX = 20;
const SHARE_MAX_BYTES = 4800;

// ---------------------------------------------------------------------------
// Creation & mutation
// ---------------------------------------------------------------------------

/** Create an empty table with the given dimensions. */
export function createEmptyTable(rows = 2, cols = 2): TableModel {
  const safeRows = Math.max(0, rows | 0);
  const safeCols = Math.max(1, cols | 0);
  return {
    headers: Array.from({ length: safeCols }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => "")),
    aligns: Array.from({ length: safeCols }, () => "left" as Alignment),
    headerRow: true,
  };
}

/** Validate & normalise a TableModel (clamp arrays to header length). */
export function normalizeTable(t: TableModel): TableModel {
  const cols = Math.max(1, t.headers.length);
  const headers = t.headers.slice(0, cols);
  while (headers.length < cols) headers.push("");
  const aligns = t.aligns.slice(0, cols);
  while (aligns.length < cols) aligns.push("left");
  const rows = t.rows.map((r) => {
    const out = r.slice(0, cols);
    while (out.length < cols) out.push("");
    return out;
  });
  return { headers, rows, aligns, headerRow: t.headerRow };
}

/** Set a body cell value. */
export function setCell(t: TableModel, row: number, col: number, value: string): TableModel {
  if (row < 0 || row >= t.rows.length) return t;
  if (col < 0 || col >= t.headers.length) return t;
  const rows = t.rows.map((r, ri) =>
    ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r,
  );
  return { ...t, rows };
}

/** Set a header cell value. */
export function setHeader(t: TableModel, col: number, value: string): TableModel {
  if (col < 0 || col >= t.headers.length) return t;
  const headers = t.headers.map((h, i) => (i === col ? value : h));
  return { ...t, headers };
}

/** Set alignment for a column. */
export function setAlignment(t: TableModel, col: number, align: Alignment): TableModel {
  if (col < 0 || col >= t.headers.length) return t;
  const aligns = t.aligns.map((a, i) => (i === col ? align : a));
  return { ...t, aligns };
}

/** Add a row at the given index (default: append). */
export function addRow(t: TableModel, at?: number): TableModel {
  const cols = t.headers.length;
  const newRow = Array.from({ length: cols }, () => "");
  const idx = at === undefined ? t.rows.length : Math.max(0, Math.min(t.rows.length, at));
  const rows = [...t.rows.slice(0, idx), newRow, ...t.rows.slice(idx)];
  return { ...t, rows };
}

/** Remove the row at the given index. */
export function removeRow(t: TableModel, idx: number): TableModel {
  if (idx < 0 || idx >= t.rows.length) return t;
  const rows = t.rows.filter((_, i) => i !== idx);
  return { ...t, rows };
}

/** Move a row up (delta = -1) or down (delta = +1). */
export function moveRow(t: TableModel, idx: number, delta: -1 | 1): TableModel {
  const target = idx + delta;
  if (idx < 0 || idx >= t.rows.length || target < 0 || target >= t.rows.length) return t;
  const rows = [...t.rows];
  const [r] = rows.splice(idx, 1);
  rows.splice(target, 0, r);
  return { ...t, rows };
}

/** Add a column at the given index (default: append). */
export function addColumn(t: TableModel, at?: number): TableModel {
  const idx = at === undefined ? t.headers.length : Math.max(0, Math.min(t.headers.length, at));
  const headers = [...t.headers.slice(0, idx), `Column ${t.headers.length + 1}`, ...t.headers.slice(idx)];
  const aligns = [...t.aligns.slice(0, idx), "left" as Alignment, ...t.aligns.slice(idx)];
  const rows = t.rows.map((r) => [...r.slice(0, idx), "", ...r.slice(idx)]);
  return { ...t, headers, aligns, rows };
}

/** Remove the column at the given index. */
export function removeColumn(t: TableModel, idx: number): TableModel {
  if (idx < 0 || idx >= t.headers.length || t.headers.length <= 1) return t;
  const headers = t.headers.filter((_, i) => i !== idx);
  const aligns = t.aligns.filter((_, i) => i !== idx);
  const rows = t.rows.map((r) => r.filter((_, i) => i !== idx));
  return { ...t, headers, aligns, rows };
}

/** Move a column left (delta = -1) or right (delta = +1). */
export function moveColumn(t: TableModel, idx: number, delta: -1 | 1): TableModel {
  const target = idx + delta;
  if (idx < 0 || idx >= t.headers.length || target < 0 || target >= t.headers.length) return t;
  const swap = <T,>(arr: T[]): T[] => {
    const out = [...arr];
    const [v] = out.splice(idx, 1);
    out.splice(target, 0, v);
    return out;
  };
  return {
    ...t,
    headers: swap(t.headers),
    aligns: swap(t.aligns),
    rows: t.rows.map(swap),
  };
}

/** Toggle the header-row flag. */
export function toggleHeaderRow(t: TableModel): TableModel {
  return { ...t, headerRow: !t.headerRow };
}

/** Transpose rows ↔ columns. Headers become the first column. */
export function transposeTable(t: TableModel): TableModel {
  const cols = t.headers.length;
  const rows = t.rows.length;
  // New column count = old row count + 1 (the first column holds old headers).
  // New row count = old column count.
  const newHeaders: string[] = [];
  for (let c = 0; c < cols; c++) {
    if (c === 0) newHeaders.push("");
    else newHeaders.push(`Column ${c}`);
  }
  // Build body rows: one per old column.
  const newRows: string[][] = [];
  for (let c = 0; c < cols; c++) {
    const r: string[] = [];
    r.push(t.headers[c] ?? "");
    for (let i = 0; i < rows; i++) r.push(t.rows[i]?.[c] ?? "");
    newRows.push(r);
  }
  const newAligns: Alignment[] = Array.from({ length: cols }, () => "left");
  return { headers: newHeaders, rows: newRows, aligns: newAligns, headerRow: t.headerRow };
}

/** Sort rows by the given column index. */
export function sortRows(t: TableModel, col: number, dir: "asc" | "desc" = "asc"): TableModel {
  if (col < 0 || col >= t.headers.length) return t;
  const sign = dir === "asc" ? 1 : -1;
  const rows = [...t.rows].sort((a, b) => {
    const x = (a[col] ?? "").toLowerCase();
    const y = (b[col] ?? "").toLowerCase();
    if (x < y) return -1 * sign;
    if (x > y) return 1 * sign;
    return 0;
  });
  return { ...t, rows };
}

/** Remove duplicate rows (case-sensitive, exact match). */
export function dedupeRows(t: TableModel): TableModel {
  const seen = new Set<string>();
  const rows = t.rows.filter((r) => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...t, rows };
}

/** Bold the first or last row (wraps each cell in **). */
export function boldRow(t: TableModel, which: "first" | "last"): TableModel {
  if (t.rows.length === 0) return t;
  const idx = which === "first" ? 0 : t.rows.length - 1;
  const rows = t.rows.map((r, i) =>
    i === idx ? r.map((c) => (c.trim() ? `**${c}**` : c)) : r,
  );
  return { ...t, rows };
}

// ---------------------------------------------------------------------------
// Escaping & rendering
// ---------------------------------------------------------------------------

/** Escape a cell value for safe insertion into a markdown table cell. */
export function escapeCell(s: string): string {
  if (s === undefined || s === null) return "";
  // Newlines → <br>
  let out = String(s).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
  // First, temporarily replace literal `\|` (escaped pipe) with a placeholder
  // so the subsequent pipe-escape doesn't double-escape it.
  out = out.replace(/\\\|/g, "\u0000PIPE\u0000");
  // Escape all remaining raw pipes.
  out = out.replace(/\|/g, "\\|");
  // Restore the escaped pipes.
  out = out.replace(/\u0000PIPE\u0000/g, "\\|");
  return out;
}

/** Strip bold/italic markers from a cell when re-importing (best effort). */
function unescapeCell(s: string): string {
  return s
    .replace(/\\(\|)/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .trim();
}

/** Build the GFM separator string for a column given its alignment. */
export function separatorFor(align: Alignment): string {
  switch (align) {
    case "center": return ":---:";
    case "right": return "---:";
    case "left":
    default: return ":---";
  }
}

/** Compute the max display width of a column (for padded output). */
function colWidth(values: string[]): number {
  return values.reduce((m, v) => Math.max(m, v.length), 0);
}

/** Render the table as a GitHub-Flavored Markdown string. */
export function renderMarkdown(t: TableModel, opts: RenderOptions = {}): string {
  const padded = opts.padded !== false;
  const trim = opts.trim !== false;
  const table = normalizeTable(t);
  const cols = table.headers.length;
  const escape = (s: string) => escapeCell(trim ? s.trim() : s);

  const headerCells = table.headers.map(escape);
  const bodyCells = table.rows.map((r) => r.map(escape));

  // Compute widths for padding
  const widths: number[] = [];
  const sepStrs = table.aligns.map(separatorFor);
  for (let c = 0; c < cols; c++) {
    const w = colWidth([
      headerCells[c] ?? "",
      ...bodyCells.map((r) => r[c] ?? ""),
      sepStrs[c] ?? "",
    ]);
    widths.push(w);
  }

  const padCell = (s: string, c: number) => {
    if (!padded) return s;
    const w = widths[c] ?? s.length;
    return s.length >= w ? s : s + " ".repeat(w - s.length);
  };

  const lines: string[] = [];
  // Header row
  lines.push(`| ${headerCells.map((c, i) => padCell(c, i)).join(" | ")} |`);
  // Separator row (always emitted so GitHub parses as a table)
  lines.push(`| ${sepStrs.map((s, i) => padCell(s, i)).join(" | ")} |`);
  // Body rows (if headerRow is false, GitHub will treat the first row as data,
  // but the separator row is still required).
  const body = bodyCells.map((r) => `| ${r.map((c, i) => padCell(c, i)).join(" | ")} |`);
  if (!table.headerRow) {
    // Emit the headers as the first body row instead.
    lines.length = 0;
    lines.push(`| ${headerCells.map((c, i) => padCell(c, i)).join(" | ")} |`);
    lines.push(`| ${sepStrs.map((s, i) => padCell(s, i)).join(" | ")} |`);
    lines.push(...body);
  } else {
    lines.push(...body);
  }
  return lines.join("\n");
}

/** Render the table as an HTML string. */
export function renderHtml(t: TableModel): string {
  const table = normalizeTable(t);
  const ths = table.headers.map((h, i) => {
    const a = table.aligns[i] ?? "left";
    return `<th style="text-align:${a}">${escapeHtml(h)}</th>`;
  }).join("");
  const trs = table.rows.map((r) => {
    const tds = r.map((c, i) => {
      const a = table.aligns[i] ?? "left";
      return `<td style="text-align:${a}">${escapeHtml(c)}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

/** Render the table as CSV (RFC 4180 — quoted fields with embedded commas). */
export function renderCsv(t: TableModel): string {
  const table = normalizeTable(t);
  const lines = [table.headers.map(csvQuote).join(",")];
  for (const r of table.rows) lines.push(r.map(csvQuote).join(","));
  return lines.join("\n");
}

/** Render the table as TSV (tab-separated). */
export function renderTsv(t: TableModel): string {
  const table = normalizeTable(t);
  const lines = [table.headers.map((c) => c.replace(/\t/g, " ").replace(/\n/g, " ")).join("\t")];
  for (const r of table.rows) {
    lines.push(r.map((c) => c.replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"));
  }
  return lines.join("\n");
}

/** Render the table as JSON (array of objects keyed by header). */
export function renderJson(t: TableModel): string {
  const table = normalizeTable(t);
  const out = table.rows.map((r) => {
    const obj: Record<string, string> = {};
    table.headers.forEach((h, i) => { obj[h || `col${i}`] = r[i] ?? ""; });
    return obj;
  });
  return JSON.stringify(out, null, 2);
}

/** Render the table in Jira wiki markup. */
export function renderJira(t: TableModel): string {
  const table = normalizeTable(t);
  const head = table.headers.map((h) => `||${h}`).join("") + "||";
  const body = table.rows.map((r) => r.map((c) => `|${c}`).join("") + "|");
  return [head, ...body].join("\n");
}

// ---------------------------------------------------------------------------
// Import (CSV / TSV / Markdown)
// ---------------------------------------------------------------------------

/** Quote a CSV field if it contains a comma, quote, or newline. */
export function csvQuote(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Parse a single CSV/TSV line with quoted fields. */
export function parseCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delimiter) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a CSV or TSV string into a 2D array. Handles quoted fields with
 * embedded newlines (RFC 4180). Auto-detects tab vs comma delimiter.
 */
export function parseCsv(text: string, delimiter?: "," | "\t" | ";"): string[][] {
  const src = text.replace(/\r\n?/g, "\n");
  // Auto-detect delimiter if not specified
  let delim: string = delimiter ?? ",";
  if (!delimiter) {
    const firstLine = src.split("\n", 1)[0] ?? "";
    const tabs = (firstLine.match(/\t/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    const semis = (firstLine.match(/;/g) ?? []).length;
    if (tabs >= commas && tabs >= semis && tabs > 0) delim = "\t";
    else if (semis > commas && semis > 0) delim = ";";
    else delim = ",";
  }
  // Walk the source character-by-character to support embedded newlines.
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { cur.push(cell); cell = ""; }
      else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else cell += ch;
    }
  }
  // Flush trailing cell/row
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  // Drop trailing empty row (from a final newline)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }
  return rows;
}

/** Parse a markdown table back into a TableModel (round-trip import). */
export function parseMarkdownTable(text: string): TableModel | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;
  const isSep = (s: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(s) || /^\s*\|?\s*:?-+:?\s*\|?\s*$/.test(s);
  // Find the separator line
  let sepIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (isSep(lines[i])) { sepIdx = i; break; }
  }
  if (sepIdx < 1) return null;
  const headerLine = lines[sepIdx - 1];
  const headers = splitMdRow(headerLine);
  const aligns = splitMdRow(lines[sepIdx]).map((c) => {
    const t = c.trim();
    const l = t.startsWith(":");
    const r = t.endsWith(":");
    if (l && r) return "center" as Alignment;
    if (r) return "right" as Alignment;
    return "left" as Alignment;
  });
  const rows: string[][] = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    if (isSep(lines[i])) continue;
    rows.push(splitMdRow(lines[i]).map(unescapeCell));
  }
  return {
    headers: headers.map(unescapeCell),
    rows,
    aligns,
    headerRow: true,
  };
}

/** Split a markdown table row into cells, respecting escaped pipes. */
function splitMdRow(s: string): string[] {
  let t = s.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "\\" && t[i + 1] === "|") { cur += "|"; i++; }
    else if (ch === "|") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Build a TableModel from a CSV/TSV string. First row becomes headers. */
export function importFromCsv(text: string): TableModel {
  const rows = parseCsv(text);
  if (rows.length === 0) return createEmptyTable(0, 1);
  const headers = rows[0];
  const body = rows.slice(1);
  const cols = headers.length;
  return normalizeTable({
    headers,
    rows: body,
    aligns: Array.from({ length: cols }, () => "left" as Alignment),
    headerRow: true,
  });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(t: TableModel): TableStats {
  const table = normalizeTable(t);
  const rows = table.rows.length;
  const cols = table.headers.length;
  const cells = rows * cols;
  let empty = 0;
  let chars = 0;
  for (const r of table.rows) {
    for (const c of r) {
      if (!c.trim()) empty += 1;
      chars += c.length;
    }
  }
  for (const h of table.headers) chars += h.length;
  return { rows, cols, cells, emptyCells: empty, chars };
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

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

/** Build a shareable URL encoding the table model in the hash. */
export function buildShareUrl(t: TableModel): { url: string; tooLarge: boolean } {
  const payload = JSON.stringify(normalizeTable(t));
  const encoded = encodeURIComponent(payload);
  if (encoded.length > SHARE_MAX_BYTES) return { url: "", tooLarge: true };
  const hash = `#mdtbl=${encoded}`;
  if (typeof window === "undefined") return { url: hash, tooLarge: false };
  return { url: `${window.location.origin}${window.location.pathname}${hash}`, tooLarge: false };
}

/** Parse a shareable URL/hash back into a TableModel. */
export function parseShareUrl(hash: string): { table: TableModel | null } {
  if (!hash) return { table: null };
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.startsWith("mdtbl=")) return { table: null };
  const v = h.slice(6);
  try {
    const parsed = JSON.parse(decodeURIComponent(v));
    if (!parsed || !Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
      return { table: null };
    }
    return { table: normalizeTable(parsed as TableModel) };
  } catch {
    return { table: null };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
