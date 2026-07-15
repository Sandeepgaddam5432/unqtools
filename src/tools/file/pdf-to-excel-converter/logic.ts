/**
 * PDF to Excel Converter — extracts PDF text and generates an XLSX.
 *
 * We reuse the PDF text extraction from pdf-to-text-converter and the
 * SpreadsheetML + ZIP writer from csv-to-excel-converter.
 *
 * Pipeline:
 *   1. Extract text from each PDF page (one row per line).
 *   2. Split each line by the chosen delimiter (comma, tab, semicolon, pipe, custom).
 *   3. Build a Sheet per page (or one sheet for all pages).
 *   4. Generate SpreadsheetML XML (workbook, sharedStrings, styles, sheets).
 *   5. Package as a .xlsx ZIP.
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import {
  convertCsvsToXlsx,
  type ConversionResult,
  type ConversionStats,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type Delimiter = "," | "\t" | ";" | "|" | " ";

export interface ExcelOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Delimiter for splitting lines into columns. */
  delimiter: Delimiter;
  /** Custom delimiter string (used when delimiter is " "). */
  customDelimiter: string;
  /** Sheet name override (defaults to "Page 1", "Page 2", ...). */
  sheetName: string;
  /** If true, all pages go into one sheet. If false, one sheet per page. */
  singleSheet: boolean;
  /** If true, first row is treated as a header. */
  hasHeader: boolean;
  /** If true, cells are auto-typed (numbers vs text). */
  autoDetectTypes: boolean;
}

export const DEFAULT_OPTIONS: ExcelOptions = {
  pageRange: "",
  delimiter: ",",
  customDelimiter: "",
  sheetName: "",
  singleSheet: false,
  hasHeader: false,
  autoDetectTypes: true,
};

export interface ExcelResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  rowCount: number;
  columnCount: number;
  cellCount: number;
  xlsxBytes: number;
}

// ===== Helpers =====

/** Split a line by delimiter, honoring double-quoted fields (RFC 4180). */
export function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === "") return [line];
  // Multi-char delimiter: split naively (no quote handling for custom delimiters).
  if (delimiter.length > 1) {
    return line.split(delimiter);
  }
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      cells.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  cells.push(current);
  return cells;
}

/** Get the actual delimiter string from options. */
export function resolveDelimiter(opts: ExcelOptions): string {
  if (opts.delimiter === " " && opts.customDelimiter) return opts.customDelimiter;
  return opts.delimiter;
}

// ===== Top-level conversion =====

export async function convertPdfToExcel(
  pdfBytes: Uint8Array,
  opts: ExcelOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.xlsx",
): Promise<ToolResult<ExcelResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "\n",
    trimLines: true,
    removeEmptyLines: true,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const delimiter = resolveDelimiter(opts);
  // For the CSV content passed to the XLSX writer, always use comma as the
  // delimiter (RFC 4180 compliant). The user's chosen delimiter is only used
  // for splitting the PDF text lines into cells.
  const csvDelimiter = ",";
  // Build CSV-style inputs for the XLSX converter
  if (opts.singleSheet) {
    const allLines: string[] = [];
    for (const page of textResult.output.pages) {
      for (const line of page.text.split("\n")) {
        if (line.trim() !== "") allLines.push(line);
      }
    }
    // Build CSV content
    const csvContent = allLines
      .map((line) => {
        const cells = splitLine(line, delimiter);
        return cells.map((c) => {
          // Escape as RFC 4180 CSV
          if (c.includes('"') || c.includes(csvDelimiter) || c.includes("\n")) {
            return `"${c.replace(/"/g, '""')}"`;
          }
          return c;
        }).join(csvDelimiter);
      })
      .join("\n");
    const sheetName = opts.sheetName || "Sheet1";
    let result: ConversionResult;
    try {
      result = convertCsvsToXlsx(
        [{ fileName: sheetName + ".csv", content: csvContent, sheetName }],
        {
          forceText: !opts.autoDetectTypes,
          styleHeader: opts.hasHeader,
          autoFitColumns: true,
          hasHeader: opts.hasHeader,
        },
        csvDelimiter,
        outputFileName,
      );
    } catch (e) {
      return { ok: false, error: `XLSX generation failed: ${(e as Error).message}` };
    }
    const rowCount = allLines.length;
    const columnCount = allLines.reduce((max, l) => Math.max(max, splitLine(l, delimiter).length), 0);
    const cellCount = allLines.reduce((s, l) => s + splitLine(l, delimiter).length, 0);
    return {
      ok: true,
      output: {
        blob: result.blob,
        fileName: outputFileName,
        pageCount: textResult.output.pageCount,
        rowCount,
        columnCount,
        cellCount,
        xlsxBytes: result.blob.size,
      },
    };
  }
  // One sheet per page
  const inputs: Array<{ fileName: string; content: string; sheetName: string }> = [];
  let totalRows = 0;
  let maxCols = 0;
  let totalCells = 0;
  for (let i = 0; i < textResult.output.pages.length; i++) {
    const page = textResult.output.pages[i]!;
    const lines = page.text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const csvContent = lines
      .map((line) => {
        const cells = splitLine(line, delimiter);
        return cells.map((c) => {
          if (c.includes('"') || c.includes(csvDelimiter) || c.includes("\n")) {
            return `"${c.replace(/"/g, '""')}"`;
          }
          return c;
        }).join(csvDelimiter);
      })
      .join("\n");
    const sheetName = opts.sheetName || `Page ${i + 1}`;
    inputs.push({ fileName: sheetName + ".csv", content: csvContent, sheetName });
    totalRows += lines.length;
    for (const l of lines) {
      const cellCount = splitLine(l, delimiter).length;
      if (cellCount > maxCols) maxCols = cellCount;
      totalCells += cellCount;
    }
  }
  if (inputs.length === 0) {
    return { ok: false, error: "No text rows found in the PDF." };
  }
  let result: ConversionResult;
  try {
    result = convertCsvsToXlsx(
      inputs,
      {
        forceText: !opts.autoDetectTypes,
        styleHeader: opts.hasHeader,
        autoFitColumns: true,
        hasHeader: opts.hasHeader,
      },
      csvDelimiter,
      outputFileName,
    );
  } catch (e) {
    return { ok: false, error: `XLSX generation failed: ${(e as Error).message}` };
  }
  void result.stats as ConversionStats;
  return {
    ok: true,
    output: {
      blob: result.blob,
      fileName: outputFileName,
      pageCount: textResult.output.pageCount,
      rowCount: totalRows,
      columnCount: maxCols,
      cellCount: totalCells,
      xlsxBytes: result.blob.size,
    },
  };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-excel-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  xlsxBytes: number;
  pageCount: number;
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
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export function buildShareUrl(opts: ExcelOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("delim", opts.delimiter === "\t" ? "\\t" : opts.delimiter);
  if (opts.sheetName) params.set("sheet", opts.sheetName);
  params.set("single", String(opts.singleSheet));
  params.set("header", String(opts.hasHeader));
  params.set("auto", String(opts.autoDetectTypes));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ExcelOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("delim")) return null;
  const delimRaw = params.get("delim") ?? ",";
  const delimiter: Delimiter = delimRaw === "\\t" ? "\t" : delimRaw as Delimiter;
  const validDelims: Delimiter[] = [",", "\t", ";", "|", " "];
  return {
    pageRange: params.get("pages") ?? "",
    delimiter: validDelims.includes(delimiter) ? delimiter : ",",
    sheetName: params.get("sheet") ?? "",
    singleSheet: params.get("single") === "true",
    hasHeader: params.get("header") === "true",
    autoDetectTypes: params.get("auto") !== "false",
  };
}
