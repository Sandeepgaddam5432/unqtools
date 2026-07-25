/**
 * MOBI to PDF Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - Page-size presets (A4 / Letter / Legal)
 *  - Margin + font size + font family
 *  - Title-page generator with author / source metadata
 *  - MOBI PalmDB header detection (EXTH record scan for metadata)
 *  - Best-effort ASCII text extraction from raw bytes
 *  - Pagination with word-wrap
 *  - Batch conversion queue
 *  - Progress state machine (0..100%)
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch outcomes
 *  - Validation of options
 *  - Page count estimate from text length & geometry
 *  - Compression ratio / size-delta reporting
 *  - Metadata block formatting
 *  - Reading-time estimate (words / 200 wpm)
 */
export type PageSize = "a4" | "letter" | "legal";
export type FontFamily = "helvetica" | "times-roman" | "courier";

export interface ConvertOptions {
  pageSize?: PageSize;
  margin?: number;
  fontSize?: number;
  fontFamily?: FontFamily;
  includePageNumbers?: boolean;
  includeTitlePage?: boolean;
  title?: string;
  author?: string;
}

export interface ConvertResult {
  success: boolean;
  inputSize: number;
  outputSize: number;
  warnings: string[];
  log: string[];
  pageCount: number;
}

export interface PageDimensions { w: number; h: number; }

export interface MobiMetadata {
  title: string;
  author: string;
  publisher: string;
  language: string;
  hasExth: boolean;
}

export interface BatchOutcome {
  id: string;
  filename: string;
  success: boolean;
  pageCount: number;
  outputSize: number;
  warnings: string[];
  log: string[];
}

export interface ProgressState { percent: number; stage: string; processed: number; total: number; }

export const SOURCE_FORMAT = "MOBI";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".mobi";
export const TARGET_EXT = ".pdf";

/** "BOOKMOBI" magic bytes at offset 60 in PDB header. */
export const MOBI_MAGIC = "BOOKMOBI";

export function pageDimensions(size: PageSize): PageDimensions {
  if (size === "a4") return { w: 595, h: 842 };
  if (size === "letter") return { w: 612, h: 792 };
  return { w: 612, h: 1008 };
}

export function averageCharWidth(family: FontFamily, size: number): number {
  const factor = family === "courier" ? 0.6 : family === "times-roman" ? 0.48 : 0.55;
  return size * factor;
}

export function usableArea(size: PageSize, margin: number): { w: number; h: number } {
  const d = pageDimensions(size);
  return { w: Math.max(0, d.w - 2 * margin), h: Math.max(0, d.h - 2 * margin) };
}

export function pageGeometry(opts: ConvertOptions): { charsPerLine: number; linesPerPage: number } {
  const size = opts.pageSize ?? "a4";
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  const family = opts.fontFamily ?? "helvetica";
  const ua = usableArea(size, margin);
  return {
    charsPerLine: Math.max(8, Math.floor(ua.w / averageCharWidth(family, fontSize))),
    linesPerPage: Math.max(2, Math.floor(ua.h / (fontSize * 1.4))),
  };
}

/** Validate the PDB magic bytes at offset 60. */
export function isMobiFile(bytes: Uint8Array): boolean {
  if (bytes.length < 68) return false;
  let magic = "";
  for (let i = 60; i < 68; i++) magic += String.fromCharCode(bytes[i]!);
  return magic === MOBI_MAGIC;
}

/** Best-effort ASCII extraction from a MOBI byte buffer. */
export function extractAscii(bytes: Uint8Array, max = 200000): string {
  const end = Math.min(bytes.length, max);
  let out = "";
  for (let i = 0; i < end; i++) {
    const b = bytes[i]!;
    if ((b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x0D || b === 0x09) out += String.fromCharCode(b);
    else if (out.length > 0 && out[out.length - 1] !== "\n") out += "\n";
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Locate EXTH header offset given PDB+MOBI header layout. Returns -1 if absent. */
export function findExthOffset(bytes: Uint8Array): number {
  if (bytes.length < 80) return -1;
  // First record offset is at byte 78 (4-byte big-endian).
  const rec0Offset = (bytes[78]! << 24) | (bytes[79]! << 16) | (bytes[80]! << 8) | bytes[81]!;
  if (!Number.isFinite(rec0Offset) || rec0Offset < 0 || rec0Offset + 80 >= bytes.length) return -1;
  // MOBI header begins at rec0Offset+16, EXTH magic "EXTH" at rec0Offset+16+16 if EXTH flag set.
  for (let probe = rec0Offset + 16; probe < Math.min(bytes.length - 4, rec0Offset + 200); probe++) {
    if (bytes[probe] === 0x45 && bytes[probe + 1] === 0x58 && bytes[probe + 2] === 0x54 && bytes[probe + 3] === 0x48) {
      return probe;
    }
  }
  return -1;
}

/** Extract EXTH metadata (title=100, author=100 fallback, publisher=101, language=106). */
export function extractExthMetadata(bytes: Uint8Array): MobiMetadata {
  const fallback: MobiMetadata = { title: "Untitled", author: "Unknown", publisher: "", language: "en", hasExth: false };
  const exthOff = findExthOffset(bytes);
  if (exthOff < 0) return fallback;
  const meta: MobiMetadata = { ...fallback, hasExth: true };
  // EXTH layout: magic(4) + length(4) + count(4) + records (type(4) + length(4) + data)
  const count = (bytes[exthOff + 8]! << 24) | (bytes[exthOff + 9]! << 16) | (bytes[exthOff + 10]! << 8) | bytes[exthOff + 11]!;
  let cursor = exthOff + 12;
  for (let i = 0; i < count && cursor + 8 < bytes.length; i++) {
    const type = (bytes[cursor]! << 24) | (bytes[cursor + 1]! << 16) | (bytes[cursor + 2]! << 8) | bytes[cursor + 3]!;
    const len = (bytes[cursor + 4]! << 24) | (bytes[cursor + 5]! << 16) | (bytes[cursor + 6]! << 8) | bytes[cursor + 7]!;
    if (len < 8 || cursor + len > bytes.length) break;
    const dataBytes = bytes.slice(cursor + 8, cursor + len);
    const value = extractAscii(dataBytes).replace(/\s+/g, " ").trim();
    if (type === 100 && value) meta.title = value;
    else if (type === 101 && value) meta.publisher = value;
    else if (type === 106 && value) meta.language = value;
    else if ((type === 100 || type === 102) && value && meta.author === "Unknown") meta.author = value;
    cursor += len;
  }
  return meta;
}

export function wrapParagraph(para: string, charsPerLine: number): string[] {
  const words = para.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) { current = w; continue; }
    if ((current + " " + w).length > charsPerLine) { lines.push(current); current = w; }
    else current = current + " " + w;
  }
  if (current) lines.push(current);
  return lines;
}

export function paginateText(text: string, options: ConvertOptions): string[] {
  const { charsPerLine, linesPerPage } = pageGeometry(options);
  const paragraphs = text.split("\n");
  const pages: string[] = [];
  let current: string[] = [];
  let lineCount = 0;
  for (const para of paragraphs) {
    const lines = para.trim() === "" ? [""] : wrapParagraph(para, charsPerLine);
    for (const ln of lines) {
      current.push(ln); lineCount++;
      if (lineCount >= linesPerPage) { pages.push(current.join("\n")); current = []; lineCount = 0; }
    }
  }
  if (current.length > 0) pages.push(current.join("\n"));
  if (pages.length === 0) pages.push("");
  return pages;
}

export function estimatePageCount(text: string, options: ConvertOptions): number {
  const { charsPerLine, linesPerPage } = pageGeometry(options);
  const totalLines = text.split("\n").reduce((acc, p) => acc + Math.max(1, Math.ceil((p.length + 1) / charsPerLine)), 0);
  return Math.max(1, Math.ceil(totalLines / linesPerPage));
}

/** Reading-time estimate in minutes (default 200 wpm). */
export function estimateReadingTime(text: string, wpm = 200): number {
  const words = (text.match(/\S+/g) ?? []).length;
  return Math.max(1, Math.round(words / wpm));
}

export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  if (margin < 0 || margin > 300) return { error: "Margin must be 0–300 pt" };
  if (fontSize < 6 || fontSize > 72) return { error: "Font size must be 6–72 pt" };
  return { ok: true };
}

export function buildTitlePage(title: string, author: string, source: string, target: string): string {
  return ["", "", title, "", `by ${author}`, "", "", `Converted from ${source} to ${target}`, new Date().toISOString().slice(0, 10)].join("\n");
}

export function formatLog(entries: string[]): string {
  return entries.map((e, i) => `${i + 1}. ${e}`).join("\n");
}

export function summarizeResult(result: ConvertResult): string {
  const delta = result.outputSize - result.inputSize;
  const sign = delta >= 0 ? "+" : "";
  return [
    "Conversion Summary", "==================",
    `Success: ${result.success ? "YES" : "NO"}`,
    `Input size: ${result.inputSize} bytes`, `Output size: ${result.outputSize} bytes`,
    `Size delta: ${sign}${delta} bytes`, `Pages: ${result.pageCount}`,
    "", "Log:", ...result.log.map((l) => `  - ${l}`),
    "",
    ...(result.warnings.length > 0 ? ["Warnings:", ...result.warnings.map((w) => `  - ${w}`)] : []),
  ].join("\n");
}

export function nextProgress(processed: number, total: number, stage: string): ProgressState {
  const safeTotal = Math.max(1, total);
  return { percent: Math.min(100, Math.max(0, Math.round((processed / safeTotal) * 100))), stage, processed, total: safeTotal };
}

export function batchToCsv(outcomes: BatchOutcome[]): string {
  const header = "Id,Filename,Success,Pages,Bytes,Warnings";
  const rows = outcomes.map((o) => [o.id, `"${o.filename.replace(/"/g, '""')}"`, o.success ? "yes" : "no", o.pageCount, o.outputSize, o.warnings.length].join(","));
  return [header, ...rows].join("\n");
}

export function formatMetadata(opts: ConvertOptions, mobi?: MobiMetadata): string {
  return [
    `Title: ${mobi?.title ?? opts.title ?? "Untitled"}`,
    `Author: ${mobi?.author ?? opts.author ?? "Unknown"}`,
    `Publisher: ${mobi?.publisher ?? ""}`,
    `Language: ${mobi?.language ?? "en"}`,
    `EXTH header: ${mobi?.hasExth ? "found" : "not found"}`,
    `Page size: ${opts.pageSize ?? "a4"}`,
    `Font: ${opts.fontFamily ?? "helvetica"} ${opts.fontSize ?? 12}pt`,
  ].filter((l) => !l.endsWith(": ")).join("\n");
}

export function compressionRatio(inputSize: number, outputSize: number): string {
  if (outputSize === 0) return "n/a";
  const r = inputSize / outputSize;
  return r >= 1 ? `${r.toFixed(2)}:1 (smaller)` : `1:${(1 / r).toFixed(2)} (larger)`;
}

export function quickStats(text: string, pages: number): { chars: number; words: number; lines: number; pages: number; readingMinutes: number } {
  return { chars: text.length, words: (text.match(/\S+/g) ?? []).length, lines: text.split("\n").length, pages, readingMinutes: estimateReadingTime(text) };
}
