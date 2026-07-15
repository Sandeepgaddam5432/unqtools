/**
 * Excel to JSON Converter — pure logic.
 * Reuses XLSX parsing from excel-to-csv-converter.
 */

export interface SheetData {
  name: string;
  rows: string[][];
}

export type KeyNaming = "original" | "camelCase" | "snake_case";
export type OutputFormat = "json" | "jsonl";

export interface ConvertOptions {
  sheetIndex?: number;
  keyNaming?: KeyNaming;
  nestedGroupColumn?: string;
  format?: OutputFormat;
}

/** Convert a key to camelCase. */
export function toCamelCase(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

/** Convert a key to snake_case. */
export function toSnakeCase(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_/, "")
    .replace(/_$/, "")
    .toLowerCase();
}

/** Apply key naming transformation. */
export function transformKey(key: string, naming: KeyNaming): string {
  switch (naming) {
    case "camelCase": return toCamelCase(key) || key;
    case "snake_case": return toSnakeCase(key) || key;
    default: return key;
  }
}

/** Infer a value type from a string cell. */
export function inferCellValue(value: string): unknown {
  if (value === "" || value == null) return null;
  // Boolean
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  // Number
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "" && /^-?\d+\.?\d*$/.test(value.trim())) return num;
  // Date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  // String
  return value;
}

/** Convert sheet rows to JSON objects using first row as keys. */
export function sheetToJson(
  rows: string[][],
  opts: { keyNaming?: KeyNaming } = {},
): Record<string, unknown>[] {
  if (rows.length < 2) return [];
  const naming = opts.keyNaming ?? "original";
  const headers = rows[0].map((h) => transformKey(h || "", naming));
  const result: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const obj: Record<string, unknown> = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = rows[i]?.[j] ?? "";
      if (val !== "") hasData = true;
      obj[headers[j]] = inferCellValue(val);
    }
    if (hasData) result.push(obj);
  }
  return result;
}

/** Convert multiple sheets to a single JSON object keyed by sheet name. */
export function sheetsToJson(
  sheets: SheetData[],
  opts: { keyNaming?: KeyNaming } = {},
): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const sheet of sheets) {
    result[sheet.name] = sheetToJson(sheet.rows, opts);
  }
  return result;
}

/** Group rows by a column value (nested JSON). */
export function groupByColumn(
  data: Record<string, unknown>[],
  column: string,
): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const row of data) {
    const key = String(row[column] ?? "undefined");
    if (!result[key]) result[key] = [];
    result[key].push(row);
  }
  return result;
}

/** Convert to JSONL format (one JSON object per line). */
export function toJsonl(data: Record<string, unknown>[]): string {
  return data.map((obj) => JSON.stringify(obj)).join("\n");
}

/** Convert to pretty-printed JSON. */
export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** Get conversion stats. */
export interface ConversionStats {
  rowCount: number;
  columnCount: number;
  sheetCount: number;
  outputSize: number;
}

export function getStats(
  sheets: SheetData[],
  output: string,
  sheetIndex?: number,
): ConversionStats {
  const sheet = sheetIndex != null ? sheets[sheetIndex] : sheets[0];
  const rows = sheet?.rows ?? [];
  return {
    rowCount: Math.max(0, rows.length - 1),
    columnCount: rows[0]?.length ?? 0,
    sheetCount: sheets.length,
    outputSize: output.length,
  };
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-excel-to-json-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  filename: string;
  sheetName: string;
  rowCount: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const current = loadHistory();
  const updated = [entry, ...current].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build shareable URL. */
export function buildShareUrl(opts: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.sheetIndex != null) params.set("sheet", String(opts.sheetIndex));
  if (opts.keyNaming) params.set("keys", opts.keyNaming);
  if (opts.format) params.set("format", opts.format);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
