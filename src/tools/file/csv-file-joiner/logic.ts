/**
 * CSV File Joiner — pure logic for CSV parsing, merging, dedup, sort, filter.
 *
 * Pure JavaScript CSV parser (RFC 4180 compliant: quoted fields, escaped quotes,
 * embedded newlines). All operations are pure functions on plain JS objects.
 */

export type Delimiter = "," | "\t" | ";" | "|" | string;

export interface CsvParseOptions {
  delimiter: Delimiter;
  hasHeader: boolean;
  trimWhitespace?: boolean;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  rawLineCount: number;
}

export type JoinMode = "append" | "inner" | "outer";

export interface MergeOptions {
  mode: JoinMode;
  /** Key column for inner/outer join. If empty, append mode stacks rows. */
  joinKey?: string;
  /** Skip duplicate header rows when appending (default true). */
  skipDuplicateHeaders: boolean;
}

export interface MergeStats {
  fileCount: number;
  rowCountPerFile: number[];
  totalRows: number;
  mergedColumns: number;
  dedupedCount: number;
}

/** Parse a single CSV string into headers + rows. RFC 4180 compliant. */
export function parseCsv(input: string, options: CsvParseOptions): ParsedCsv {
  const { delimiter, hasHeader, trimWhitespace = false } = options;
  if (!delimiter) throw new Error("Delimiter is required.");
  const rows = parseCsvRows(input, delimiter, trimWhitespace);
  const headers = hasHeader && rows.length > 0 ? rows[0].map((h) => (trimWhitespace ? h.trim() : h)) : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return { headers, rows: dataRows, rawLineCount: rows.length };
}

/** Core CSV row parser — handles quoted fields, escaped quotes, embedded newlines. */
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
    // Not in quotes
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
      // Handle \r\n or lone \r
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
  // Flush trailing field/row
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(trimWhitespace ? currentField.trim() : currentField);
    rows.push(currentRow);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Convert a ParsedCsv back to a CSV string. Quotes fields that need it. */
export function toCsv(headers: string[], rows: string[][], delimiter: Delimiter = ","): string {
  const all = [headers, ...rows];
  return all.map((row) => row.map((cell) => escapeField(cell, delimiter)).join(delimiter)).join("\n");
}

/** Escape a single CSV field — wrap in quotes if it contains delimiter, quote, or newline. */
export function escapeField(value: string, delimiter: string): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuote = str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r");
  if (!needsQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Union of all headers across files (preserves first-seen order). */
export function unionHeaders(files: ParsedCsv[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of files) {
    for (const h of f.headers) {
      if (!seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
  }
  return out;
}

/** Append mode: stack all rows under the union header. Missing cells become "". */
export function appendMerge(files: ParsedCsv[], options: MergeOptions): { headers: string[]; rows: string[][] } {
  const headers = unionHeaders(files);
  const rows: string[][] = [];
  for (const f of files) {
    const headerIdx = f.headers.map((h) => headers.indexOf(h));
    for (const row of f.rows) {
      const merged = headers.map((_, i) => {
        const srcIdx = headerIdx.indexOf(i);
        return srcIdx >= 0 && srcIdx < row.length ? row[srcIdx] : "";
      });
      rows.push(merged);
    }
  }
  return { headers, rows };
}

/** Inner join: keep only rows where the join key matches across ALL files. */
export function innerJoin(files: ParsedCsv[], joinKey: string): { headers: string[]; rows: string[][] } {
  if (files.length === 0) return { headers: [], rows: [] };
  const headers = unionHeaders(files);
  if (!headers.includes(joinKey)) throw new Error(`Join key "${joinKey}" not found in all files.`);

  // Build maps: file -> Map<keyValue, row>
  const fileMaps: Map<string, Map<string, string[]>>[] = files.map((f) => {
    const keyIdx = f.headers.indexOf(joinKey);
    if (keyIdx < 0) throw new Error(`Join key "${joinKey}" not found in file.`);
    const m = new Map<string, string[]>();
    for (const row of f.rows) {
      const key = row[keyIdx];
      if (!m.has(key)) m.set(key, row);
    }
    return m;
  });

  // Find keys present in all files
  const firstMap = fileMaps[0];
  const result: string[][] = [];
  for (const [key] of firstMap) {
    if (fileMaps.every((m) => m.has(key))) {
      const merged = headers.map((h) => {
        for (let fi = 0; fi < files.length; fi++) {
          const idx = files[fi].headers.indexOf(h);
          if (idx >= 0) {
            const row = fileMaps[fi].get(key)!;
            return row[idx] ?? "";
          }
        }
        return "";
      });
      result.push(merged);
    }
  }
  return { headers, rows: result };
}

/** Outer join: keep all keys from all files. Missing keys get "". */
export function outerJoin(files: ParsedCsv[], joinKey: string): { headers: string[]; rows: string[][] } {
  if (files.length === 0) return { headers: [], rows: [] };
  const headers = unionHeaders(files);
  if (!headers.includes(joinKey)) throw new Error(`Join key "${joinKey}" not found in all files.`);

  const fileMaps = files.map((f) => {
    const keyIdx = f.headers.indexOf(joinKey);
    if (keyIdx < 0) throw new Error(`Join key "${joinKey}" not found in file.`);
    const m = new Map<string, string[]>();
    for (const row of f.rows) {
      const key = row[keyIdx];
      if (!m.has(key)) m.set(key, row);
    }
    return m;
  });

  const allKeys = new Set<string>();
  for (const m of fileMaps) for (const k of m.keys()) allKeys.add(k);

  const result: string[][] = [];
  for (const key of allKeys) {
    const merged = headers.map((h) => {
      for (let fi = 0; fi < files.length; fi++) {
        const idx = files[fi].headers.indexOf(h);
        if (idx >= 0) {
          const row = fileMaps[fi].get(key);
          return row ? (row[idx] ?? "") : "";
        }
      }
      return "";
    });
    result.push(merged);
  }
  return { headers, rows: result };
}

/** Top-level merge dispatcher. */
export function mergeCsvs(files: ParsedCsv[], options: MergeOptions): { headers: string[]; rows: string[][]; stats: MergeStats } {
  if (files.length === 0) return { headers: [], rows: [], stats: { fileCount: 0, rowCountPerFile: [], totalRows: 0, mergedColumns: 0, dedupedCount: 0 } };
  let result: { headers: string[]; rows: string[][] };
  if (options.mode === "append") {
    result = appendMerge(files, options);
  } else if (options.mode === "inner") {
    result = innerJoin(files, options.joinKey ?? "");
  } else {
    result = outerJoin(files, options.joinKey ?? "");
  }
  const stats: MergeStats = {
    fileCount: files.length,
    rowCountPerFile: files.map((f) => f.rows.length),
    totalRows: result.rows.length,
    mergedColumns: result.headers.length,
    dedupedCount: 0,
  };
  return { ...result, stats };
}

/** Deduplicate rows. If keyColumn is set, dedup by that column; else by full row. */
export function dedupRows(headers: string[], rows: string[][], keyColumn?: string): { headers: string[]; rows: string[][]; removed: number } {
  const keyIdx = keyColumn ? headers.indexOf(keyColumn) : -1;
  const seen = new Set<string>();
  const out: string[][] = [];
  let removed = 0;
  for (const row of rows) {
    const key = keyIdx >= 0 ? (row[keyIdx] ?? "") : row.join("\u0001");
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return { headers, rows: out, removed };
}

/** Sort rows by a column. Direction: "asc" | "desc". numeric: parse as number. */
export function sortByColumn(
  headers: string[],
  rows: string[][],
  column: string,
  direction: "asc" | "desc" = "asc",
  numeric: boolean = false,
): string[][] {
  const idx = headers.indexOf(column);
  if (idx < 0) throw new Error(`Column "${column}" not found.`);
  const sorted = [...rows].sort((a, b) => {
    const av = a[idx] ?? "";
    const bv = b[idx] ?? "";
    if (numeric) {
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (isNaN(an) && isNaN(bn)) return 0;
      if (isNaN(an)) return 1;
      if (isNaN(bn)) return -1;
      return direction === "asc" ? an - bn : bn - an;
    }
    return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  return sorted;
}

/** Filter rows by a column substring match. */
export function filterRows(
  headers: string[],
  rows: string[][],
  column: string,
  query: string,
  exact: boolean = false,
): string[][] {
  if (!query) return rows;
  const idx = headers.indexOf(column);
  if (idx < 0) throw new Error(`Column "${column}" not found.`);
  const q = query.toLowerCase();
  return rows.filter((row) => {
    const cell = (row[idx] ?? "").toLowerCase();
    return exact ? cell === q : cell.includes(q);
  });
}

/** Reorder columns by name. Columns not in the new order are dropped. */
export function reorderColumns(headers: string[], rows: string[][], newOrder: string[]): { headers: string[]; rows: string[][] } {
  const indices = newOrder.map((name) => headers.indexOf(name)).filter((i) => i >= 0);
  const newHeaders = indices.map((i) => headers[i]);
  const newRows = rows.map((row) => indices.map((i) => row[i] ?? ""));
  return { headers: newHeaders, rows: newRows };
}

/** Preview first N rows as a formatted table (array of objects). */
export function previewRows(headers: string[], rows: string[][], limit: number = 5): Record<string, string>[] {
  return rows.slice(0, limit).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });
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

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-csv-joiner-history";
const MAX_HISTORY = 10;

export interface CsvJoinHistoryEntry {
  fileNames: string[];
  mode: JoinMode;
  delimiter: string;
  mergedAt: string;
  totalRows: number;
}

export function loadHistory(): CsvJoinHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: CsvJoinHistoryEntry): CsvJoinHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
