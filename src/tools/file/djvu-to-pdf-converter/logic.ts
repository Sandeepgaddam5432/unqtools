/**
 * DjVu to PDF Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - Page-size presets (A4 / Letter / Legal) with point dimensions
 *  - Margin + font size + font family configuration
 *  - Title-page generator with author / source metadata
 *  - Three text-extraction modes: "plain" (text-only), "layout" (preserve
 *    whitespace columns), "ocr-fallback" (best-effort ASCII + non-ASCII bytes
 *    as '?' placeholders)
 *  - DjVu TXTz chunk locator (pure byte-scan on Uint8Array input)
 *  - Batch conversion queue with per-item progress
 *  - Progress state machine (0..100%)
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch outcomes
 *  - Validation of options
 *  - Page count estimate from text length & geometry
 *  - Word-wrap pagination
 *  - Compression ratio / size-delta reporting
 *  - Metadata block formatting
 */
export type PageSize = "a4" | "letter" | "legal";
export type FontFamily = "helvetica" | "times-roman" | "courier";
export type ExtractionMode = "plain" | "layout" | "ocr-fallback";

export interface ConvertOptions {
  pageSize?: PageSize;
  margin?: number;
  fontSize?: number;
  fontFamily?: FontFamily;
  includePageNumbers?: boolean;
  includeTitlePage?: boolean;
  title?: string;
  author?: string;
  extractionMode?: ExtractionMode;
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

export interface BatchOutcome {
  id: string;
  filename: string;
  success: boolean;
  pageCount: number;
  outputSize: number;
  warnings: string[];
  log: string[];
}

export interface ProgressState {
  percent: number;
  stage: string;
  processed: number;
  total: number;
}

export const SOURCE_FORMAT = "DjVu";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".djvu";
export const TARGET_EXT = ".pdf";

/** Magic bytes "TXTz" used by DjVu text chunks. */
export const TXTZ_MAGIC = [0x54, 0x58, 0x54, 0x7a] as const;

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

/** Locate the offset of the TXTz chunk in a Uint8Array (or -1). */
export function findTxtzChunk(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === TXTZ_MAGIC[0] && bytes[i + 1] === TXTZ_MAGIC[1] && bytes[i + 2] === TXTZ_MAGIC[2] && bytes[i + 3] === TXTZ_MAGIC[3]) return i;
  }
  return -1;
}

/** Extract printable ASCII text from a byte buffer (best-effort). */
export function extractAsciiFromBytes(bytes: Uint8Array, max = 100000): string {
  const end = Math.min(bytes.length, max);
  let out = "";
  for (let i = 0; i < end; i++) {
    const b = bytes[i]!;
    if ((b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x0D || b === 0x09) out += String.fromCharCode(b);
    else if (out.length > 0 && out[out.length - 1] !== "\n") out += "\n";
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** OCR-fallback: replace non-printable bytes with '?' to mark unknown glyphs. */
export function ocrFallback(bytes: Uint8Array, max = 50000): string {
  const end = Math.min(bytes.length, max);
  let out = "";
  for (let i = 0; i < end; i++) {
    const b = bytes[i]!;
    if ((b >= 0x20 && b < 0x7F) || b === 0x0A) out += String.fromCharCode(b);
    else if (b === 0x0D || b === 0x09) out += " ";
    else out += "?";
  }
  return out.replace(/\?{3,}/g, "???").replace(/\n{3,}/g, "\n\n").trim();
}

/** Apply extraction mode to a raw byte buffer. */
export function applyExtractionMode(bytes: Uint8Array, mode: ExtractionMode): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  if (mode === "ocr-fallback") {
    const txt = ocrFallback(bytes);
    if (txt.includes("?")) warnings.push("OCR fallback replaced unknown bytes with '?'.");
    return { text: txt, warnings };
  }
  const offset = findTxtzChunk(bytes);
  if (offset >= 0) {
    const slice = bytes.slice(offset + 4);
    if (mode === "layout") {
      // Layout mode preserves raw whitespace (don't collapse runs).
      let out = "";
      for (let i = 0; i < slice.length; i++) {
        const b = slice[i]!;
        if ((b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x20 || b === 0x09) out += String.fromCharCode(b);
        else if (out.length > 0 && out[out.length - 1] !== "\n") out += "\n";
      }
      return { text: out.trim(), warnings };
    }
    return { text: extractAsciiFromBytes(slice), warnings };
  }
  warnings.push("TXTz chunk not found; fell back to whole-file ASCII scan.");
  return { text: extractAsciiFromBytes(bytes), warnings };
}

/** Word-wrap a paragraph. */
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

/** Paginate cleaned text into per-page strings. */
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

/** Estimate page count from text length. */
export function estimatePageCount(text: string, options: ConvertOptions): number {
  const { charsPerLine, linesPerPage } = pageGeometry(options);
  const totalLines = text.split("\n").reduce((acc, p) => acc + Math.max(1, Math.ceil((p.length + 1) / charsPerLine)), 0);
  return Math.max(1, Math.ceil(totalLines / linesPerPage));
}

export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  if (margin < 0 || margin > 300) return { error: "Margin must be 0–300 pt" };
  if (fontSize < 6 || fontSize > 72) return { error: "Font size must be 6–72 pt" };
  if (opts.extractionMode && !["plain", "layout", "ocr-fallback"].includes(opts.extractionMode)) return { error: "Invalid extraction mode" };
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
    `Input size: ${result.inputSize} bytes`,
    `Output size: ${result.outputSize} bytes`,
    `Size delta: ${sign}${delta} bytes`,
    `Pages: ${result.pageCount}`,
    "", "Log:",
    ...result.log.map((l) => `  - ${l}`),
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

export function formatMetadata(opts: ConvertOptions): string {
  return [
    `Title: ${opts.title ?? "Untitled"}`,
    `Author: ${opts.author ?? "Unknown"}`,
    `Page size: ${opts.pageSize ?? "a4"}`,
    `Font: ${opts.fontFamily ?? "helvetica"} ${opts.fontSize ?? 12}pt`,
    `Margin: ${opts.margin ?? 50}pt`,
    `Extraction: ${opts.extractionMode ?? "plain"}`,
  ].join("\n");
}

export function compressionRatio(inputSize: number, outputSize: number): string {
  if (outputSize === 0) return "n/a";
  const r = inputSize / outputSize;
  return r >= 1 ? `${r.toFixed(2)}:1 (smaller)` : `1:${(1 / r).toFixed(2)} (larger)`;
}

export function quickStats(text: string, pages: number): { chars: number; words: number; lines: number; pages: number } {
  return { chars: text.length, words: (text.match(/\S+/g) ?? []).length, lines: text.split("\n").length, pages };
}

/** List supported extraction modes for UI display. */
export const EXTRACTION_MODES: ExtractionMode[] = ["plain", "layout", "ocr-fallback"];
