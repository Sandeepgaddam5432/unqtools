/**
 * PDF to Excel Converter — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The PDF content-stream parsing
 * (with positional data) lives in ui.tsx; this module handles table detection,
 * grid clustering, header inference, cell-type detection, XLSX/CSV/HTML/JSON
 * rendering, ZIP packaging, history, and shareable URLs.
 */

export type OutputFormat = "xlsx" | "csv" | "html-table" | "json";

export const OUTPUT_FORMATS: OutputFormat[] = ["xlsx", "csv", "html-table", "json"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  "html-table": "HTML table (.html)",
  json: "JSON (.json)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  xlsx: "xlsx",
  csv: "csv",
  "html-table": "html",
  json: "json",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  "html-table": "text/html",
  json: "application/json",
};

export type DetectionMethod = "auto-detect" | "by-position" | "by-text-grid";

export const DETECTION_METHODS: DetectionMethod[] = ["auto-detect", "by-position", "by-text-grid"];

export const METHOD_LABELS: Record<DetectionMethod, string> = {
  "auto-detect": "Auto-detect (recommended)",
  "by-position": "By position (tight grid)",
  "by-text-grid": "By text grid (loose)",
};

export type CellType = "text" | "number" | "date" | "currency" | "empty";

/**
 * A single text fragment with its position on the page.
 * Coordinates are in PDF user-space units (origin bottom-left, y grows up).
 */
export interface TextPosition {
  text: string;
  /** X coordinate of the text's left edge (in PDF units). */
  x: number;
  /** Y coordinate of the text's baseline (in PDF units). */
  y: number;
  /** Font size in points (0 if unknown). */
  fontSize: number;
  /** 1-based page number. */
  pageNumber: number;
  /** Width estimate of the text (in PDF units). 0 if unknown. */
  width?: number;
  /** True if the text is bold. */
  bold?: boolean;
}

/** A single table cell. */
export interface TableCell {
  /** Cell text content. Empty string for empty cells. */
  text: string;
  /** Detected cell type. */
  type: CellType;
  /** True if this cell is in the header row. */
  isHeader?: boolean;
}

/** A detected table on a specific page. */
export interface DetectedTable {
  /** 1-based page number where the table was found. */
  pageNumber: number;
  /** Index of this table within its page (0-based). */
  tableIndex: number;
  /** Grid of cells: rows × columns. */
  rows: TableCell[][];
  /** True if the first row is detected as a header. */
  hasHeader: boolean;
  /** Quality score 0-100 (higher = more table-like). */
  quality: number;
}

/** Whole extraction result. */
export interface ExtractionResult {
  tables: DetectedTable[];
  detectionMethod: DetectionMethod;
  outputFormat: OutputFormat;
  includeHeaders: boolean;
}

export interface ConvertOptions {
  pageRange: string;
  detectionMethod: DetectionMethod;
  outputFormat: OutputFormat;
  includeHeaders: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageRange: "all",
  detectionMethod: "auto-detect",
  outputFormat: "xlsx",
  includeHeaders: true,
};

export interface SummaryStats {
  totalPages: number;
  totalTables: number;
  totalRows: number;
  totalColumns: number;
  totalCells: number;
  avgRowsPerTable: number;
  avgColumnsPerTable: number;
  maxRowsInTable: number;
  maxColumnsInTable: number;
  filledCells: number;
  emptyCells: number;
  avgQuality: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  tableCount: number;
  cellCount: number;
  format: OutputFormat;
}

// ---------------------------------------------------------------------------
// Page-range spec normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Cell-type detection
// ---------------------------------------------------------------------------

const NUMBER_RE = /^-?\d+(?:,\d{3})*(?:[.,]\d+)?$/;
const CURRENCY_RE = /^[-+]?\s*(?:\$|€|£|¥|₹|₽|₩|US\$|USD|EUR|GBP)\s*-?\d+(?:,\d{3})*(?:[.,]\d+)?$/i;
const DATE_RE =
  /^(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})$/i;

/** Detect the type of a cell based on its text content. */
export function detectCellType(text: string): CellType {
  const t = (text ?? "").trim();
  if (!t) return "empty";
  if (CURRENCY_RE.test(t)) return "currency";
  if (DATE_RE.test(t)) return "date";
  if (NUMBER_RE.test(t)) {
    // Treat integers and decimals as numbers
    return "number";
  }
  // Percentages are numbers in disguise
  if (/^-?\d+(?:[.,]\d+)?\s*%$/.test(t)) return "number";
  return "text";
}

/** Normalize a number/currency string for spreadsheet output (strip currency symbols, comma thousands). */
export function formatNumericCell(text: string, type: CellType): string {
  if (type === "empty") return "";
  if (type === "text" || type === "date") return text;
  // number or currency
  const cleaned = text
    .replace(/[€$£¥₹₽₩]/g, "")
    .replace(/^(?:US\$|USD|EUR|GBP)\s*/i, "")
    .replace(/\s*%$/, "")
    .replace(/\s+/g, "")
    .replace(/,(?=\d{3}\b)/g, "") // remove thousands separators (1,234,567 → 1234567)
    .replace(/,/g, "."); // decimal comma → decimal point
  return cleaned;
}

// ---------------------------------------------------------------------------
// Table detection — clustering by y (rows) then x (columns)
// ---------------------------------------------------------------------------

/**
 * Cluster text positions into rows by their y-coordinate.
 * Two items belong to the same row if their y values are within `yTolerance`.
 */
export function clusterRows(items: TextPosition[], yTolerance = 3): TextPosition[][] {
  if (items.length === 0) return [];
  // Sort by descending y (top of page first in PDF user space where y grows up)
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

/**
 * Given the rows of a page, find column boundaries by looking for common
 * x-gaps across all rows. Returns a sorted list of column-left-x values.
 */
export function detectColumnBoundaries(rows: TextPosition[][], minGap = 8): number[] {
  if (rows.length === 0) return [];
  // Collect all x-starts, sorted
  const allX: number[] = [];
  for (const row of rows) {
    for (const it of row) allX.push(it.x);
  }
  allX.sort((a, b) => a - b);
  if (allX.length === 0) return [];
  // Cluster nearby x values (within minGap) into column-left positions
  const cols: number[] = [allX[0]];
  for (let i = 1; i < allX.length; i++) {
    if (allX[i] - cols[cols.length - 1] >= minGap) {
      cols.push(allX[i]);
    }
  }
  return cols;
}

/** Assign each text item in a row to a column index based on column boundaries. */
export function assignToColumns(
  row: TextPosition[],
  columns: number[],
): { col: number; text: string; bold?: boolean }[][] {
  // Returns an array of column buckets; each bucket has the items that belong to it
  const buckets: { col: number; text: string; bold?: boolean }[][] = columns.map((_, i) => []);
  for (const item of row) {
    // Find the rightmost column boundary that is <= item.x
    let idx = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= item.x) idx = i;
      else break;
    }
    buckets[idx].push({ col: idx, text: item.text, bold: item.bold });
  }
  return buckets;
}

/** Merge items in a column bucket into a single cell text (joined by spaces). */
export function mergeColumnItems(
  bucket: { col: number; text: string; bold?: boolean }[],
): { text: string; bold?: boolean } {
  if (bucket.length === 0) return { text: "" };
  const text = bucket
    .map((b) => b.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const bold = bucket.some((b) => b.bold);
  return { text, bold };
}

/** Detect whether the first row is a header row (heuristic: bold, or all-text, or short). */
export function detectHeader(rows: TextPosition[][]): boolean {
  if (rows.length === 0) return false;
  const first = rows[0];
  if (first.length === 0) return false;
  // If most items in first row are bold → header
  const boldCount = first.filter((it) => it.bold).length;
  if (boldCount / first.length >= 0.5) return true;
  // If first row is all-text and rows below contain numbers → header
  const firstAllText = first.every((it) => detectCellType(it.text) === "text" || detectCellType(it.text) === "empty");
  const belowHasNumbers = rows.slice(1).some((row) =>
    row.some((it) => {
      const t = detectCellType(it.text);
      return t === "number" || t === "currency" || t === "date";
    }),
  );
  if (firstAllText && belowHasNumbers && first.length >= 2) return true;
  // If first row text is shorter (avg) than the rest → likely header labels
  const firstAvgLen = first.reduce((s, it) => s + it.text.length, 0) / first.length;
  const restAvgLen =
    rows.slice(1).reduce((s, row) => s + row.reduce((s2, it) => s2 + it.text.length, 0), 0) /
    Math.max(1, rows.slice(1).reduce((s, row) => s + row.length, 0));
  if (firstAvgLen < restAvgLen * 0.6 && firstAvgLen < 20) return true;
  return false;
}

/**
 * Compute a quality score (0-100) for a candidate table based on how well its
 * rows align to the column grid.
 */
export function scoreTableQuality(rows: TextPosition[][], columns: number[]): number {
  if (rows.length < 2 || columns.length < 2) return 0;
  let totalItems = 0;
  let alignedItems = 0;
  for (const row of rows) {
    for (const item of row) {
      totalItems++;
      // Item is "aligned" if its x matches a column boundary within tolerance
      const tol = 6;
      if (columns.some((c) => Math.abs(c - item.x) <= tol)) alignedItems++;
    }
  }
  if (totalItems === 0) return 0;
  const alignmentRatio = alignedItems / totalItems;
  // Reward tables with more rows × cols (up to a point)
  const sizeFactor = Math.min(1, (rows.length * columns.length) / 30);
  // Penalize tables where row lengths vary too much (ragged)
  const rowLens = rows.map((r) => r.length);
  const meanLen = rowLens.reduce((s, n) => s + n, 0) / rowLens.length;
  const variance = rowLens.reduce((s, n) => s + (n - meanLen) ** 2, 0) / rowLens.length;
  const consistency = Math.max(0, 1 - Math.sqrt(variance) / Math.max(1, meanLen));
  const score = alignmentRatio * 0.5 + sizeFactor * 0.2 + consistency * 0.3;
  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

/**
 * Detect a single table from a list of text positions on one page.
 * Returns null if no table-like structure is found.
 */
export function detectTable(
  items: TextPosition[],
  pageNumber: number,
  tableIndex: number,
  method: DetectionMethod,
  includeHeaders: boolean,
): DetectedTable | null {
  if (items.length < 4) return null;
  const yTol = method === "by-position" ? 1.5 : method === "by-text-grid" ? 6 : 3;
  const minGap = method === "by-position" ? 4 : method === "by-text-grid" ? 16 : 8;
  const rows = clusterRows(items, yTol);
  if (rows.length < 2) return null;
  // Merge items within a row that overlap (same x) — usually from line-wrap fragments
  const dedupedRows = rows.map((row) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const merged: TextPosition[] = [];
    for (const it of sorted) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(last.x - it.x) < 2 && Math.abs(last.y - it.y) < 2) {
        // Same position — append text
        last.text += it.text;
      } else {
        merged.push({ ...it });
      }
    }
    return merged;
  });
  const columns = detectColumnBoundaries(dedupedRows, minGap);
  if (columns.length < 2) return null;
  const quality = scoreTableQuality(dedupedRows, columns);
  // Build cell grid
  const cellRows: TableCell[][] = dedupedRows.map((row) => {
    const buckets = assignToColumns(row, columns);
    return buckets.map((bucket) => {
      const { text, bold } = mergeColumnItems(bucket);
      const type = detectCellType(text);
      return { text, type };
    });
  });
  const hasHeader = includeHeaders ? detectHeader(dedupedRows) : false;
  if (hasHeader && cellRows.length > 0) {
    cellRows[0] = cellRows[0].map((c) => ({ ...c, isHeader: true }));
  }
  return {
    pageNumber,
    tableIndex,
    rows: cellRows,
    hasHeader,
    quality,
  };
}

/**
 * Detect multiple tables on a page.
 * Splits text items by large y-gaps (vertical whitespace) before detecting each table.
 */
export function detectMultipleTables(
  items: TextPosition[],
  pageNumber: number,
  method: DetectionMethod,
  includeHeaders: boolean,
): DetectedTable[] {
  if (items.length < 4) return [];
  // Sort by descending y
  const sorted = [...items].sort((a, b) => b.y - a.y);
  // Find large y-gaps that indicate table breaks (gap > 30 PDF units, ~ 0.4 inch)
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
    const table = detectTable(group, pageNumber, idx, method, includeHeaders);
    if (table && table.rows.length >= 2 && table.rows[0].length >= 2) {
      tables.push(table);
      idx++;
    }
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Column width calculator (auto-fit)
// ---------------------------------------------------------------------------

/** Compute the auto-fit width (in characters) for each column of a table. */
export function computeColumnWidths(table: DetectedTable): number[] {
  if (table.rows.length === 0) return [];
  const colCount = Math.max(...table.rows.map((r) => r.length));
  const widths: number[] = new Array(colCount).fill(0);
  for (const row of table.rows) {
    for (let c = 0; c < row.length; c++) {
      widths[c] = Math.max(widths[c], row[c].text.length);
    }
  }
  // Minimum width of 3, cap at 60
  return widths.map((w) => Math.max(3, Math.min(60, w)));
}

/** Compute row heights (in lines) for a table. Single-line cells = 1; multi-line cells expand. */
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
// Empty cell handler
// ---------------------------------------------------------------------------

/** Fill ragged rows with empty cells so the table is rectangular. Returns a new grid. */
export function normalizeTableGrid(table: DetectedTable): DetectedTable {
  if (table.rows.length === 0) return table;
  const colCount = Math.max(...table.rows.map((r) => r.length));
  const rows = table.rows.map((row) => {
    if (row.length === colCount) return row;
    const padded = [...row];
    while (padded.length < colCount) {
      padded.push({ text: "", type: "empty" as CellType });
    }
    return padded;
  });
  return { ...table, rows };
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
  return {
    totalPages: pageSet.size,
    totalTables,
    totalRows,
    totalColumns,
    totalCells,
    avgRowsPerTable: totalTables === 0 ? 0 : Math.round((totalRows / totalTables) * 10) / 10,
    avgColumnsPerTable: totalTables === 0 ? 0 : Math.round((totalColumns / totalTables) * 10) / 10,
    maxRowsInTable: tables.reduce((s, t) => Math.max(s, t.rows.length), 0),
    maxColumnsInTable: tables.reduce(
      (s, t) => Math.max(s, ...t.rows.map((r) => r.length)),
      0,
    ),
    filledCells,
    emptyCells,
    avgQuality: totalTables === 0 ? 0 : Math.round(tables.reduce((s, t) => s + t.quality, 0) / totalTables),
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
  // Quote if contains comma, quote, newline, or leading/trailing whitespace
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

export function escapeJsonString(s: string): string {
  // JSON.stringify handles this, but exposing a pure function for tests
  return JSON.stringify(s ?? "").slice(1, -1);
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render a single table as CSV. */
export function renderTableCsv(table: DetectedTable): string {
  const norm = normalizeTableGrid(table);
  return norm.rows
    .map((row) => row.map((c) => escapeCsv(c.text)).join(","))
    .join("\n");
}

/** Render the whole extraction as CSV (tables separated by blank lines + a header comment). */
export function renderCsv(result: ExtractionResult): string {
  const parts: string[] = [];
  for (const table of result.tables) {
    parts.push(`# Table ${table.tableIndex + 1} (page ${table.pageNumber}, quality ${table.quality})`);
    parts.push(renderTableCsv(table));
    parts.push("");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Render a single table as an HTML <table>. */
export function renderTableHtml(table: DetectedTable): string {
  const norm = normalizeTableGrid(table);
  const rows = norm.rows.map((row, ri) => {
    const tag = (table.hasHeader && ri === 0) ? "th" : "td";
    const cells = row
      .map((c) => `    <${tag} class="cell-${c.type}">${escapeHtml(c.text)}</${tag}>`)
      .join("\n");
    return `  <tr>\n${cells}\n  </tr>`;
  });
  return `<table data-page="${table.pageNumber}" data-quality="${table.quality}">\n${rows.join("\n")}\n</table>`;
}

/** Render the whole extraction as HTML. */
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

/** Render a single table as a 2D JSON array. */
export function renderTableJson(table: DetectedTable): string[][] {
  return normalizeTableGrid(table).rows.map((row) => row.map((c) => c.text));
}

/** Render the whole extraction as JSON. */
export function renderJson(result: ExtractionResult): string {
  const data = result.tables.map((t) => ({
    page: t.pageNumber,
    index: t.tableIndex,
    quality: t.quality,
    hasHeader: t.hasHeader,
    rows: renderTableJson(t),
  }));
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Minimal XLSX (SpreadsheetML) XML generator
// ---------------------------------------------------------------------------

/**
 * Build the shared-strings XML for an XLSX package.
 * Returns the XML string and a map from cell text → shared-string index.
 */
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

/** Convert a 0-based column index to an Excel column letter (A, B, ..., Z, AA, AB, ...). */
export function columnLetter(colIndex: number): string {
  let n = colIndex;
  let s = "";
  n += 1; // 1-based internally
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Build the sheet1.xml for an XLSX package containing all extracted tables,
 * one below the next, separated by a blank row.
 */
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
        } else if (cell.type === "date") {
          // Store as string for simplicity (Excel dates need serialization numbers)
          const si = sharedIndex.get(cell.text);
          if (si !== undefined) {
            cellsXml.push(`        <c r="${ref}" t="sharedString"${styleAttr}><v>${si}</v></c>`);
          } else {
            cellsXml.push(`        <c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(cell.text)}</t></is></c>`);
          }
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

/** Build the workbook.xml for an XLSX package. */
export function buildWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tables" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

/** Build the workbook.xml.rels for an XLSX package. */
export function buildWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

/** Build the styles.xml with a header style (bold + fill). */
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

/** Build [Content_Types].xml for an XLSX package. */
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

/** Build the root _rels/.rels for an XLSX package. */
export function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// ZIP file builder (store mode, no compression) — shared with other tools
// ---------------------------------------------------------------------------

/** CRC-32 table (polynomial 0xEDB88320). */
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

/** Compute CRC-32 of a byte array. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Encode a string as UTF-8 bytes. */
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

/** Build a minimal valid ZIP archive (store mode, no compression). */
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

/** Build a complete .xlsx file (ZIP of OOXML XML parts) from extraction result. */
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

/** Dispatch to the renderer matching the chosen format. Returns string for text-based formats. */
export function renderOutput(result: ExtractionResult): string {
  switch (result.outputFormat) {
    case "csv": return renderCsv(result);
    case "html-table": return renderHtml(result);
    case "json": return renderJson(result);
    case "xlsx": return "(XLSX is a binary file — use the Download button.)";
    default: return renderCsv(result);
  }
}

/** Build the download filename for a given format and original PDF name. */
export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-to-excel-converter:history";
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

const VALID_FORMATS = new Set<OutputFormat>(["xlsx", "csv", "html-table", "json"]);
const VALID_METHODS = new Set<DetectionMethod>(["auto-detect", "by-position", "by-text-grid"]);

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.detectionMethod !== "auto-detect") params.set("method", opts.detectionMethod);
  if (opts.outputFormat !== "xlsx") params.set("format", opts.outputFormat);
  if (!opts.includeHeaders) params.set("headers", "0");
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
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

import type { ToolResult } from "../../../lib/tool";

export function validateOptions(opts: ConvertOptions, pageCount: number): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!OUTPUT_FORMATS.includes(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  if (!DETECTION_METHODS.includes(opts.detectionMethod)) {
    return { ok: false, error: `Unknown detection method: ${opts.detectionMethod}` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
