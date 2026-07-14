/**
 * CSV to TSV Converter — pure logic for RFC 4180 compliant CSV parsing and
 * delimiter-agnostic re-serialization.
 *
 * Pure functions only — no I/O, no React.
 */

export type Delimiter = "," | "\t" | ";" | "|" | string;

export interface ConvertOptions {
  /** Input delimiter (auto-detected if not specified). */
  inputDelimiter: Delimiter;
  /** Output delimiter (default tab). */
  outputDelimiter: Delimiter;
  /** Trim whitespace on every field. */
  trimWhitespace: boolean;
  /** Remove rows where all cells are empty. */
  removeEmptyRows: boolean;
  /** Skip the first (header) row in output. */
  skipHeader: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  inputDelimiter: ",",
  outputDelimiter: "\t",
  trimWhitespace: false,
  removeEmptyRows: false,
  skipHeader: false,
};

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  rawLineCount: number;
}

export interface ConvertStats {
  rowCount: number;
  columnCount: number;
  inputBytes: number;
  outputBytes: number;
}

export interface ConvertResult {
  output: string;
  stats: ConvertStats;
}

/** Core CSV row parser — RFC 4180 compliant. */
export function parseCsvRows(input: string, delimiter: string, trimWhitespace = false): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = input.length;
  const delim = delimiter.length === 1 ? delimiter : delimiter[0];

  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && input[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
      if (i < len && input[i] === "\n") i++;
      continue;
    }
    if (ch === "\n") {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
      continue;
    }
    currentField += ch;
    i++;
  }
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(trimWhitespace ? currentField.trim() : currentField);
    rows.push(currentRow);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parse a CSV string into headers + rows. */
export function parseCsv(input: string, options: Pick<ConvertOptions, "inputDelimiter" | "trimWhitespace">): ParsedCsv {
  const { inputDelimiter, trimWhitespace } = options;
  if (!inputDelimiter) throw new Error("inputDelimiter is required.");
  const rows = parseCsvRows(input, inputDelimiter, trimWhitespace);
  const headers = rows.length > 0 ? rows[0] : [];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows, rawLineCount: rows.length };
}

/** Escape a single field for output — wrap in quotes if it contains delimiter, quote, or newline. */
export function escapeField(value: string, delimiter: string): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuote = str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r");
  if (!needsQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Convert headers + rows back to a delimited string. */
export function toDelimited(headers: string[], rows: string[][], delimiter: Delimiter): string {
  const all = headers.length > 0 ? [headers, ...rows] : rows;
  return all.map((row) => row.map((cell) => escapeField(cell, delimiter)).join(delimiter)).join("\n");
}

/** Detect delimiter from content (basic heuristic). */
export function detectDelimiter(input: string): Delimiter {
  const firstLine = input.split(/\r?\n/)[0] ?? "";
  const candidates: Array<{ d: Delimiter; count: number }> = [
    { d: ",", count: (firstLine.match(/,/g) ?? []).length },
    { d: "\t", count: (firstLine.match(/\t/g) ?? []).length },
    { d: ";", count: (firstLine.match(/;/g) ?? []).length },
    { d: "|", count: (firstLine.match(/\|/g) ?? []).length },
  ];
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0].count > 0 ? candidates[0].d : ",";
}

/** Detect BOM + encoding hint from first few bytes. */
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

/** Strip a UTF-8 BOM from a string. */
export function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

/** Remove rows where all cells are empty. */
export function removeEmptyRows(rows: string[][]): string[][] {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Preview first N rows as objects. */
export function previewRows(headers: string[], rows: string[][], limit: number = 5): Record<string, string>[] {
  return rows.slice(0, limit).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });
}

/** Compute byte size of a UTF-8 encoded string. */
export function byteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Top-level converter. Pure function.
 */
export function convertCsvToTsv(input: string, options: ConvertOptions): ConvertResult {
  const parsed = parseCsv(input, options);
  let { headers, rows } = parsed;

  if (options.removeEmptyRows) {
    rows = removeEmptyRows(rows);
  }

  // If skipHeader, drop headers entirely (output starts with data).
  if (options.skipHeader) {
    headers = [];
  }

  const output = toDelimited(headers, rows, options.outputDelimiter);

  const stats: ConvertStats = {
    rowCount: rows.length,
    columnCount: headers.length || (rows[0]?.length ?? 0),
    inputBytes: byteSize(input),
    outputBytes: byteSize(output),
  };

  return { output, stats };
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Strip extension from a filename. */
export function stripExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** Derive output filename from input filename + new extension. */
export function deriveOutputFilename(inputName: string, newExt: string = "tsv"): string {
  return `${stripExtension(inputName)}.${newExt}`;
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-csv-to-tsv-history";
const MAX_HISTORY = 10;

export interface CsvToTsvHistoryEntry {
  fileName: string;
  inputDelimiter: string;
  outputDelimiter: string;
  rowCount: number;
  convertedAt: string;
}

export function loadHistory(): CsvToTsvHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: CsvToTsvHistoryEntry): CsvToTsvHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL encoding the conversion settings. */
export function buildShareUrl(options: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("in", options.inputDelimiter === "\t" ? "\\t" : options.inputDelimiter);
  params.set("out", options.outputDelimiter === "\t" ? "\\t" : options.outputDelimiter);
  params.set("trim", String(options.trimWhitespace));
  params.set("empty", String(options.removeEmptyRows));
  params.set("skiphdr", String(options.skipHeader));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
