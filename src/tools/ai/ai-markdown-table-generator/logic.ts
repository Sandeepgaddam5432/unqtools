/**
 * AI Markdown Table Generator — pure logic.
 *
 * Convert CSV, TSV, JSON, pasted spreadsheet data, or existing GFM
 * Markdown tables into clean GitHub-flavored Markdown (GFM) tables.
 * Supports per-column alignment (left/center/right/default), compact
 * vs pretty padding, header detection, cell escaping (pipes → \|),
 * line-break handling (newlines → <br>), sort, transpose, dedupe,
 * case transforms, number formatting, and round-trip import.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: GFM is the default flavor; rendering varies slightly
 * across Markdown parsers. Everything runs locally.
 */

// ---------- Types ----------

export type Alignment = "left" | "center" | "right" | "default";

export type CaseTransform = "none" | "upper" | "lower" | "title";

export type OutputMode = "compact" | "pretty";

export type SortDirection = "asc" | "desc";

export type InputFormat = "csv" | "tsv" | "json" | "markdown" | "auto";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface TableOptions {
  alignments: Alignment[];
  mode: OutputMode;
  boldHeader: boolean;
  brForNewlines: boolean;
  numberFormat: { enabled: boolean; decimals: number };
}

export interface TableTransforms {
  sortColumn: number | null;
  sortDirection: SortDirection;
  transpose: boolean;
  dedupe: boolean;
  caseTransform: CaseTransform;
}

export interface GeneratedTable {
  markdown: string;
  html: string;
  csv: string;
  json: string;
  rowCount: number;
  columnCount: number;
  charCount: number;
}

// ---------- Constants ----------

export const ALIGNMENT_VALUES: Alignment[] = ["default", "left", "center", "right"];
export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  "default": "Default",
  "left": "Left",
  "center": "Center",
  "right": "Right",
};
export const CASE_VALUES: CaseTransform[] = ["none", "upper", "lower", "title"];
export const CASE_LABELS: Record<CaseTransform, string> = {
  "none": "No change",
  "upper": "UPPERCASE",
  "lower": "lowercase",
  "title": "Title Case",
};
export const MODE_VALUES: OutputMode[] = ["compact", "pretty"];
export const MODE_LABELS: Record<OutputMode, string> = {
  "compact": "Compact (minimal padding)",
  "pretty": "Pretty (padded)",
};

export const HISTORY_KEY = "unqtools:ai-markdown-table-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-markdown-table-generator:llm-key";

export const SAMPLE_TABLES: { name: string; format: InputFormat; input: string }[] = [
  {
    name: "Planets (CSV)",
    format: "csv",
    input: "Planet,Distance (AU),Moons\nMercury,0.39,0\nVenus,0.72,0\nEarth,1.00,1\nMars,1.52,2\nJupiter,5.20,95",
  },
  {
    name: "Todo (TSV)",
    format: "tsv",
    input: "Task\tOwner\tDue\nFix login bug\tAlice\tMon\nWrite docs\tBob\tTue\nShip release\tCarol\tWed",
  },
  {
    name: "Users (JSON)",
    format: "json",
    input: '[\n  {"name":"Ada","role":"Admin","active":true},\n  {"name":"Linus","role":"Engineer","active":true},\n  {"name":"Grace","role":"QA","active":false}\n]',
  },
  {
    name: "Markdown import",
    format: "markdown",
    input: "| Name | Score |\n| :--- | ---: |\n| Ada | 95 |\n| Bob | 82 |",
  },
];

// ---------- Text helpers ----------

/** Detect the delimiter of a multi-line input. Returns "csv", "tsv", "json", "markdown", or "auto". */
export function detectFormat(input: string): InputFormat {
  const trimmed = input.trim();
  if (!trimmed) return "auto";
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  if (/^\s*\|/.test(trimmed)) return "markdown";
  // Count tabs vs commas in first non-empty line
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  if (tabs > 0 && tabs >= commas) return "tsv";
  if (commas > 0) return "csv";
  return "csv";
}

/** Escape a cell value for GFM Markdown: pipes → \|, trailing/leading spaces preserved. */
export function escapeCell(value: string, brForNewlines: boolean): string {
  if (value === null || value === undefined) return "";
  let out = String(value);
  // Escape backslash first to avoid double-escaping our own escapes.
  out = out.replace(/\\/g, "\\\\");
  // Escape pipes
  out = out.replace(/\|/g, "\\|");
  // Newlines → <br> if enabled, else space
  if (brForNewlines) {
    out = out.replace(/\r?\n/g, "<br>");
  } else {
    out = out.replace(/\r?\n/g, " ");
  }
  return out;
}

/** Apply case transform to a cell value. */
export function applyCase(value: string, mode: CaseTransform): string {
  if (!value) return value;
  switch (mode) {
    case "upper": return value.toUpperCase();
    case "lower": return value.toLowerCase();
    case "title": return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case "none":
    default: return value;
  }
}

/** Format a number string to the specified decimal places. Non-numbers are returned as-is. */
export function formatNumber(value: string, opts: { enabled: boolean; decimals: number }): string {
  if (!opts.enabled) return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return value;
  return n.toFixed(Math.max(0, Math.min(10, opts.decimals)));
}

// ---------- Parsers ----------

/** Parse a single CSV row with quoted-field handling. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Parse a single TSV row (handles literal tabs). */
export function splitTsvRow(line: string): string[] {
  return line.split("\t");
}

/** Parse CSV input into a TableData. First non-empty row is treated as headers.
 *  Implements RFC 4180-style quoting: quoted fields may contain commas,
 *  newlines, and doubled quotes (""). */
export function parseCsv(input: string): TableData {
  const text = (input ?? "").replace(/\r\n/g, "\n");
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { current.push(field); field = ""; i++; continue; }
    if (ch === '\n') { current.push(field); rows.push(current); current = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  // Flush trailing field/row if any
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  const filtered = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (filtered.length === 0) return { headers: [], rows: [] };
  const headers = filtered[0]!;
  return { headers, rows: filtered.slice(1) };
}

/** Parse TSV input into a TableData. */
export function parseTsv(input: string): TableData {
  const lines = (input ?? "").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitTsvRow(lines[0]!);
  const rows = lines.slice(1).map(splitTsvRow);
  return { headers, rows };
}

/** Parse JSON array (of objects or arrays) into a TableData. */
export function parseJsonArray(input: string): TableData {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { headers: [], rows: [] };
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { headers: [], rows: [] };
  }
  if (!Array.isArray(data) || data.length === 0) return { headers: [], rows: [] };
  // Object array → keys from first object (preserving insertion order).
  if (data.every((d) => d !== null && typeof d === "object" && !Array.isArray(d))) {
    const first = data[0] as Record<string, unknown>;
    const headers = Object.keys(first);
    const rows = (data as Record<string, unknown>[]).map((d) =>
      headers.map((h) => {
        const v = d[h];
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }),
    );
    return { headers, rows };
  }
  // Array-of-arrays
  if (data.every((d) => Array.isArray(d))) {
    const rows = (data as unknown[][]).map((d) => d.map((c) => (c === null || c === undefined ? "" : String(c))));
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const headers = Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`);
    return { headers, rows };
  }
  return { headers: [], rows: [] };
}

/** Parse a GFM Markdown table back into editable TableData. */
export function parseMarkdownTable(input: string): TableData {
  const lines = (input ?? "").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };
  const stripPipes = (line: string): string[] => {
    let s = line.trim();
    // Strip leading/trailing pipe
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    // Split on unescaped pipes
    return s.split(/(?<!\\)\|/g).map((c) => c.trim().replace(/\\\|/g, "|").replace(/\\\\/g, "\\"));
  };
  const headers = stripPipes(lines[0]!);
  // Skip alignment row (line 1: | --- | :--- | ---: | :-: |)
  const rows = lines.slice(2).map(stripPipes);
  return { headers, rows };
}

/** Parse any input by auto-detecting or honoring explicit format. */
export function parseInput(input: string, format: InputFormat): TableData {
  const fmt = format === "auto" ? detectFormat(input) : format;
  switch (fmt) {
    case "csv": return parseCsv(input);
    case "tsv": return parseTsv(input);
    case "json": return parseJsonArray(input);
    case "markdown": return parseMarkdownTable(input);
    case "auto":
    default: return parseCsv(input);
  }
}

// ---------- Transforms ----------

/** Sort rows by a column index. Returns a new TableData. */
export function sortRows(data: TableData, column: number, direction: SortDirection): TableData {
  if (column < 0 || column >= data.headers.length) return data;
  const sorted = [...data.rows].sort((a, b) => {
    const av = (a[column] ?? "").trim();
    const bv = (b[column] ?? "").trim();
    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn) && av !== "" && bv !== "") {
      return direction === "asc" ? an - bn : bn - an;
    }
    return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  return { ...data, rows: sorted };
}

/** Transpose a table (rows become columns, columns become rows). */
export function transposeTable(data: TableData): TableData {
  const matrix = [data.headers, ...data.rows];
  const maxCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  const padded = matrix.map((r) => {
    const out = [...r];
    while (out.length < maxCols) out.push("");
    return out;
  });
  const transposed: string[][] = [];
  for (let c = 0; c < maxCols; c++) {
    transposed.push(padded.map((r) => r[c] ?? ""));
  }
  return {
    headers: transposed[0] ?? [],
    rows: transposed.slice(1),
  };
}

/** Remove duplicate rows (case-sensitive exact match of all cells). */
export function dedupeRows(data: TableData): TableData {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const row of data.rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return { ...data, rows: out };
}

/** Apply case transform to every cell. */
export function applyCaseToTable(data: TableData, mode: CaseTransform): TableData {
  if (mode === "none") return data;
  return {
    headers: data.headers.map((h) => applyCase(h, mode)),
    rows: data.rows.map((r) => r.map((c) => applyCase(c, mode))),
  };
}

/** Apply number formatting to every cell. */
export function formatNumbersInTable(data: TableData, opts: { enabled: boolean; decimals: number }): TableData {
  if (!opts.enabled) return data;
  return {
    headers: data.headers,
    rows: data.rows.map((r) => r.map((c) => formatNumber(c, opts))),
  };
}

/** Apply all transforms to a TableData in a canonical order. */
export function applyTransforms(data: TableData, transforms: TableTransforms): TableData {
  let out = data;
  if (transforms.dedupe) out = dedupeRows(out);
  if (transforms.sortColumn !== null && transforms.sortColumn >= 0) {
    out = sortRows(out, transforms.sortColumn, transforms.sortDirection);
  }
  if (transforms.transpose) out = transposeTable(out);
  if (transforms.caseTransform !== "none") out = applyCaseToTable(out, transforms.caseTransform);
  return out;
}

// ---------- Renderers ----------

/** Minimum marker width required for an alignment to render its colon/dash pattern. */
function minMarkerWidth(a: Alignment): number {
  switch (a) {
    case "left": return 4;   // :---
    case "right": return 4;  // ---:
    case "center": return 5; // :---:
    case "default":
    default: return 3;       // ---
  }
}

function padCell(text: string, width: number, alignment: Alignment): string {
  if (alignment === "left" || alignment === "default") {
    return text + " ".repeat(Math.max(0, width - text.length));
  }
  if (alignment === "right") {
    return " ".repeat(Math.max(0, width - text.length)) + text;
  }
  // center
  const total = Math.max(0, width - text.length);
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

/** Render a TableData as a GFM Markdown table. */
export function generateMarkdownTable(data: TableData, opts: TableOptions): string {
  const { headers, rows } = data;
  if (headers.length === 0) return "";
  // Pad alignments to header count, default "default"
  const alignments: Alignment[] = headers.map((_, i) => opts.alignments[i] ?? "default");
  // Compute column widths from escaped cell text (compact uses raw text length, pretty uses max width)
  const escapedRows = rows.map((r) =>
    headers.map((_, i) => escapeCell(r[i] ?? "", opts.brForNewlines)),
  );
  const escapedHeaders = headers.map((h) => escapeCell(h, opts.brForNewlines));
  const colWidths = headers.map((_, i) => {
    const all = [escapedHeaders[i] ?? "", ...escapedRows.map((r) => r[i] ?? "")];
    const minW = minMarkerWidth(alignments[i]!);
    return Math.max(...all.map((c) => c.length), minW);
  });
  // Build alignment row marker
  const alignMarker = (a: Alignment, width: number): string => {
    const w = Math.max(width, minMarkerWidth(a));
    const inner = Math.max(1, w - 2); // dashes between optional colons
    switch (a) {
      case "left": return ":" + "-".repeat(inner) + "-";
      case "right": return "-" + "-".repeat(inner) + ":";
      case "center": return ":" + "-".repeat(inner) + ":";
      case "default":
      default: return "-".repeat(Math.max(3, w));
    }
  };
  // Build rows
  const headerRow = "| " + escapedHeaders
    .map((h, i) => opts.mode === "pretty"
      ? padCell(h, colWidths[i]!, alignments[i]!)
      : h,
    ).join(" | ") + " |";
  const separatorRow = "| " + alignments.map((a, i) => {
    if (opts.mode === "pretty") {
      const cell = alignMarker(a, colWidths[i]!);
      // Pad to match the cell width of header/body rows
      return padCell(cell, colWidths[i]!, a);
    }
    // compact: ensure marker uses its alignment-specific minimum width
    return alignMarker(a, (escapedHeaders[i] ?? "").length);
  }).join(" | ") + " |";
  const bodyRows = escapedRows.map((r) =>
    "| " + r.map((c, i) => opts.mode === "pretty"
      ? padCell(c, colWidths[i]!, alignments[i]!)
      : c,
    ).join(" | ") + " |",
  );
  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

/** Escape a string for HTML output. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a TableData as an HTML <table>. */
export function renderHtml(data: TableData, opts: TableOptions): string {
  const { headers, rows } = data;
  if (headers.length === 0) return "";
  const alignments = headers.map((_, i) => opts.alignments[i] ?? "default");
  const alignAttr = (a: Alignment): string => {
    if (a === "default") return "";
    return ` style="text-align:${a}"`;
  };
  const thead = "<thead><tr>" + headers.map((h, i) =>
    `<th${alignAttr(alignments[i]!)}>${escapeHtml(h)}</th>`,
  ).join("") + "</tr></thead>";
  const tbody = "<tbody>" + rows.map((r) =>
    "<tr>" + headers.map((_, i) =>
      `<td${alignAttr(alignments[i]!)}>${escapeHtml(r[i] ?? "")}</td>`,
    ).join("") + "</tr>",
  ).join("") + "</tbody>";
  return `<table>\n${thead}\n${tbody}\n</table>`;
}

/** Render a TableData as CSV (with quoting). */
export function renderCsv(data: TableData): string {
  const { headers, rows } = data;
  if (headers.length === 0) return "";
  const esc = (s: string): string => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((_, i) => esc(r[i] ?? "")).join(","));
  return lines.join("\n");
}

/** Render a TableData as JSON (array of objects keyed by header). */
export function renderJson(data: TableData): string {
  const { headers, rows } = data;
  if (headers.length === 0) return "[]";
  const arr = rows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  return JSON.stringify(arr, null, 2);
}

// ---------- Orchestration ----------

/** Generate all output formats (markdown, html, csv, json) from input + options + transforms. */
export function generateTable(
  input: string,
  format: InputFormat,
  options: TableOptions,
  transforms: TableTransforms,
): GeneratedTable {
  const parsed = parseInput(input, format);
  if (parsed.headers.length === 0) {
    return {
      markdown: "",
      html: "",
      csv: "",
      json: "[]",
      rowCount: 0,
      columnCount: 0,
      charCount: 0,
    };
  }
  // Normalize alignments length
  const normOpts: TableOptions = {
    ...options,
    alignments: parsed.headers.map((_, i) => options.alignments[i] ?? "default"),
  };
  const transformed = applyTransforms(parsed, transforms);
  const finalOpts: TableOptions = {
    ...normOpts,
    // re-pad alignments in case transpose changed column count
    alignments: transformed.headers.map((_, i) => normOpts.alignments[i] ?? "default"),
  };
  const markdown = generateMarkdownTable(transformed, finalOpts);
  const html = renderHtml(transformed, finalOpts);
  const csv = renderCsv(transformed);
  const json = renderJson(transformed);
  return {
    markdown,
    html,
    csv,
    json,
    rowCount: transformed.rows.length,
    columnCount: transformed.headers.length,
    charCount: markdown.length,
  };
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  format: InputFormat;
  rowCount: number;
  columnCount: number;
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

// ---------- Shareable URL ----------

export interface ShareState {
  format: InputFormat;
  input: string;
  alignments: Alignment[];
  mode: OutputMode;
  boldHeader: boolean;
  brForNewlines: boolean;
  numberFormat: { enabled: boolean; decimals: number };
  sortColumn: number | null;
  sortDirection: SortDirection;
  transpose: boolean;
  dedupe: boolean;
  caseTransform: CaseTransform;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("f", state.format);
  if (state.input) params.set("i", state.input);
  params.set("a", state.alignments.join(","));
  params.set("m", state.mode);
  params.set("bh", state.boldHeader ? "1" : "0");
  params.set("br", state.brForNewlines ? "1" : "0");
  params.set("nf", state.numberFormat.enabled ? "1" : "0");
  params.set("nd", String(state.numberFormat.decimals));
  params.set("sc", state.sortColumn === null ? "" : String(state.sortColumn));
  params.set("sd", state.sortDirection);
  params.set("t", state.transpose ? "1" : "0");
  params.set("d", state.dedupe ? "1" : "0");
  params.set("c", state.caseTransform);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const f = params.get("f") ?? "auto";
  const validFormats: InputFormat[] = ["csv", "tsv", "json", "markdown", "auto"];
  const format = validFormats.includes(f as InputFormat) ? (f as InputFormat) : "auto";
  const input = params.get("i") ?? "";
  const aStr = params.get("a") ?? "";
  const validAligns: Alignment[] = ["default", "left", "center", "right"];
  const alignments = aStr
    ? aStr.split(",").filter((a) => validAligns.includes(a as Alignment)) as Alignment[]
    : [];
  const m = params.get("m") ?? "compact";
  const mode: OutputMode = m === "pretty" ? "pretty" : "compact";
  const boldHeader = params.get("bh") === "1";
  const brForNewlines = params.get("br") === "1";
  const numberFormat = {
    enabled: params.get("nf") === "1",
    decimals: Math.max(0, Math.min(10, Number(params.get("nd") ?? "2") || 0)),
  };
  const scRaw = params.get("sc") ?? "";
  const sortColumn: number | null = scRaw === "" ? null : Math.max(0, Number(scRaw) || 0);
  const sdRaw = params.get("sd") ?? "asc";
  const sortDirection: SortDirection = sdRaw === "desc" ? "desc" : "asc";
  const transpose = params.get("t") === "1";
  const dedupe = params.get("d") === "1";
  const cRaw = params.get("c") ?? "none";
  const caseTransform: CaseTransform =
    (["none", "upper", "lower", "title"] as CaseTransform[]).includes(cRaw as CaseTransform)
      ? (cRaw as CaseTransform)
      : "none";
  return {
    format,
    input,
    alignments,
    mode,
    boldHeader,
    brForNewlines,
    numberFormat,
    sortColumn,
    sortDirection,
    transpose,
    dedupe,
    caseTransform,
  };
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(input: string, format: InputFormat): { system: string; user: string } {
  return {
    system:
      "You are a Markdown table expert. Improve the user's input into a clean, well-aligned GFM Markdown table. " +
      "Return ONLY the Markdown table — no commentary, no code fences. Preserve all data. " +
      "Choose sensible column alignments: left for text, right for numbers, center for short codes.",
    user:
      `Convert the following ${format === "auto" ? "spreadsheet" : format} data into a clean GFM Markdown table:\n\n${input}`,
  };
}

export function renderLlmResult(raw: string): string {
  // Strip code fences if present
  let out = raw.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
  }
  return out.trim();
}
