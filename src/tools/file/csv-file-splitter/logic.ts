/**
 * CSV File Splitter — pure logic for CSV parsing, splitting, and ZIP packaging.
 *
 * RFC 4180 compliant CSV parser (quoted fields, escaped quotes, embedded newlines).
 * Pure functions for splitting by row count, file size, column value, or output count.
 * Minimal ZIP writer (STORE method, no compression) for "download all as ZIP".
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

export type SplitMode = "rowCount" | "fileSize" | "columnValue" | "fileCount";

export interface SplitOptions {
  mode: SplitMode;
  /** For mode="rowCount": rows per output file. */
  rowsPerFile?: number;
  /** For mode="fileSize": target bytes per output file. */
  bytesPerFile?: number;
  /** For mode="columnValue": column name to group by. */
  groupColumn?: string;
  /** For mode="fileCount": number of output files. */
  fileCount?: number;
  /** Preserve header row at top of every split (default true). */
  preserveHeader: boolean;
  /** Custom delimiter for parsing + output. */
  delimiter: Delimiter;
}

export interface SplitResult {
  /** Filename for this split. */
  filename: string;
  /** CSV content. */
  content: string;
  /** Row count (data rows, excluding header). */
  rowCount: number;
  /** Byte size of content. */
  byteSize: number;
  /** First N rows for preview (as objects). */
  preview: Record<string, string>[];
  /** Headers included in this split. */
  headers: string[];
}

export interface SplitStats {
  totalRows: number;
  totalColumns: number;
  splitCount: number;
  perSplitRowCounts: number[];
  perSplitByteSizes: number[];
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

/** Escape a single CSV field — wrap in quotes if it contains delimiter, quote, or newline. */
export function escapeField(value: string, delimiter: string): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuote = str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r");
  if (!needsQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Convert headers + rows back to a CSV string. */
export function toCsv(headers: string[], rows: string[][], delimiter: Delimiter = ","): string {
  const all = headers.length > 0 ? [headers, ...rows] : rows;
  return all.map((row) => row.map((cell) => escapeField(cell, delimiter)).join(delimiter)).join("\n");
}

/** Split rows into chunks of N rows each. */
export function splitByRowCount(rows: string[][], rowsPerFile: number): string[][][] {
  if (!rowsPerFile || rowsPerFile < 1) throw new Error("rowsPerFile must be >= 1");
  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += rowsPerFile) {
    chunks.push(rows.slice(i, i + rowsPerFile));
  }
  return chunks.length === 0 ? [[]] : chunks;
}

/** Split rows into N roughly equal chunks. */
export function splitByFileCount(rows: string[][], fileCount: number): string[][][] {
  if (!fileCount || fileCount < 1) throw new Error("fileCount must be >= 1");
  const chunks: string[][][] = Array.from({ length: fileCount }, () => []);
  for (let i = 0; i < rows.length; i++) {
    chunks[i % fileCount].push(rows[i]);
  }
  return chunks;
}

/**
 * Split rows by target byte size per file.
 * Estimates CSV size by serializing rows incrementally.
 */
export function splitByFileSize(
  headers: string[],
  rows: string[][],
  bytesPerFile: number,
  delimiter: Delimiter,
  preserveHeader: boolean,
): string[][][] {
  if (!bytesPerFile || bytesPerFile < 1) throw new Error("bytesPerFile must be >= 1");
  const chunks: string[][][] = [];
  let current: string[][] = [];
  let currentSize = 0;
  const headerSize = preserveHeader && headers.length > 0
    ? new TextEncoder().encode(headers.map((h) => escapeField(h, delimiter)).join(delimiter) + "\n").length
    : 0;

  for (const row of rows) {
    const line = row.map((cell) => escapeField(cell, delimiter)).join(delimiter) + "\n";
    const lineSize = new TextEncoder().encode(line).length;
    // If adding this row would exceed target AND we already have rows, flush.
    if (currentSize + lineSize > bytesPerFile && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    if (current.length === 0) {
      // Add header overhead to first row of each chunk (if preserving).
      currentSize += headerSize;
    }
    current.push(row);
    currentSize += lineSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length === 0 ? [[]] : chunks;
}

/**
 * Group rows by a column value. Returns ordered unique values and the rows per group.
 */
export function splitByColumnValue(
  headers: string[],
  rows: string[][],
  columnName: string,
): Array<{ value: string; rows: string[][] }> {
  const idx = headers.indexOf(columnName);
  if (idx < 0) throw new Error(`Column "${columnName}" not found.`);
  const groups = new Map<string, string[][]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = row[idx] ?? "";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  return order.map((value) => ({ value, rows: groups.get(value)! }));
}

/** Deduplicate rows (full row comparison). Returns deduped rows + removed count. */
export function dedupRows(rows: string[][]): { rows: string[][]; removed: number } {
  const seen = new Set<string>();
  const out: string[][] = [];
  let removed = 0;
  for (const row of rows) {
    const key = row.join("\u0001");
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return { rows: out, removed };
}

/** Select only the specified columns (drops others). Returns new headers + rows. */
export function selectColumns(headers: string[], rows: string[][], columns: string[]): { headers: string[]; rows: string[][] } {
  if (columns.length === 0) return { headers, rows };
  const indices = columns.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  const newHeaders = indices.map((i) => headers[i]);
  const newRows = rows.map((row) => indices.map((i) => row[i] ?? ""));
  return { headers: newHeaders, rows: newRows };
}

/** Remove rows that are completely empty (all cells blank). */
export function removeEmptyRows(rows: string[][]): string[][] {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Generate a filename from a template. */
export function generateFilename(
  template: string,
  index: number,
  total: number,
  baseName: string,
  groupValue?: string,
): string {
  const padLen = String(total).length;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return template
    .replace(/\{base\}/g, baseName)
    .replace(/\{index\}/g, String(index + 1).padStart(padLen, "0"))
    .replace(/\{total\}/g, String(total))
    .replace(/\{group\}/g, sanitizeFilename(groupValue ?? ""))
    .replace(/\{date\}/g, dateStr);
}

/** Sanitize a string for use as a filename (alphanumeric + dash + underscore). */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50) || "group";
}

/** Strip extension from a filename. */
export function stripExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
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

/** Detect delimiter from content. */
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

/**
 * Top-level split dispatcher. Returns array of SplitResult + stats.
 */
export function splitCsv(
  parsed: ParsedCsv,
  options: SplitOptions,
  baseName: string,
  filenameTemplate: string,
  selectedColumns: string[] = [],
  dedupEnabled: boolean = false,
  removeEmpty: boolean = false,
): { results: SplitResult[]; stats: SplitStats } {
  const { headers, rows: originalRows } = parsed;
  let { rows } = parsed;

  // Column selection
  let effectiveHeaders = headers;
  if (selectedColumns.length > 0) {
    const sel = selectColumns(headers, rows, selectedColumns);
    effectiveHeaders = sel.headers;
    rows = sel.rows;
  }

  // Remove empty rows
  if (removeEmpty) {
    rows = removeEmptyRows(rows);
  }

  // Dedup (full row)
  let dedupedCount = 0;
  if (dedupEnabled) {
    const d = dedupRows(rows);
    rows = d.rows;
    dedupedCount = d.removed;
  }

  // Build chunks based on mode
  let chunks: string[][][];
  let groupValues: (string | undefined)[] | undefined;

  if (options.mode === "rowCount") {
    chunks = splitByRowCount(rows, options.rowsPerFile ?? 1000);
    groupValues = undefined;
  } else if (options.mode === "fileCount") {
    chunks = splitByFileCount(rows, options.fileCount ?? 2);
    groupValues = undefined;
  } else if (options.mode === "fileSize") {
    chunks = splitByFileSize(headers, rows, options.bytesPerFile ?? 1024 * 1024, options.delimiter, options.preserveHeader);
    groupValues = undefined;
  } else if (options.mode === "columnValue") {
    if (!options.groupColumn) throw new Error("groupColumn is required for columnValue mode.");
    const groups = splitByColumnValue(effectiveHeaders, rows, options.groupColumn);
    chunks = groups.map((g) => g.rows);
    groupValues = groups.map((g) => g.value);
  } else {
    throw new Error(`Unknown split mode: ${options.mode}`);
  }

  const total = chunks.length;
  const results: SplitResult[] = chunks.map((chunkRows, i) => {
    const content = toCsv(options.preserveHeader ? effectiveHeaders : [], chunkRows, options.delimiter);
    const filename = generateFilename(
      filenameTemplate,
      i,
      total,
      baseName,
      groupValues?.[i],
    );
    return {
      filename,
      content,
      rowCount: chunkRows.length,
      byteSize: byteSize(content),
      preview: previewRows(options.preserveHeader ? effectiveHeaders : [], chunkRows, 5),
      headers: options.preserveHeader ? effectiveHeaders : [],
    };
  });

  const stats: SplitStats = {
    totalRows: rows.length,
    totalColumns: effectiveHeaders.length,
    splitCount: results.length,
    perSplitRowCounts: results.map((r) => r.rowCount),
    perSplitByteSizes: results.map((r) => r.byteSize),
    dedupedCount,
  };

  return { results, stats };
}

/** Estimate split count for a given mode (without running the full split). */
export function estimateSplitCount(parsed: ParsedCsv, options: SplitOptions): number {
  const { rows, headers } = parsed;
  if (options.mode === "rowCount") {
    const r = options.rowsPerFile ?? 1000;
    return Math.max(1, Math.ceil(rows.length / r));
  }
  if (options.mode === "fileCount") {
    return Math.max(1, options.fileCount ?? 1);
  }
  if (options.mode === "fileSize") {
    const totalBytes = byteSize(toCsv(headers, rows, options.delimiter));
    return Math.max(1, Math.ceil(totalBytes / (options.bytesPerFile ?? 1024 * 1024)));
  }
  if (options.mode === "columnValue") {
    const idx = headers.indexOf(options.groupColumn ?? "");
    if (idx < 0) return 0;
    return new Set(rows.map((r) => r[idx])).size;
  }
  return 0;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== Minimal ZIP writer (STORE method, no compression) =====

/** CRC32 (returns unsigned 32-bit number). */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipFile {
  name: string;
  data: Uint8Array;
}

/** Build a ZIP archive (STORE method) from file entries. Returns a Blob. */
export function createZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const enc = new TextEncoder();
  const zipFiles: ZipFile[] = files.map((f) => ({ name: f.name, data: enc.encode(f.content) }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of zipFiles) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);     // Local file header signature
    lv.setUint16(4, 20, true);             // Version needed to extract
    lv.setUint16(6, 0, true);              // General purpose bit flag
    lv.setUint16(8, 0, true);              // Compression method (0 = STORE)
    lv.setUint16(10, 0, true);             // File last modification time
    lv.setUint16(12, 0, true);             // File last modification date
    lv.setUint32(14, crc, true);           // CRC-32
    lv.setUint32(18, size, true);          // Compressed size
    lv.setUint32(22, size, true);          // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);             // Extra field length
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);

    // Central directory file header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);     // Central file header signature
    cv.setUint16(4, 20, true);             // Version made by
    cv.setUint16(6, 20, true);             // Version needed to extract
    cv.setUint16(8, 0, true);              // General purpose bit flag
    cv.setUint16(10, 0, true);             // Compression method
    cv.setUint16(12, 0, true);             // File last modification time
    cv.setUint16(14, 0, true);             // File last modification date
    cv.setUint32(16, crc, true);           // CRC-32
    cv.setUint32(20, size, true);          // Compressed size
    cv.setUint32(24, size, true);          // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true);             // Extra field length
    cv.setUint16(32, 0, true);             // File comment length
    cv.setUint16(34, 0, true);             // Disk number where file starts
    cv.setUint16(36, 0, true);             // Internal file attributes
    cv.setUint32(38, 0, true);             // External file attributes
    cv.setUint32(42, offset, true);        // Offset of local file header
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const centralOffset = offset;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);       // EOCD signature
  ev.setUint16(4, 0, true);                // Number of this disk
  ev.setUint16(6, 0, true);                // Disk where central directory starts
  ev.setUint16(8, zipFiles.length, true);  // Number of central directory records on this disk
  ev.setUint16(10, zipFiles.length, true); // Total number of central directory records
  ev.setUint32(12, centralSize, true);     // Size of central directory
  ev.setUint32(16, centralOffset, true);   // Offset of start of central directory
  ev.setUint16(20, 0, true);               // Comment length

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-csv-splitter-history";
const MAX_HISTORY = 10;

export interface CsvSplitHistoryEntry {
  fileName: string;
  mode: SplitMode;
  delimiter: string;
  splitCount: number;
  totalRows: number;
  splitAt: string;
}

export function loadHistory(): CsvSplitHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: CsvSplitHistoryEntry): CsvSplitHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL encoding the split settings (never file contents). */
export function buildShareUrl(options: SplitOptions, template: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", options.mode);
  if (options.rowsPerFile) params.set("rows", String(options.rowsPerFile));
  if (options.bytesPerFile) params.set("bytes", String(options.bytesPerFile));
  if (options.groupColumn) params.set("col", options.groupColumn);
  if (options.fileCount) params.set("count", String(options.fileCount));
  params.set("hdr", String(options.preserveHeader));
  params.set("delim", options.delimiter === "\t" ? "\\t" : options.delimiter);
  params.set("tpl", template);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
