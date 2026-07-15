/**
 * JSON to Excel Converter — pure logic for JSON flattening, column detection,
 * cell type inference, and XLSX generation. Reuses the XLSX writer from
 * csv-to-excel-converter/logic.ts.
 */

import {
  SharedStrings, sanitizeSheetName, columnLetter,
  computeColumnWidth, dateToExcelSerial,
  xmlAttrEscape, xmlEscape,
  generateWorkbookXml, generateWorkbookRelsXml, generateContentTypesXml,
  generateRootRelsXml, generateStylesXml,
  createZipBlob,
  type ConversionOptions as XlsxOptions, type Sheet as XlsxSheet,
} from "../csv-to-excel-converter/logic";

// ===== JSON parsing =====

export interface JsonParseResult {
  /** Detected input shape. */
  shape: "array" | "object" | "jsonl" | "empty";
  /** Parsed rows (each row is a flat object: dot-notation keys → primitive values). */
  rows: Record<string, unknown>[];
  /** Parse errors (line number + message). */
  errors: Array<{ line: number; message: string }>;
  /** Total lines parsed (for JSONL). */
  lineCount: number;
}

/**
 * Parse a JSON string into a normalized list of row objects.
 * Supports:
 *   - JSON array of objects (shape: "array")
 *   - JSON object (shape: "object" — becomes a single-row sheet)
 *   - JSONL / NDJSON (shape: "jsonl" — one object per line)
 */
export function parseJsonInput(input: string): JsonParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { shape: "empty", rows: [], errors: [], lineCount: 0 };
  }
  // Try parsing as a single JSON value first (handles single-line arrays,
  // objects, and primitives, as well as multi-line pretty-printed JSON).
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const rows = parsed
        .filter((item) => item != null)
        .map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            return flattenObject(item as Record<string, unknown>);
          }
          // Primitive inside array — wrap as {value: ...}
          return { value: item } as Record<string, unknown>;
        });
      return { shape: "array", rows, errors: [], lineCount: 1 };
    }
    if (parsed && typeof parsed === "object") {
      return { shape: "object", rows: [flattenObject(parsed as Record<string, unknown>)], errors: [], lineCount: 1 };
    }
    // Primitive JSON value
    return { shape: "object", rows: [{ value: parsed }], errors: [], lineCount: 1 };
  } catch (singleErr) {
    // Fall through to JSONL parsing if single-line JSON parse fails.
    void singleErr;
  }

  // JSONL fallback: if input has multiple lines, try parsing each line as JSON.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    const rows: Record<string, unknown>[] = [];
    const errors: Array<{ line: number; message: string }> = [];
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          rows.push(flattenObject(obj as Record<string, unknown>));
        } else if (Array.isArray(obj)) {
          // A JSONL line that's an array — extend with the array elements
          for (const item of obj) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              rows.push(flattenObject(item as Record<string, unknown>));
            }
          }
        } else {
          // Primitive value on its own line — wrap in a {value: ...} object
          rows.push({ value: obj });
        }
      } catch (e) {
        errors.push({ line: lineNum, message: (e as Error).message });
      }
    }
    if (rows.length > 0 || errors.length > 0) {
      return { shape: "jsonl", rows, errors, lineCount: lineNum };
    }
  }

  return {
    shape: "empty",
    rows: [],
    errors: [{ line: 1, message: "Input is not valid JSON or JSONL." }],
    lineCount: 1,
  };
}

// ===== Flatten nested objects =====

export interface FlattenOptions {
  /** Max nesting depth. Default: unlimited. */
  maxDepth?: number;
  /** Separator between nested keys. Default: ".". */
  separator?: string;
}

/**
 * Flatten a nested object using dot notation.
 *   {a: {b: 1}} → {"a.b": 1}
 *
 * maxDepth = max number of segments in the resulting flattened keys.
 *   - maxDepth=1: top-level only (objects stay stringified)
 *   - maxDepth=2: one level of nesting expanded
 *   - maxDepth=Infinity (default): unlimited flattening
 *
 * Arrays of objects: expand to {key.0.field, key.1.field, ...}
 * Arrays of primitives: kept as JSON string
 */
export function flattenObject(
  obj: Record<string, unknown>,
  options: FlattenOptions = {},
): Record<string, unknown> {
  const { maxDepth = Infinity, separator = "." } = options;
  const result: Record<string, unknown> = {};
  const walk = (current: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(current)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;
      const newKeyDepth = newKey.split(separator).length;
      if (value === null || value === undefined) {
        result[newKey] = value;
      } else if (Array.isArray(value)) {
        // Arrays of objects: expand to {key.0.field, key.1.field, ...}
        // Arrays of primitives: keep as JSON string
        if (value.length > 0 && value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
          if (newKeyDepth >= maxDepth) {
            result[newKey] = JSON.stringify(value);
          } else {
            value.forEach((item, idx) => {
              // Walk into the array element. The bracket notation [idx] is part of the path.
              walk(item as Record<string, unknown>, `${newKey}[${idx}]`);
            });
          }
        } else {
          result[newKey] = JSON.stringify(value);
        }
      } else if (typeof value === "object") {
        if (newKeyDepth >= maxDepth) {
          result[newKey] = JSON.stringify(value);
        } else {
          walk(value as Record<string, unknown>, newKey);
        }
      } else {
        result[newKey] = value;
      }
    }
  };
  walk(obj, "");
  return result;
}

// ===== Column detection =====

export type ColumnDetectionMode = "first" | "union" | "intersection";

export interface ColumnDetectionOptions {
  mode: ColumnDetectionMode;
  /** Optional explicit column list (overrides detection). */
  columns?: string[];
}

/**
 * Detect columns from a list of row objects.
 *   - "first": keys of the first row (preserves order)
 *   - "union": all unique keys across all rows
 *   - "intersection": only keys present in every row
 */
export function detectColumns(rows: Record<string, unknown>[], options: ColumnDetectionOptions): string[] {
  if (options.columns && options.columns.length > 0) {
    return options.columns;
  }
  if (rows.length === 0) return [];
  if (options.mode === "first") {
    return Object.keys(rows[0]!);
  }
  if (options.mode === "union") {
    const set = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) set.add(k);
    }
    return Array.from(set);
  }
  // intersection
  const firstKeys = new Set(Object.keys(rows[0]!));
  for (let i = 1; i < rows.length; i++) {
    const currentKeys = new Set(Object.keys(rows[i]!));
    for (const k of firstKeys) {
      if (!currentKeys.has(k)) firstKeys.delete(k);
    }
  }
  return Array.from(firstKeys);
}

// ===== Cell type inference =====

export type CellType = "text" | "number" | "boolean" | "date" | "empty";

export interface InferredCell {
  type: CellType;
  raw: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

export function inferCellType(value: unknown): CellType {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    if (!isFinite(value)) return "text"; // NaN / Infinity → text
    return "number";
  }
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) return "date";
    if (ISO_DATETIME.test(value)) return "date";
    return "text";
  }
  return "text";
}

export function toCellValue(value: unknown, forceText: boolean = false): InferredCell {
  if (value === null || value === undefined) return { type: "empty", raw: "" };
  if (forceText) return { type: "text", raw: String(value) };
  const type = inferCellType(value);
  if (type === "boolean") {
    return { type: "boolean", raw: value ? "1" : "0" };
  }
  if (type === "number") {
    return { type: "number", raw: String(value) };
  }
  if (type === "date") {
    return { type: "date", raw: String(value) };
  }
  if (type === "empty") {
    return { type: "empty", raw: "" };
  }
  return { type: "text", raw: String(value) };
}

// ===== Sheet generation =====

export interface JsonSheet {
  name: string;
  rows: Record<string, unknown>[];
  columns: string[];
}

export interface ConversionOptions {
  /** Flatten depth limit. Default: unlimited. */
  flattenDepth: number;
  /** Column detection mode. */
  columnMode: ColumnDetectionMode;
  /** Force all cells to text type. */
  forceText: boolean;
  /** Style header row (bold + light fill). */
  styleHeader: boolean;
  /** Auto-fit column widths. */
  autoFitColumns: boolean;
  /** Use first row's keys as headers (default true). */
  hasHeader: boolean;
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  flattenDepth: Infinity,
  columnMode: "first",
  forceText: false,
  styleHeader: true,
  autoFitColumns: true,
  hasHeader: true,
};

export interface JsonInput {
  fileName: string;
  content: string;
  sheetName?: string;
}

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  stats: ConversionStats;
}

export interface ConversionStats {
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  sharedStringsCount: number;
  xlsxBytes: number;
}

/** Generate the sheet XML for one JSON sheet. Mirrors csv-to-excel's generator. */
export function generateSheetXml(
  sheet: JsonSheet,
  options: ConversionOptions,
  sharedStrings: SharedStrings,
): { xml: string; sharedStringsUsed: number } {
  const rowsXml: string[] = [];
  const colsXml: string[] = [];
  const initialSharedSize = sharedStrings.size;

  // Build header row
  const headerRow = options.hasHeader ? sheet.columns : [];
  // Build all rows: header + data
  const allRowsText: string[][] = options.hasHeader
    ? [headerRow, ...sheet.rows.map((r) => sheet.columns.map((c) => stringifyCell(r[c])))]
    : sheet.rows.map((r) => sheet.columns.map((c) => stringifyCell(r[c])));

  // Compute column widths
  if (options.autoFitColumns) {
    for (let c = 0; c < sheet.columns.length; c++) {
      const colValues = allRowsText.slice(0, 1000).map((r) => r[c] ?? "");
      const width = computeColumnWidth(colValues);
      colsXml.push(`<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`);
    }
  }

  for (let r = 0; r < allRowsText.length; r++) {
    const row = allRowsText[r]!;
    const cellsXml: string[] = [];
    const isHeader = options.hasHeader && r === 0;
    for (let c = 0; c < sheet.columns.length; c++) {
      const cellRef = `${columnLetter(c)}${r + 1}`;
      let cellXml: string;
      if (isHeader) {
        const headerText = sheet.columns[c] ?? "";
        const idx = sharedStrings.add(headerText);
        cellXml = `<c r="${cellRef}" s="1" t="s"><v>${idx}</v></c>`;
      } else {
        const rowData = sheet.rows[options.hasHeader ? r - 1 : r];
        const value = rowData ? rowData[sheet.columns[c]!] : undefined;
        if (value === null || value === undefined) {
          cellXml = `<c r="${cellRef}"/>`;
        } else {
          const cell = toCellValue(value, options.forceText);
          if (cell.type === "number") {
            cellXml = `<c r="${cellRef}"><v>${cell.raw}</v></c>`;
          } else if (cell.type === "boolean") {
            cellXml = `<c r="${cellRef}" t="b"><v>${cell.raw}</v></c>`;
          } else if (cell.type === "date") {
            const serial = dateToExcelSerial(cell.raw);
            cellXml = `<c r="${cellRef}" s="2"><v>${serial}</v></c>`;
          } else if (cell.type === "empty") {
            cellXml = `<c r="${cellRef}"/>`;
          } else {
            const idx = sharedStrings.add(cell.raw);
            cellXml = `<c r="${cellRef}" t="s"><v>${idx}</v></c>`;
          }
        }
      }
      cellsXml.push(cellXml);
    }
    const rowAttrs = isHeader ? ` r="${r + 1}" ht="20" customHeight="1"` : ` r="${r + 1}"`;
    rowsXml.push(`<row${rowAttrs}>${cellsXml.join("")}</row>`);
  }

  const colsBlock = colsXml.length > 0 ? `<cols>${colsXml.join("")}</cols>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsBlock}<sheetData>${rowsXml.join("")}</sheetData></worksheet>`;

  return { xml, sharedStringsUsed: sharedStrings.size - initialSharedSize };
}

/** Stringify a cell value for column-width computation (not for output). */
function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ===== Top-level conversion =====

export function convertJsonToXlsx(
  inputs: JsonInput[],
  options: ConversionOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.xlsx",
): ConversionResult {
  if (inputs.length === 0) throw new Error("No JSON inputs provided.");

  const sheets: JsonSheet[] = inputs.map((inp) => {
    const parsed = parseJsonInput(inp.content);
    // parseJsonInput flattens with unlimited depth. If the user specified a
    // finite flattenDepth, we re-flatten from the unflattened form.
    const flattenedRows = options.flattenDepth === Infinity
      ? parsed.rows
      : parsed.rows.map((r) => reflattenAtDepth(r, options.flattenDepth));
    const columns = detectColumns(flattenedRows, { mode: options.columnMode });
    const name = sanitizeSheetName(inp.sheetName ?? inp.fileName.replace(/\.(json|jsonl|ndjson)$/i, ""));
    return { name, rows: flattenedRows, columns };
  });

  const sharedStrings = new SharedStrings();
  const sheetXmls = sheets.map((s) => generateSheetXml(s, options, sharedStrings).xml);

  // Convert JsonSheet to XlsxSheet for workbook.xml generation
  const xlsxSheets: XlsxSheet[] = sheets.map((s) => ({
    name: s.name,
    headers: s.columns,
    rows: s.rows.map((r) => s.columns.map((c) => stringifyCell(r[c]))),
  }));

  const files: Array<{ name: string; data: Uint8Array }> = [];
  const enc = new TextEncoder();
  files.push({ name: "[Content_Types].xml", data: enc.encode(generateContentTypesXml(sheets.length)) });
  files.push({ name: "_rels/.rels", data: enc.encode(generateRootRelsXml()) });
  files.push({ name: "xl/workbook.xml", data: enc.encode(generateWorkbookXml(xlsxSheets)) });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: enc.encode(generateWorkbookRelsXml(sheets.length)) });
  files.push({ name: "xl/sharedStrings.xml", data: enc.encode(sharedStrings.toXml()) });
  files.push({ name: "xl/styles.xml", data: enc.encode(generateStylesXml()) });
  sheets.forEach((_, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXmls[i]!) });
  });

  const blob = createZipBlob(files);

  const stats: ConversionStats = {
    sheetCount: sheets.length,
    totalRows: sheets.reduce((s, sh) => s + sh.rows.length, 0),
    totalCells: sheets.reduce((s, sh) => s + sh.rows.length * sh.columns.length, 0),
    sharedStringsCount: sharedStrings.size,
    xlsxBytes: blob.size,
  };

  return { blob, fileName: outputFileName, stats };
}

/** Best-effort inverse of flattenObject (for re-flattening at a different depth). */
function unflatten(flat: Record<string, unknown>): Record<string, unknown> {
  // Simple unflatten: re-nest dotted keys. Bracket notation [idx] is treated
  // as part of the key name (the resulting object won't perfectly reconstruct
  // arrays, but re-flattening at the same depth gives equivalent paths).
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      if (isLast) {
        current[part] = value;
      } else {
        if (typeof current[part] !== "object" || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }
  }
  return result;
}

/**
 * Re-flatten a (possibly pre-flattened) row at a different max depth.
 * We first unflatten, then re-flatten with the new depth limit.
 */
function reflattenAtDepth(flatRow: Record<string, unknown>, maxDepth: number): Record<string, unknown> {
  const nested = unflatten(flatRow);
  return flattenObject(nested, { maxDepth });
}

// ===== Encoding detection =====

export function detectEncoding(bytes: Uint8Array): { encoding: string; hasBom: boolean } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "UTF-8", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "UTF-16LE", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "UTF-16BE", hasBom: true };
  }
  return { encoding: "UTF-8", hasBom: false };
}

export function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

// ===== Preview =====

export interface PreviewRow {
  [key: string]: string;
}

export function previewRows(columns: string[], rows: Record<string, unknown>[], limit: number = 10): PreviewRow[] {
  return rows.slice(0, limit).map((row) => {
    const obj: PreviewRow = {};
    for (const col of columns) {
      const v = row[col];
      if (v === null || v === undefined) {
        obj[col] = "";
      } else if (typeof v === "object") {
        obj[col] = JSON.stringify(v);
      } else {
        obj[col] = String(v);
      }
    }
    return obj;
  });
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-json-to-excel-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  outputFileName: string;
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  xlsxBytes: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

// ===== Shareable URL =====

export function buildShareUrl(options: ConversionOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("depth", String(options.flattenDepth));
  params.set("mode", options.columnMode);
  params.set("forceText", String(options.forceText));
  params.set("styleHeader", String(options.styleHeader));
  params.set("autoFit", String(options.autoFitColumns));
  params.set("header", String(options.hasHeader));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConversionOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("depth") && !params.has("mode")) return null;
  const depth = parseInt(params.get("depth") ?? "0", 10);
  return {
    flattenDepth: isNaN(depth) || depth <= 0 ? Infinity : depth,
    columnMode: (params.get("mode") ?? "first") as ColumnDetectionMode,
    forceText: params.get("forceText") === "true",
    styleHeader: params.get("styleHeader") !== "false",
    autoFitColumns: params.get("autoFit") !== "false",
    hasHeader: params.get("header") !== "false",
  };
}

// Re-export for UI convenience
export { sanitizeSheetName, xmlEscape, xmlAttrEscape };
