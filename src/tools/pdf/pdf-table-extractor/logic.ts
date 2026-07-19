/**
 * PDF Table Extractor — pure logic.
 *
 * Pure helpers for: page-range parsing, table detection (4 methods),
 * grid-line detection, text clustering, cell extraction, header + merged-cell
 * detection, confidence scoring, table boundary calculation, column/row
 * width+height calculators, 5 output format renderers (CSV / XLSX / HTML /
 * JSON / Markdown), minimal OOXML XLSX generator, pure-JS ZIP builder, history
 * (localStorage), shareable URL, summary stats, multi-table extractor, table
 * quality scorer, cell-type detector.
 *
 * No DOM, no pdf-lib. The PDF content-stream parsing lives in ui.tsx.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutputFormat = "csv" | "excel-xlsx" | "html-table" | "json" | "markdown-table";

export type DetectionMethod = "auto-detect" | "by-grid-lines" | "by-text-alignment" | "by-rules";

export type CellType = "text" | "number" | "date" | "currency" | "empty";

/** A single text fragment with position on the page (PDF user-space). */
export interface TextPosition {
  text: string;
  /** X of left edge (PDF units). */
  x: number;
  /** Y of baseline (PDF units). */
  y: number;
  fontSize: number;
  /** 1-based page number. */
  pageNumber: number;
  bold?: boolean;
}

/** A single detected grid line. */
export interface GridLine {
  /** "horizontal" (constant y, varies x) or "vertical" (constant x, varies y). */
  orientation: "horizontal" | "vertical";
  /** Constant coordinate (y for horizontal, x for vertical). */
  pos: number;
  /** Start coordinate of the line span. */
  start: number;
  /** End coordinate of the line span. */
  end: number;
}

export interface TableCell {
  text: string;
  type: CellType;
  isHeader?: boolean;
  /** True if this cell spans multiple columns (merged). */
  colSpan?: number;
  /** True if this cell spans multiple rows (merged). */
  rowSpan?: number;
}

export interface TableBoundary {
  /** Bounding rectangle in PDF user-space units. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedTable {
  pageNumber: number;
  tableIndex: number;
  rows: TableCell[][];
  hasHeader: boolean;
  /** Quality score 0-100. */
  quality: number;
  /** Confidence score 0-1 (how sure we are this is a table). */
  confidence: number;
  /** Table bounding box in PDF units. */
  boundary: TableBoundary;
  /** Detected grid lines (if any). */
  gridLines: GridLine[];
  /** Column widths (in characters for output rendering). */
  columnWidths?: number[];
  /** Row heights (in lines). */
  rowHeights?: number[];
}

export interface ExtractionResult {
  tables: DetectedTable[];
  detectionMethod: DetectionMethod;
  outputFormat: OutputFormat;
  includeHeaders: boolean;
  mergeCells: boolean;
  minConfidence: number;
}

export interface ConvertOptions {
  pageRange: string;
  detectionMethod: DetectionMethod;
  outputFormat: OutputFormat;
  includeHeaders: boolean;
  mergeCells: boolean;
  minConfidence: number;
  /** Optional user-defined rules (parsed from the rules textarea). */
  rules?: UserRule;
}

export interface UserRule {
  /** Explicit column-x boundaries (sorted ascending). */
  columnXs?: number[];
  /** Row-y tolerance for clustering. */
  rowYTolerance?: number;
  /** Minimum number of rows for a valid table. */
  minRows?: number;
  /** Minimum number of columns for a valid table. */
  minCols?: number;
}

export interface SummaryStats {
  totalPages: number;
  totalTables: number;
  totalRows: number;
  totalColumns: number;
  totalCells: number;
  filledCells: number;
  emptyCells: number;
  avgRowsPerTable: number;
  avgColumnsPerTable: number;
  maxRowsInTable: number;
  maxColumnsInTable: number;
  avgQuality: number;
  avgConfidence: number;
  mergedCells: number;
  byCellType: Record<CellType, number>;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  tableCount: number;
  cellCount: number;
  format: OutputFormat;
  method: DetectionMethod;
}

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

export const OUTPUT_FORMATS: OutputFormat[] = [
  "csv",
  "excel-xlsx",
  "html-table",
  "json",
  "markdown-table",
];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  csv: "CSV (.csv)",
  "excel-xlsx": "Excel (.xlsx)",
  "html-table": "HTML table (.html)",
  json: "JSON (.json)",
  "markdown-table": "Markdown table (.md)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  csv: "csv",
  "excel-xlsx": "xlsx",
  "html-table": "html",
  json: "json",
  "markdown-table": "md",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  csv: "text/csv",
  "excel-xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "html-table": "text/html",
  json: "application/json",
  "markdown-table": "text/markdown",
};

export const DETECTION_METHODS: DetectionMethod[] = [
  "auto-detect",
  "by-grid-lines",
  "by-text-alignment",
  "by-rules",
];

export const METHOD_LABELS: Record<DetectionMethod, string> = {
  "auto-detect": "Auto-detect (recommended)",
  "by-grid-lines": "By grid lines (ruled tables)",
  "by-text-alignment": "By text alignment (un-ruled)",
  "by-rules": "By user-defined rules",
};

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageRange: "all",
  detectionMethod: "auto-detect",
  outputFormat: "csv",
  includeHeaders: true,
  mergeCells: true,
  minConfidence: 0.5,
};

export const MIN_CONFIDENCE = 0;
export const MAX_CONFIDENCE = 1;

// Cell-type regexes
const NUMBER_RE = /^-?\d+(?:,\d{3})*(?:[.,]\d+)?$/;
const CURRENCY_RE = /^[-+]?\s*(?:\$|€|£|¥|₹|₽|₩|US\$|USD|EUR|GBP)\s*-?\d+(?:,\d{3})*(?:[.,]\d+)?$/i;
const DATE_RE =
  /^(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})$/i;

// ---------------------------------------------------------------------------
// Page-range normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all" || trimmed === "*") return "all";
  return trimmed.replace(/\s+/g, "");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

export function expandPageRange(spec: string, pageCount: number): number[] | null {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") {
    return pageCount > 0 ? Array.from({ length: pageCount }, (_, i) => i) : [];
  }
  const out: number[] = [];
  for (const part of normalized.split(",")) {
    if (!part) continue;
    const range = part.match(/^(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] === "" ? 1 : Number(range[1]);
      const end = range[2] === "" ? pageCount : Number(range[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (start < 1 || end > pageCount || start > end) return null;
      for (let i = start; i <= end; i++) out.push(i - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n < 1 || n > pageCount) return null;
      out.push(n - 1);
      continue;
    }
    return null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cell-type detection
// ---------------------------------------------------------------------------

export function detectCellType(text: string): CellType {
  const t = (text ?? "").trim();
  if (!t) return "empty";
  if (CURRENCY_RE.test(t)) return "currency";
  if (DATE_RE.test(t)) return "date";
  if (NUMBER_RE.test(t)) return "number";
  if (/^-?\d+(?:[.,]\d+)?\s*%$/.test(t)) return "number";
  return "text";
}

export function formatNumericCell(text: string, type: CellType): string {
  if (type === "empty") return "";
  if (type === "text" || type === "date") return text;
  const stripped = text
    .replace(/[€$£¥₹₽₩]/g, "")
    .replace(/^(?:US\$|USD|EUR|GBP)\s*/i, "")
    .replace(/\s*%$/, "")
    .replace(/\s+/g, "");
  const hasComma = stripped.includes(",");
  const hasDot = stripped.includes(".");
  if (hasComma && hasDot) {
    // Determine which is the decimal separator (rightmost one)
    if (stripped.lastIndexOf(",") > stripped.lastIndexOf(".")) {
      // EU: . is thousands, , is decimal
      return stripped.replace(/\./g, "").replace(",", ".");
    }
    // US: , is thousands, . is decimal
    return stripped.replace(/,/g, "");
  }
  if (hasComma) {
    // Only commas — assume US thousands when followed by 3 digits; otherwise decimal comma
    return stripped
      .replace(/,(?=\d{3}(\D|$))/g, "")
      .replace(/,/g, ".");
  }
  return stripped;
}

// ---------------------------------------------------------------------------
// Text clustering — rows by y, columns by x
// ---------------------------------------------------------------------------

/** Cluster text items into rows by their y-coordinate (descending y = top first). */
export function clusterRows(items: TextPosition[], yTolerance = 3): TextPosition[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: TextPosition[][] = [];
  let currentRow: TextPosition[] = [sorted[0]];
  let currentY = sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    if (Math.abs(it.y - currentY) <= yTolerance) {
      currentRow.push(it);
    } else {
      rows.push(currentRow);
      currentRow = [it];
      currentY = it.y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

/** Detect column boundaries by clustering x-starts (returns sorted column-left-x list). */
export function detectColumnBoundaries(rows: TextPosition[][], minGap = 8): number[] {
  if (rows.length === 0) return [];
  const allX: number[] = [];
  for (const row of rows) for (const it of row) allX.push(it.x);
  allX.sort((a, b) => a - b);
  if (allX.length === 0) return [];
  const cols: number[] = [allX[0]];
  for (let i = 1; i < allX.length; i++) {
    if (allX[i] - cols[cols.length - 1] >= minGap) cols.push(allX[i]);
  }
  return cols;
}

/** Assign text items in a row to column buckets based on column boundaries. */
export function assignToColumns(
  row: TextPosition[],
  columns: number[],
): TextPosition[][] {
  const buckets: TextPosition[][] = columns.map(() => []);
  for (const item of row) {
    let idx = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= item.x) idx = i;
      else break;
    }
    buckets[idx].push(item);
  }
  return buckets;
}

/** Merge items in a column bucket into a single cell text. */
export function mergeColumnItems(bucket: TextPosition[]): { text: string; bold?: boolean } {
  if (bucket.length === 0) return { text: "" };
  const text = bucket.map((b) => b.text).join(" ").replace(/\s+/g, " ").trim();
  const bold = bucket.some((b) => b.bold);
  return { text, bold };
}

// ---------------------------------------------------------------------------
// Grid-line detector
// ---------------------------------------------------------------------------

/**
 * Detect grid lines from a content stream's vector operations.
 *
 * The UI passes a list of line segments (each described by orientation +
 * position + span) extracted from the PDF. This function clusters segments
 * that share (approximately) the same constant coordinate into single
 * GridLine entries spanning the union of their start/end values.
 */
export function detectGridLines(
  segments: Array<{ orientation: "horizontal" | "vertical"; pos: number; start: number; end: number }>,
  tolerance = 2,
): GridLine[] {
  const horizontal = segments.filter((s) => s.orientation === "horizontal");
  const vertical = segments.filter((s) => s.orientation === "vertical");
  return [...clusterLines(horizontal, tolerance), ...clusterLines(vertical, tolerance)];
}

function clusterLines(
  segments: Array<{ orientation: "horizontal" | "vertical"; pos: number; start: number; end: number }>,
  tolerance: number,
): GridLine[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.pos - b.pos);
  const out: GridLine[] = [];
  let group = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].pos - group[0].pos) <= tolerance) {
      group.push(sorted[i]);
    } else {
      out.push(mergeGroup(group));
      group = [sorted[i]];
    }
  }
  out.push(mergeGroup(group));
  return out;
}

function mergeGroup(
  group: Array<{ orientation: "horizontal" | "vertical"; pos: number; start: number; end: number }>,
): GridLine {
  const pos = group.reduce((s, g) => s + g.pos, 0) / group.length;
  const start = Math.min(...group.map((g) => g.start));
  const end = Math.max(...group.map((g) => g.end));
  return {
    orientation: group[0].orientation,
    pos,
    start,
    end,
  };
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

export function detectHeader(rows: TextPosition[][]): boolean {
  if (rows.length === 0) return false;
  const first = rows[0];
  if (first.length === 0) return false;
  const boldCount = first.filter((it) => it.bold).length;
  if (boldCount / first.length >= 0.5) return true;
  const firstAllText = first.every(
    (it) => detectCellType(it.text) === "text" || detectCellType(it.text) === "empty",
  );
  const belowHasNumbers = rows.slice(1).some((row) =>
    row.some((it) => {
      const t = detectCellType(it.text);
      return t === "number" || t === "currency" || t === "date";
    }),
  );
  if (firstAllText && belowHasNumbers && first.length >= 2) return true;
  const firstAvgLen = first.reduce((s, it) => s + it.text.length, 0) / first.length;
  const restAvgLen =
    rows.slice(1).reduce((s, row) => s + row.reduce((s2, it) => s2 + it.text.length, 0), 0) /
    Math.max(1, rows.slice(1).reduce((s, row) => s + row.length, 0));
  if (firstAvgLen < restAvgLen * 0.6 && firstAvgLen < 20) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Merged-cell detector
// ---------------------------------------------------------------------------

/**
 * Detect merged cells by looking for cells that span multiple rows or
 * columns. A cell is considered merged if it is present in a row but its
 * column neighbors are empty in adjacent rows.
 *
 * Returns a copy of the table rows with `colSpan` / `rowSpan` annotations
 * where appropriate. (Simplified heuristic — does not implement full
 * OOXML merge semantics.)
 */
export function detectMergedCells(rows: TableCell[][]): TableCell[][] {
  if (rows.length === 0) return rows;
  const maxCols = Math.max(...rows.map((r) => r.length));
  const out = rows.map((r) => r.map((c) => ({ ...c })));
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out[r].length; c++) {
      const cell = out[r][c];
      if (!cell || cell.type === "empty" || !cell.text) continue;
      // Check for rowSpan: same text in same column of consecutive rows
      let rs = 1;
      while (
        r + rs < out.length &&
        c < out[r + rs].length &&
        out[r + rs][c] &&
        out[r + rs][c]!.text === cell.text
      ) {
        // Mark the duplicate cell as a "continuation" (colSpan/rowSpan = 0)
        out[r + rs][c] = { ...out[r + rs][c]!, text: "", type: "empty", rowSpan: 0 };
        rs++;
      }
      if (rs > 1) cell.rowSpan = rs;
      // Check for colSpan: same text in same row of consecutive columns
      let cs = 1;
      while (
        c + cs < out[r].length &&
        out[r][c + cs] &&
        out[r][c + cs]!.text === cell.text
      ) {
        out[r][c + cs] = { ...out[r][c + cs]!, text: "", type: "empty", colSpan: 0 };
        cs++;
      }
      if (cs > 1) cell.colSpan = cs;
    }
    // pad row to maxCols
    while (out[r].length < maxCols) {
      out[r].push({ text: "", type: "empty" });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Confidence scorer (0-1)
// ---------------------------------------------------------------------------

/**
 * Compute a confidence score 0-1 for a candidate table.
 * Combines: alignment ratio, row-count factor, column-count factor, row-consistency.
 */
export function scoreConfidence(rows: TextPosition[][], columns: number[]): number {
  if (rows.length < 2 || columns.length < 2) return 0;
  let totalItems = 0;
  let alignedItems = 0;
  for (const row of rows) {
    for (const item of row) {
      totalItems++;
      if (columns.some((c) => Math.abs(c - item.x) <= 6)) alignedItems++;
    }
  }
  if (totalItems === 0) return 0;
  const alignmentRatio = alignedItems / totalItems;
  const sizeFactor = Math.min(1, (rows.length * columns.length) / 30);
  const rowLens = rows.map((r) => r.length);
  const meanLen = rowLens.reduce((s, n) => s + n, 0) / rowLens.length;
  const variance = rowLens.reduce((s, n) => s + (n - meanLen) ** 2, 0) / rowLens.length;
  const consistency = Math.max(0, 1 - Math.sqrt(variance) / Math.max(1, meanLen));
  const score = alignmentRatio * 0.5 + sizeFactor * 0.2 + consistency * 0.3;
  return Math.max(0, Math.min(1, score));
}

/** Compute a quality score 0-100 (same formula, scaled). */
export function scoreTableQuality(rows: TextPosition[][], columns: number[]): number {
  return Math.round(scoreConfidence(rows, columns) * 100);
}

// ---------------------------------------------------------------------------
// Table boundary calculator
// ---------------------------------------------------------------------------

/** Compute the bounding rectangle of a table from its text items. */
export function computeTableBoundary(items: TextPosition[]): TableBoundary {
  if (items.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x);
    maxX = Math.max(maxX, it.x + (it.fontSize || 10) * 0.5 * (it.text.length || 1));
    minY = Math.min(minY, it.y - (it.fontSize || 10));
    maxY = Math.max(maxY, it.y);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// Column / row width+height calculators
// ---------------------------------------------------------------------------

/** Compute auto-fit column widths (in characters) — min 3, max 60. */
export function computeColumnWidths(table: DetectedTable): number[] {
  if (table.rows.length === 0) return [];
  const colCount = Math.max(...table.rows.map((r) => r.length));
  const widths: number[] = new Array(colCount).fill(0);
  for (const row of table.rows) {
    for (let c = 0; c < row.length; c++) {
      widths[c] = Math.max(widths[c], row[c].text.length);
    }
  }
  return widths.map((w) => Math.max(3, Math.min(60, w)));
}

/** Compute row heights (in lines) — 1 for single-line, more for multi-line cells. */
export function computeRowHeights(table: DetectedTable): number[] {
  return table.rows.map((row) => {
    let max = 1;
    for (const cell of row) {
      const lines = (cell.text.match(/\n/g) ?? []).length + 1;
      if (lines > max) max = lines;
    }
    return max;
  });
}

// ---------------------------------------------------------------------------
// Empty-cell normalizer (pad ragged rows)
// ---------------------------------------------------------------------------

export function normalizeTableGrid(table: DetectedTable): DetectedTable {
  if (table.rows.length === 0) return table;
  const colCount = Math.max(...table.rows.map((r) => r.length));
  const rows = table.rows.map((row) => {
    if (row.length === colCount) return row;
    const padded = [...row];
    while (padded.length < colCount) padded.push({ text: "", type: "empty" as CellType });
    return padded;
  });
  return { ...table, rows };
}

// ---------------------------------------------------------------------------
// Single-table detector — combines clustering + boundary + confidence
// ---------------------------------------------------------------------------

export function detectTable(
  items: TextPosition[],
  pageNumber: number,
  tableIndex: number,
  method: DetectionMethod,
  includeHeaders: boolean,
  mergeCells: boolean,
  rules?: UserRule,
): DetectedTable | null {
  if (items.length < 4) return null;
  const yTol =
    method === "by-grid-lines" ? 1.5
      : method === "by-text-alignment" ? 6
        : rules?.rowYTolerance ?? 3;
  const minGap =
    method === "by-grid-lines" ? 4
      : method === "by-text-alignment" ? 16
        : 8;
  const rows = clusterRows(items, yTol);
  if (rows.length < 2) return null;
  // Merge items within a row that overlap (same x) — usually line-wrap fragments.
  const dedupedRows = rows.map((row) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const merged: TextPosition[] = [];
    for (const it of sorted) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(last.x - it.x) < 2 && Math.abs(last.y - it.y) < 2) {
        last.text += it.text;
      } else {
        merged.push({ ...it });
      }
    }
    return merged;
  });
  // Use rules.columnXs if provided, otherwise detect.
  const columns = rules?.columnXs && rules.columnXs.length >= 2
    ? [...rules.columnXs].sort((a, b) => a - b)
    : detectColumnBoundaries(dedupedRows, minGap);
  const minCols = rules?.minCols ?? 2;
  if (columns.length < minCols) return null;
  const confidence = scoreConfidence(dedupedRows, columns);
  const quality = Math.round(confidence * 100);
  // Build cell grid.
  let cellRows: TableCell[][] = dedupedRows.map((row) => {
    const buckets = assignToColumns(row, columns);
    return buckets.map((bucket) => {
      const { text } = mergeColumnItems(bucket);
      const type = detectCellType(text);
      return { text, type };
    });
  });
  const hasHeader = includeHeaders ? detectHeader(dedupedRows) : false;
  if (hasHeader && cellRows.length > 0) {
    cellRows[0] = cellRows[0].map((c) => ({ ...c, isHeader: true }));
  }
  if (mergeCells) {
    cellRows = detectMergedCells(cellRows);
  }
  const boundary = computeTableBoundary(items);
  return {
    pageNumber,
    tableIndex,
    rows: cellRows,
    hasHeader,
    quality,
    confidence,
    boundary,
    gridLines: [],
  };
}

/**
 * Detect multiple tables on a page by splitting text items at large y-gaps.
 */
export function detectMultipleTables(
  items: TextPosition[],
  pageNumber: number,
  method: DetectionMethod,
  includeHeaders: boolean,
  mergeCells: boolean,
  rules?: UserRule,
): DetectedTable[] {
  if (items.length < 4) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const gapThreshold = 30;
  const groups: TextPosition[][] = [];
  let current: TextPosition[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const it = sorted[i];
    if (prev.y - it.y > gapThreshold) {
      groups.push(current);
      current = [];
    }
    current.push(it);
  }
  if (current.length > 0) groups.push(current);
  const tables: DetectedTable[] = [];
  let idx = 0;
  for (const group of groups) {
    const table = detectTable(group, pageNumber, idx, method, includeHeaders, mergeCells, rules);
    if (table && table.rows.length >= 2 && table.rows[0].length >= 2) {
      tables.push(table);
      idx++;
    }
  }
  return tables;
}

// ---------------------------------------------------------------------------
// User-rules parser
// ---------------------------------------------------------------------------

/**
 * Parse the user-rules textarea. Accepts either:
 *   1. JSON: `{ "columnXs": [50, 200, 350, 500], "rowYTolerance": 4 }`
 *   2. Line-based: `cols: 50, 200, 350, 500` and `ytol: 4` and `minrows: 2` and `mincols: 2`
 *
 * Returns null on parse failure.
 */
export function parseUserRules(input: string): UserRule | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  // Try JSON first.
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const rule: UserRule = {};
      if (Array.isArray(obj.columnXs)) {
        rule.columnXs = (obj.columnXs as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n));
      }
      if (typeof obj.rowYTolerance === "number") rule.rowYTolerance = obj.rowYTolerance;
      if (typeof obj.minRows === "number") rule.minRows = obj.minRows;
      if (typeof obj.minCols === "number") rule.minCols = obj.minCols;
      return rule;
    } catch {
      return null;
    }
  }
  // Line-based.
  const rule: UserRule = {};
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\w+)\s*[:=]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "cols" || key === "columnxs") {
      rule.columnXs = val.split(/[, ]+/).map((n) => Number(n)).filter((n) => Number.isFinite(n));
    } else if (key === "ytol" || key === "rowytolerance") {
      const n = Number(val);
      if (Number.isFinite(n)) rule.rowYTolerance = n;
    } else if (key === "minrows") {
      const n = Number(val);
      if (Number.isFinite(n)) rule.minRows = n;
    } else if (key === "mincols") {
      const n = Number(val);
      if (Number.isFinite(n)) rule.minCols = n;
    }
  }
  if (!rule.columnXs && rule.rowYTolerance === undefined && !rule.minRows && !rule.minCols) {
    return null;
  }
  return rule;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(result: ExtractionResult): SummaryStats {
  const tables = result.tables;
  const totalTables = tables.length;
  const totalRows = tables.reduce((s, t) => s + t.rows.length, 0);
  const totalColumns = tables.reduce((s, t) => s + Math.max(0, ...t.rows.map((r) => r.length)), 0);
  const totalCells = tables.reduce(
    (s, t) => s + t.rows.reduce((s2, r) => s2 + r.length, 0),
    0,
  );
  const filledCells = tables.reduce(
    (s, t) => s + t.rows.reduce((s2, r) => s2 + r.filter((c) => c.type !== "empty").length, 0),
    0,
  );
  const emptyCells = totalCells - filledCells;
  const pageSet = new Set(tables.map((t) => t.pageNumber));
  const byCellType: Record<CellType, number> = {
    text: 0, number: 0, date: 0, currency: 0, empty: 0,
  };
  let mergedCells = 0;
  for (const t of tables) {
    for (const row of t.rows) {
      for (const cell of row) {
        byCellType[cell.type] = (byCellType[cell.type] ?? 0) + 1;
        if ((cell.colSpan ?? 0) > 1 || (cell.rowSpan ?? 0) > 1) mergedCells++;
      }
    }
  }
  return {
    totalPages: pageSet.size,
    totalTables,
    totalRows,
    totalColumns,
    totalCells,
    filledCells,
    emptyCells,
    avgRowsPerTable: totalTables === 0 ? 0 : Math.round((totalRows / totalTables) * 10) / 10,
    avgColumnsPerTable: totalTables === 0 ? 0 : Math.round((totalColumns / totalTables) * 10) / 10,
    maxRowsInTable: tables.reduce((s, t) => Math.max(s, t.rows.length), 0),
    maxColumnsInTable: tables.reduce(
      (s, t) => Math.max(s, ...t.rows.map((r) => r.length)),
      0,
    ),
    avgQuality: totalTables === 0 ? 0 : Math.round(tables.reduce((s, t) => s + t.quality, 0) / totalTables),
    avgConfidence: totalTables === 0 ? 0 : Math.round((tables.reduce((s, t) => s + t.confidence, 0) / totalTables) * 100) / 100,
    mergedCells,
    byCellType,
  };
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export function escapeXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeCsv(s: string): string {
  const t = s ?? "";
  if (/[",\n\r]/.test(t) || /^\s|\s$/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeMarkdown(s: string): string {
  // Escape pipe characters in Markdown table cells.
  return (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

export function renderTableCsv(table: DetectedTable): string {
  const norm = normalizeTableGrid(table);
  return norm.rows
    .map((row) => row.map((c) => escapeCsv(c.text)).join(","))
    .join("\n");
}

export function renderCsv(result: ExtractionResult): string {
  const parts: string[] = [];
  for (const table of result.tables) {
    parts.push(`# Table ${table.tableIndex + 1} (page ${table.pageNumber}, confidence ${table.confidence.toFixed(2)}, quality ${table.quality})`);
    parts.push(renderTableCsv(table));
    parts.push("");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function renderTableHtml(table: DetectedTable): string {
  const norm = normalizeTableGrid(table);
  const rows = norm.rows.map((row, ri) => {
    const tag = (table.hasHeader && ri === 0) ? "th" : "td";
    const cells = row
      .map((c) => {
        const span = c.colSpan && c.colSpan > 1 ? ` colspan="${c.colSpan}"` : "";
        const rspan = c.rowSpan && c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : "";
        return `    <${tag} class="cell-${c.type}"${span}${rspan}>${escapeHtml(c.text)}</${tag}>`;
      })
      .join("\n");
    return `  <tr>\n${cells}\n  </tr>`;
  });
  return `<table data-page="${table.pageNumber}" data-quality="${table.quality}">\n${rows.join("\n")}\n</table>`;
}

export function renderHtml(result: ExtractionResult): string {
  const body = result.tables.map((t) => renderTableHtml(t)).join("\n<hr/>\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PDF Tables</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; }
table { border-collapse: collapse; margin: 1rem 0; }
td, th { border: 1px solid #ccc; padding: 4px 8px; }
th { background: #f0f0f0; font-weight: bold; }
.cell-number, .cell-currency { text-align: right; }
.cell-empty { background: #fafafa; color: #ccc; }
hr { border: none; border-top: 1px dashed #ccc; margin: 2rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function renderTableJson(table: DetectedTable): string[][] {
  return normalizeTableGrid(table).rows.map((row) => row.map((c) => c.text));
}

export function renderJson(result: ExtractionResult): string {
  const data = result.tables.map((t) => ({
    page: t.pageNumber,
    index: t.tableIndex,
    quality: t.quality,
    confidence: t.confidence,
    hasHeader: t.hasHeader,
    boundary: t.boundary,
    rows: renderTableJson(t),
  }));
  return JSON.stringify(data, null, 2);
}

/** Render a single table as a Markdown table. */
export function renderTableMarkdown(table: DetectedTable): string {
  const norm = normalizeTableGrid(table);
  if (norm.rows.length === 0) return "";
  const colCount = norm.rows[0].length;
  const header = norm.rows[0].map((c) => escapeMarkdown(c.text) || " ").join(" | ");
  const sep = Array(colCount).fill("---").join(" | ");
  const body = norm.rows.slice(1).map((row) =>
    row.map((c) => escapeMarkdown(c.text) || " ").join(" | "),
  ).join("\n");
  return `| ${header} |\n| ${sep} |\n${body.split("\n").map((r) => `| ${r} |`).join("\n")}`;
}

export function renderMarkdown(result: ExtractionResult): string {
  const parts: string[] = [];
  for (const table of result.tables) {
    parts.push(`## Table ${table.tableIndex + 1} (page ${table.pageNumber})`);
    parts.push(`Confidence: ${table.confidence.toFixed(2)} • Quality: ${table.quality}`);
    parts.push("");
    parts.push(renderTableMarkdown(table));
    parts.push("");
  }
  return parts.join("\n").trim();
}

export function renderOutput(result: ExtractionResult): string {
  switch (result.outputFormat) {
    case "csv": return renderCsv(result);
    case "html-table": return renderHtml(result);
    case "json": return renderJson(result);
    case "markdown-table": return renderMarkdown(result);
    case "excel-xlsx": return "(XLSX is a binary file — use the Download button.)";
    default: return renderCsv(result);
  }
}

export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// Minimal XLSX (SpreadsheetML) XML generator
// ---------------------------------------------------------------------------

export function buildSharedStrings(tables: DetectedTable[]): { xml: string; index: Map<string, number> } {
  const index = new Map<string, number>();
  const list: string[] = [];
  let count = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      for (const cell of row) {
        if (cell.type === "text" || cell.type === "empty") {
          if (!index.has(cell.text)) {
            index.set(cell.text, list.length);
            list.push(cell.text);
          }
          count++;
        }
      }
    }
  }
  const items = list.map((s) => `  <si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${list.length}">
${items}
</sst>`;
  return { xml, index };
}

export function columnLetter(colIndex: number): string {
  let n = colIndex + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildSheetXml(tables: DetectedTable[], sharedIndex: Map<string, number>): string {
  const rowsXml: string[] = [];
  let rowIdx = 1;
  for (const table of tables) {
    const norm = normalizeTableGrid(table);
    for (let r = 0; r < norm.rows.length; r++) {
      const cells = norm.rows[r];
      const cellsXml: string[] = [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const ref = `${columnLetter(c)}${rowIdx}`;
        const isHeaderCell = cell.isHeader || (table.hasHeader && r === 0);
        const styleAttr = isHeaderCell ? ' s="1"' : "";
        if (cell.type === "empty") {
          cellsXml.push(`        <c r="${ref}"${styleAttr}/>`);
        } else if (cell.type === "number" || cell.type === "currency") {
          const val = formatNumericCell(cell.text, cell.type);
          cellsXml.push(`        <c r="${ref}"${styleAttr}><v>${escapeXml(val)}</v></c>`);
        } else {
          const si = sharedIndex.get(cell.text);
          if (si !== undefined) {
            cellsXml.push(`        <c r="${ref}" t="sharedString"${styleAttr}><v>${si}</v></c>`);
          } else {
            cellsXml.push(`        <c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(cell.text)}</t></is></c>`);
          }
        }
      }
      rowsXml.push(`      <row r="${rowIdx}">\n${cellsXml.join("\n")}\n      </row>`);
      rowIdx++;
    }
    rowIdx++; // blank row between tables
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${rowsXml.join("\n")}
  </sheetData>
</worksheet>`;
}

export function buildWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tables" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

export function buildWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

export function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4472C4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;
}

export function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

export function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// ZIP file builder (store mode + CRC-32) — for XLSX packaging
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    pushU32(out, 0x04034b50);
    pushU16(out, 20);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU32(out, crc);
    pushU32(out, size);
    pushU32(out, size);
    pushU16(out, nameBytes.length);
    pushU16(out, 0);
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20);
    pushU16(centralDir, 20);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, 0);
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  pushU32(out, 0x06054b50);
  pushU16(out, 0);
  pushU16(out, 0);
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0);
  return new Uint8Array(out);
}

export function buildXlsxPackage(result: ExtractionResult): Uint8Array {
  const { xml: sharedStringsXml, index } = buildSharedStrings(result.tables);
  const sheetXml = buildSheetXml(result.tables, index);
  const files: ZipFile[] = [
    { name: "[Content_Types].xml", bytes: utf8Encode(buildContentTypesXml()) },
    { name: "_rels/.rels", bytes: utf8Encode(buildRootRelsXml()) },
    { name: "xl/workbook.xml", bytes: utf8Encode(buildWorkbookXml()) },
    { name: "xl/_rels/workbook.xml.rels", bytes: utf8Encode(buildWorkbookRelsXml()) },
    { name: "xl/worksheets/sheet1.xml", bytes: utf8Encode(sheetXml) },
    { name: "xl/sharedStrings.xml", bytes: utf8Encode(sharedStringsXml) },
    { name: "xl/styles.xml", bytes: utf8Encode(buildStylesXml()) },
  ];
  return buildZip(files);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-table-extractor:history";
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
      // ignore quota errors
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

const VALID_FORMATS = new Set<OutputFormat>([
  "csv", "excel-xlsx", "html-table", "json", "markdown-table",
]);
const VALID_METHODS = new Set<DetectionMethod>([
  "auto-detect", "by-grid-lines", "by-text-alignment", "by-rules",
]);

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.detectionMethod !== "auto-detect") params.set("method", opts.detectionMethod);
  if (opts.outputFormat !== "csv") params.set("format", opts.outputFormat);
  if (!opts.includeHeaders) params.set("headers", "0");
  if (!opts.mergeCells) params.set("merge", "0");
  if (Number.isFinite(opts.minConfidence) && opts.minConfidence !== 0.5) {
    params.set("conf", String(opts.minConfidence));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConvertOptions> = {};
  const range = params.get("range");
  if (range) out.pageRange = range;
  const method = params.get("method");
  if (method && VALID_METHODS.has(method as DetectionMethod)) out.detectionMethod = method as DetectionMethod;
  const format = params.get("format");
  if (format && VALID_FORMATS.has(format as OutputFormat)) out.outputFormat = format as OutputFormat;
  const headers = params.get("headers");
  if (headers !== null) out.includeHeaders = headers !== "0";
  const merge = params.get("merge");
  if (merge !== null) out.mergeCells = merge !== "0";
  const conf = Number(params.get("conf"));
  if (Number.isFinite(conf)) out.minConfidence = Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, conf));
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: ConvertOptions, pageCount: number): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!OUTPUT_FORMATS.includes(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  if (!DETECTION_METHODS.includes(opts.detectionMethod)) {
    return { ok: false, error: `Unknown detection method: ${opts.detectionMethod}` };
  }
  if (
    !Number.isFinite(opts.minConfidence) ||
    opts.minConfidence < MIN_CONFIDENCE ||
    opts.minConfidence > MAX_CONFIDENCE
  ) {
    return { ok: false, error: `Min confidence must be between ${MIN_CONFIDENCE} and ${MAX_CONFIDENCE}.` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s*]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
