/**
 * Multiplication Tables Generator — pure logic.
 *
 * Three modes: single-table, range-table, complete-grid. Pure functions
 * only — no DOM, no network.
 */

export type Mode = "single-table" | "range-table" | "complete-grid";

export type ColorScheme = "rainbow" | "mono" | "blue-scale" | "green-scale";

export interface TableInput {
  mode: Mode;
  startNumber: number;
  endNumber: number;
  tableSize: number;
  highlightMultiples: boolean;
  colorScheme: ColorScheme;
}

export interface Cell {
  i: number;
  j: number;
  product: number;
  isHighlight: boolean;
}

export interface Table {
  /** Base number for this table (the row multiplier in single-table mode). */
  base: number;
  cells: Cell[];
}

export interface GeneratedTables {
  tables: Table[];
  summary: TableSummary;
}

export interface TableSummary {
  totalCells: number;
  totalTables: number;
  rangeMin: number;
  rangeMax: number;
  maxProduct: number;
  minProduct: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const SIZE_PRESETS: number[] = [10, 12, 15, 20];

export const DEFAULT_INPUT: TableInput = {
  mode: "single-table",
  startNumber: 1,
  endNumber: 12,
  tableSize: 10,
  highlightMultiples: true,
  colorScheme: "rainbow",
};

export const COLOR_SCHEME_LABELS: Record<ColorScheme, string> = {
  rainbow: "Rainbow",
  mono: "Monochrome",
  "blue-scale": "Blue scale",
  "green-scale": "Green scale",
};

export const MODE_LABELS: Record<Mode, string> = {
  "single-table": "Single table (one number × 1 to N)",
  "range-table": "Range table (multiple numbers × 1 to N)",
  "complete-grid": "Complete grid (NxN matrix)",
};

/** Clamp a number to [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/** Validate user input. Returns errors array (empty when ok). */
export function validateInput(input: TableInput): ValidationResult {
  const errors: string[] = [];
  const { mode, startNumber, endNumber, tableSize } = input;
  if (!Number.isFinite(startNumber)) errors.push("Start number must be finite.");
  if (!Number.isFinite(endNumber)) errors.push("End number must be finite.");
  if (!Number.isInteger(startNumber)) errors.push("Start number must be an integer.");
  if (!Number.isInteger(endNumber)) errors.push("End number must be an integer.");
  if (startNumber > endNumber) errors.push("Start number must be ≤ end number.");
  if (mode === "complete-grid") {
    const n = endNumber - startNumber + 1;
    if (n > 25) errors.push("Complete grid size must be ≤ 25 (max 25×25).");
  }
  if (!Number.isInteger(tableSize)) errors.push("Table size must be an integer.");
  if (tableSize < 1) errors.push("Table size must be ≥ 1.");
  if (tableSize > 25) errors.push("Table size must be ≤ 25.");
  return { ok: errors.length === 0, errors };
}

/** Sanitize input to safe bounds without throwing. */
export function sanitizeInput(input: Partial<TableInput>): TableInput {
  const mode: Mode =
    input.mode === "range-table" || input.mode === "complete-grid"
      ? input.mode
      : "single-table";
  let start = Number.isFinite(input.startNumber) ? Math.round(input.startNumber as number) : 1;
  let end = Number.isFinite(input.endNumber) ? Math.round(input.endNumber as number) : 12;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  // For complete-grid the size is bounded by start..end; for others use tableSize.
  const tableSize = Number.isFinite(input.tableSize)
    ? clamp(Math.round(input.tableSize as number), 1, 25)
    : 10;
  // Bound complete-grid total span to 25.
  if (mode === "complete-grid" && end - start + 1 > 25) {
    end = start + 24;
  }
  const colorScheme: ColorScheme =
    input.colorScheme === "mono" ||
    input.colorScheme === "blue-scale" ||
    input.colorScheme === "green-scale" ||
    input.colorScheme === "rainbow"
      ? input.colorScheme
      : "rainbow";
  return {
    mode,
    startNumber: start,
    endNumber: end,
    tableSize,
    highlightMultiples: input.highlightMultiples ?? true,
    colorScheme,
  };
}

/** Build a single multiplication table: base × (1..size). */
export function buildSingleTable(
  base: number,
  size: number,
  highlightMultiples: boolean,
): Table {
  const cells: Cell[] = [];
  for (let j = 1; j <= size; j++) {
    const product = base * j;
    const isHighlight = highlightMultiples && base !== 0 && product % base === 0;
    cells.push({ i: base, j, product, isHighlight });
  }
  return { base, cells };
}

/** Build tables for a range of bases: (start..end) × (1..size). */
export function buildRangeTables(input: TableInput): Table[] {
  const clean = sanitizeInput(input);
  const out: Table[] = [];
  for (let b = clean.startNumber; b <= clean.endNumber; b++) {
    out.push(buildSingleTable(b, clean.tableSize, clean.highlightMultiples));
  }
  return out;
}

/** Build complete grid: cell(i, j) = i × j for i, j in [start..end]. */
export function buildCompleteGrid(input: TableInput): Table {
  const clean = sanitizeInput(input);
  const cells: Cell[] = [];
  for (let i = clean.startNumber; i <= clean.endNumber; i++) {
    for (let j = clean.startNumber; j <= clean.endNumber; j++) {
      const product = i * j;
      // Highlight cells where i equals startNumber (visual cue for the first row/column).
      const isHighlight = clean.highlightMultiples && (i === clean.startNumber || j === clean.startNumber);
      cells.push({ i, j, product, isHighlight });
    }
  }
  return { base: clean.startNumber, cells };
}

/** Generate tables based on mode. */
export function generateTables(input: TableInput): GeneratedTables {
  const clean = sanitizeInput(input);
  let tables: Table[];
  if (clean.mode === "single-table") {
    tables = [buildSingleTable(clean.startNumber, clean.tableSize, clean.highlightMultiples)];
  } else if (clean.mode === "range-table") {
    tables = buildRangeTables(clean);
  } else {
    tables = [buildCompleteGrid(clean)];
  }
  return { tables, summary: computeSummary(tables) };
}

/** Compute summary stats. */
export function computeSummary(tables: Table[]): TableSummary {
  if (tables.length === 0) {
    return {
      totalCells: 0,
      totalTables: 0,
      rangeMin: 0,
      rangeMax: 0,
      maxProduct: 0,
      minProduct: 0,
    };
  }
  let total = 0;
  let max = -Infinity;
  let min = Infinity;
  let baseMin = Infinity;
  let baseMax = -Infinity;
  for (const t of tables) {
    baseMin = Math.min(baseMin, t.base);
    baseMax = Math.max(baseMax, t.base);
    for (const c of t.cells) {
      total++;
      if (c.product > max) max = c.product;
      if (c.product < min) min = c.product;
    }
  }
  return {
    totalCells: total,
    totalTables: tables.length,
    rangeMin: baseMin,
    rangeMax: baseMax,
    maxProduct: max,
    minProduct: min,
  };
}

/** Compute a color (hex string) for a cell based on scheme + product. */
export function cellColor(
  product: number,
  base: number,
  scheme: ColorScheme,
): string {
  if (scheme === "mono") {
    // Grayscale based on absolute value, capped at 100 for sane range.
    const t = Math.min(1, Math.abs(product) / 100);
    const v = Math.round(40 + t * 180);
    return `rgb(${v}, ${v}, ${v})`;
  }
  if (scheme === "blue-scale") {
    const t = Math.min(1, Math.abs(product) / 100);
    const r = Math.round(219 - t * 200);
    const g = Math.round(234 - t * 200);
    const b = Math.round(254 - t * 100);
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (scheme === "green-scale") {
    const t = Math.min(1, Math.abs(product) / 100);
    const r = Math.round(220 - t * 180);
    const g = Math.round(252 - t * 100);
    const b = Math.round(231 - t * 200);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // rainbow — hue derived from base
  const hue = ((base * 37) % 360 + 360) % 360;
  return `hsl(${hue}, 70%, 70%)`;
}

/** Compute the maximum product width (digit count) for alignment. */
export function maxProductWidth(tables: Table[]): number {
  let max = 1;
  for (const t of tables) {
    for (const c of t.cells) {
      const w = String(c.product).length;
      if (w > max) max = w;
    }
  }
  return max;
}

/** Render tables as aligned ASCII text. */
export function renderText(tables: Table[]): string {
  if (tables.length === 0) return "";
  const width = maxProductWidth(tables);
  const padWidth = width + 2;
  const lines: string[] = [];
  for (const t of tables) {
    lines.push(`× Table of ${t.base}`);
    // Header row: × | 1 | 2 | ...
    const headerVals = t.cells.map((c) => c.j);
    const header = ["×".padStart(width)].concat(
      headerVals.map((v) => String(v).padStart(width)),
    );
    lines.push(header.map((h) => h.padEnd(padWidth)).join(""));
    lines.push("-".repeat(padWidth * (header.length)));
    // Body: single-table renders as one column of products; range/grid render as matrix.
    // We treat each cell as (i, j, product). Group by i.
    const rowsByI = new Map<number, Cell[]>();
    for (const c of t.cells) {
      if (!rowsByI.has(c.i)) rowsByI.set(c.i, []);
      rowsByI.get(c.i)!.push(c);
    }
    const is = Array.from(rowsByI.keys()).sort((a, b) => a - b);
    for (const i of is) {
      const rowCells = rowsByI.get(i)!.sort((a, b) => a.j - b.j);
      const rowStr = [String(i).padStart(width)].concat(
        rowCells.map((c) => {
          const s = String(c.product).padStart(width);
          return c.isHighlight ? `[${s}]` : ` ${s} `;
        }),
      );
      lines.push(rowStr.map((c) => c.padEnd(padWidth)).join("").trimEnd());
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Escape HTML special chars. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render tables as an HTML string (printable, colored). */
export function renderHtml(tables: Table[], scheme: ColorScheme): string {
  if (tables.length === 0) return "";
  const parts: string[] = [];
  parts.push(
    `<!doctype html><html><head><meta charset="utf-8"><title>Multiplication Tables</title>`,
  );
  parts.push(`<style>`);
  parts.push(
    `body{font-family:-apple-system,system-ui,sans-serif;color:#111;background:#fff;padding:16px;}`,
  );
  parts.push(`h2{margin:0 0 8px 0;font-size:18px;}`);
  parts.push(`table{border-collapse:collapse;margin-bottom:24px;}`);
  parts.push(
    `td,th{border:1px solid #ccc;padding:6px 10px;text-align:center;min-width:38px;}`,
  );
  parts.push(`th{background:#f5f5f5;font-weight:600;}`);
  parts.push(`td.hi{font-weight:700;outline:2px solid #f59e0b;outline-offset:-2px;}`);
  parts.push(`.table-block{page-break-after:always;}`);
  parts.push(
    `.table-block:last-child{page-break-after:auto;}`,
  );
  parts.push(`</style></head><body>`);
  for (const t of tables) {
    parts.push(`<div class="table-block">`);
    parts.push(`<h2>× Table of ${escapeHtml(String(t.base))}</h2>`);
    // Build matrix: rows = distinct i values, columns = distinct j values.
    const rowsByI = new Map<number, Cell[]>();
    const jSet = new Set<number>();
    for (const c of t.cells) {
      if (!rowsByI.has(c.i)) rowsByI.set(c.i, []);
      rowsByI.get(c.i)!.push(c);
      jSet.add(c.j);
    }
    const js = Array.from(jSet).sort((a, b) => a - b);
    const is = Array.from(rowsByI.keys()).sort((a, b) => a - b);
    parts.push(`<table>`);
    parts.push(`<thead><tr><th>×</th>`);
    for (const j of js) parts.push(`<th>${escapeHtml(String(j))}</th>`);
    parts.push(`</tr></thead><tbody>`);
    for (const i of is) {
      parts.push(`<tr><th>${escapeHtml(String(i))}</th>`);
      const rowCells = rowsByI.get(i)!.sort((a, b) => a.j - b.j);
      const byJ = new Map(rowCells.map((c) => [c.j, c]));
      for (const j of js) {
        const c = byJ.get(j);
        if (c) {
          const color = cellColor(c.product, t.base, scheme);
          const hi = c.isHighlight ? " hi" : "";
          parts.push(
            `<td class="${hi}" style="background:${color}">${escapeHtml(String(c.product))}</td>`,
          );
        } else {
          parts.push(`<td></td>`);
        }
      }
      parts.push(`</tr>`);
    }
    parts.push(`</tbody></table>`);
    parts.push(`</div>`);
  }
  parts.push(`</body></html>`);
  return parts.join("\n");
}

/** Render tables as CSV: base, j, product. */
export function renderCsv(tables: Table[]): string {
  const lines = ["base,multiplier,product"];
  for (const t of tables) {
    for (const c of t.cells) {
      lines.push(`${t.base},${c.j},${c.product}`);
    }
  }
  return lines.join("\n");
}

/** Render tables as a Markdown table. */
export function renderMarkdown(tables: Table[]): string {
  if (tables.length === 0) return "";
  const parts: string[] = [];
  for (const t of tables) {
    parts.push(`## × Table of ${t.base}`);
    parts.push("");
    const jSet = new Set<number>();
    for (const c of t.cells) jSet.add(c.j);
    const js = Array.from(jSet).sort((a, b) => a - b);
    const header = ["×"].concat(js.map(String));
    parts.push(`| ${header.join(" | ")} |`);
    parts.push(`| ${header.map(() => "---").join(" | ")} |`);
    const rowsByI = new Map<number, Cell[]>();
    for (const c of t.cells) {
      if (!rowsByI.has(c.i)) rowsByI.set(c.i, []);
      rowsByI.get(c.i)!.push(c);
    }
    const is = Array.from(rowsByI.keys()).sort((a, b) => a - b);
    for (const i of is) {
      const rowCells = rowsByI.get(i)!.sort((a, b) => a.j - b.j);
      const byJ = new Map(rowCells.map((c) => [c.j, c]));
      const row = [String(i)].concat(
        js.map((j) => {
          const c = byJ.get(j);
          if (!c) return "";
          return c.isHighlight ? `**${c.product}**` : String(c.product);
        }),
      );
      parts.push(`| ${row.join(" | ")} |`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:multiplication-tables-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: Mode;
  startNumber: number;
  endNumber: number;
  tableSize: number;
  totalCells: number;
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

// ---- Shareable URL ----

export function buildShareUrl(input: TableInput): string {
  const params = new URLSearchParams();
  params.set("mode", input.mode);
  params.set("start", String(input.startNumber));
  params.set("end", String(input.endNumber));
  params.set("size", String(input.tableSize));
  params.set("hi", input.highlightMultiples ? "1" : "0");
  params.set("scheme", input.colorScheme);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): TableInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const mode = (params.get("mode") as Mode) || DEFAULT_INPUT.mode;
  const validModes: Mode[] = ["single-table", "range-table", "complete-grid"];
  const finalMode = validModes.includes(mode) ? mode : DEFAULT_INPUT.mode;
  return {
    mode: finalMode,
    startNumber: Number(params.get("start") ?? DEFAULT_INPUT.startNumber),
    endNumber: Number(params.get("end") ?? DEFAULT_INPUT.endNumber),
    tableSize: Number(params.get("size") ?? DEFAULT_INPUT.tableSize),
    highlightMultiples: params.get("hi") !== "0",
    colorScheme:
      (params.get("scheme") as ColorScheme) || DEFAULT_INPUT.colorScheme,
  };
}
