/**
 * AZW3 to PDF Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - Page-size presets (A4 / Letter / Legal) with point dimensions
 *  - Margin + font size + font family configuration
 *  - Title-page generator with author / source metadata
 *  - Chapter detection from plain-text heuristics (all-caps / "Chapter N")
 *  - Table-of-contents generation from detected chapters
 *  - Pagination with word-wrap respecting usable area
 *  - Batch conversion queue (multiple inputs) with per-item progress
 *  - Progress state machine (0..100%) for streaming UI feedback
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch results
 *  - Validation of options + extracted text
 *  - Plain-text cleanup (collapse whitespace, smart quotes, hyphenated lines)
 *  - Page count estimation from text length & page geometry
 *  - Compression ratio / size-delta reporting
 *
 * NOTE: AZW3 binary parsing is best-effort (binary format). The pure helpers
 * below operate on the extracted text stream and feed into pdf-lib in ui.tsx.
 */

export type PageSize = "a4" | "letter" | "legal";
export type FontFamily = "helvetica" | "times-roman" | "courier";

export interface ConvertOptions {
  pageSize?: PageSize;
  margin?: number; // points
  fontSize?: number; // points
  fontFamily?: FontFamily;
  includePageNumbers?: boolean;
  includeTitlePage?: boolean;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  customCss?: string;
  detectChapters?: boolean;
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

export interface Chapter {
  index: number;
  title: string;
  charStart: number;
  charEnd: number;
  preview: string;
}

export interface BatchItem {
  id: string;
  filename: string;
  inputSize: number;
  text: string;
  title: string;
  author: string;
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

export interface ProgressState {
  percent: number;       // 0..100
  stage: string;         // human-readable
  processed: number;
  total: number;
}

export const SOURCE_FORMAT = "AZW3";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".azw3";
export const TARGET_EXT = ".pdf";

/** Get page dimensions in points for a given page size. */
export function pageDimensions(size: PageSize): PageDimensions {
  if (size === "a4") return { w: 595, h: 842 };
  if (size === "letter") return { w: 612, h: 792 };
  return { w: 612, h: 1008 }; // legal
}

/** Approximate average char width for a font family at given size (in pt). */
export function averageCharWidth(family: FontFamily, size: number): number {
  const factor = family === "courier" ? 0.6 : family === "times-roman" ? 0.48 : 0.55;
  return size * factor;
}

/** Compute usable width/height after subtracting margins. */
export function usableArea(size: PageSize, margin: number): { w: number; h: number } {
  const d = pageDimensions(size);
  return { w: Math.max(0, d.w - 2 * margin), h: Math.max(0, d.h - 2 * margin) };
}

/** Compute chars-per-line and lines-per-page for a given geometry. */
export function pageGeometry(opts: ConvertOptions): { charsPerLine: number; linesPerPage: number } {
  const size = opts.pageSize ?? "a4";
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  const family = opts.fontFamily ?? "helvetica";
  const ua = usableArea(size, margin);
  const charsPerLine = Math.max(8, Math.floor(ua.w / averageCharWidth(family, fontSize)));
  const linesPerPage = Math.max(2, Math.floor(ua.h / (fontSize * 1.4)));
  return { charsPerLine, linesPerPage };
}

/** Word-wrap a single paragraph into lines respecting chars-per-line. */
export function wrapParagraph(para: string, charsPerLine: number): string[] {
  const words = para.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) { current = w; continue; }
    if ((current + " " + w).length > charsPerLine) {
      lines.push(current);
      current = w;
    } else {
      current = current + " " + w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Clean extracted text: collapse whitespace, normalize quotes, de-hyphenate. */
export function cleanupText(input: string): string {
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(/\u2018|\u2019/g, "'").replace(/\u201C|\u201D/g, '"').replace(/\u2013|\u2014/g, "-");
  s = s.replace(/-\n(\w)/g, "$1"); // join hyphenated words across line breaks
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Detect chapters by heuristics: "Chapter N", all-caps lines, "PART N". */
export function detectChapters(text: string): Chapter[] {
  const lines = text.split("\n");
  const chapters: Chapter[] = [];
  let charCursor = 0;
  let nextIdx = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const isChapter = /^(chapter|ch\.?)\s+\d+/i.test(line);
    const isPart = /^part\s+\d+/i.test(line);
    const isCapsHeading = line.length > 0 && line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line) && !/^[^A-Za-z]+$/.test(line);
    if (isChapter || isPart || isCapsHeading) {
      const start = charCursor;
      const preview = lines.slice(i, i + 4).join(" ").slice(0, 80);
      chapters.push({ index: nextIdx++, title: line, charStart: start, charEnd: start + line.length, preview });
    }
    charCursor += lines[i]!.length + 1; // +1 for newline
  }
  return chapters;
}

/** Generate a plain-text Table of Contents from detected chapters. */
export function generateToc(chapters: Chapter[]): string {
  if (chapters.length === 0) return "";
  const lines = ["Table of Contents", "====================", ""];
  for (const c of chapters) {
    lines.push(`${String(c.index).padStart(2, "0")}. ${c.title}`);
  }
  return lines.join("\n");
}

/** Title-page body as plain text (the UI renders it via pdf-lib). */
export function buildTitlePage(title: string, author: string, source: string, target: string): string {
  return [
    "",
    "",
    title,
    "",
    `by ${author}`,
    "",
    "",
    `Converted from ${source} to ${target}`,
    new Date().toISOString().slice(0, 10),
  ].join("\n");
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
      current.push(ln);
      lineCount++;
      if (lineCount >= linesPerPage) { pages.push(current.join("\n")); current = []; lineCount = 0; }
    }
  }
  if (current.length > 0) pages.push(current.join("\n"));
  if (pages.length === 0) pages.push("");
  return pages;
}

/** Estimate total page count from text length without paginating. */
export function estimatePageCount(text: string, options: ConvertOptions): number {
  const { charsPerLine, linesPerPage } = pageGeometry(options);
  const totalLines = text.split("\n").reduce((acc, p) => acc + Math.max(1, Math.ceil((p.length + 1) / charsPerLine)), 0);
  return Math.max(1, Math.ceil(totalLines / linesPerPage));
}

/** Validate convert options. Returns { ok: true } or { error: string }. */
export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  if (margin < 0 || margin > 300) return { error: "Margin must be 0–300 pt" };
  if (fontSize < 6 || fontSize > 72) return { error: "Font size must be 6–72 pt" };
  if (opts.pageSize && !["a4", "letter", "legal"].includes(opts.pageSize)) return { error: "Invalid page size" };
  if (opts.fontFamily && !["helvetica", "times-roman", "courier"].includes(opts.fontFamily)) return { error: "Invalid font family" };
  return { ok: true };
}

/** Build the conversion log entries from raw signals. */
export function buildLog(signals: { extracted: number; pages: number; bytes: number; warnings: number; source: string; target: string; }): string[] {
  return [
    `Read ${signals.extracted} chars from ${signals.source} source`,
    `Paginated into ${signals.pages} pages`,
    `Generated ${signals.target} (${signals.bytes} bytes)`,
    signals.warnings > 0 ? `${signals.warnings} warning(s) emitted` : "No warnings",
  ];
}

/** Format log entries with sequence numbers (no timestamps in pure mode). */
export function formatLog(entries: string[]): string {
  return entries.map((e, i) => `${i + 1}. ${e}`).join("\n");
}

/** Build a human-readable summary of the conversion result. */
export function summarizeResult(result: ConvertResult): string {
  const delta = result.outputSize - result.inputSize;
  const sign = delta >= 0 ? "+" : "";
  return [
    "Conversion Summary",
    "==================",
    `Success: ${result.success ? "YES" : "NO"}`,
    `Input size: ${result.inputSize} bytes`,
    `Output size: ${result.outputSize} bytes`,
    `Size delta: ${sign}${delta} bytes`,
    `Pages: ${result.pageCount}`,
    "",
    "Log:",
    ...result.log.map((l) => `  - ${l}`),
    "",
    ...(result.warnings.length > 0 ? ["Warnings:", ...result.warnings.map((w) => `  - ${w}`)] : []),
  ].join("\n");
}

/** Compute the next progress state given processed / total items. */
export function nextProgress(processed: number, total: number, stage: string): ProgressState {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.max(0, Math.round((processed / safeTotal) * 100)));
  return { percent, stage, processed, total: safeTotal };
}

/** Convert a list of batch outcomes to CSV. */
export function batchToCsv(outcomes: BatchOutcome[]): string {
  const header = "Id,Filename,Success,Pages,Bytes,Warnings";
  const rows = outcomes.map((o) =>
    [o.id, `"${o.filename.replace(/"/g, '""')}"`, o.success ? "yes" : "no", o.pageCount, o.outputSize, o.warnings.length].join(","),
  );
  return [header, ...rows].join("\n");
}

/** Format PDF metadata as a key:value list. */
export function formatMetadata(opts: ConvertOptions): string {
  const lines = [
    `Title: ${opts.title ?? "Untitled"}`,
    `Author: ${opts.author ?? "Unknown"}`,
    `Subject: ${opts.subject ?? ""}`,
    `Keywords: ${opts.keywords ?? ""}`,
    `Page size: ${opts.pageSize ?? "a4"}`,
    `Font: ${opts.fontFamily ?? "helvetica"} ${opts.fontSize ?? 12}pt`,
    `Margin: ${opts.margin ?? 50}pt`,
  ];
  return lines.filter((l) => !l.endsWith(": ")).join("\n");
}

/** Compute compression ratio (input/output) as a human string. */
export function compressionRatio(inputSize: number, outputSize: number): string {
  if (outputSize === 0) return "n/a";
  const r = inputSize / outputSize;
  return r >= 1 ? `${r.toFixed(2)}:1 (smaller)` : `1:${(1 / r).toFixed(2)} (larger)`;
}

/** Quick stat block for a single conversion. */
export function quickStats(text: string, pages: number): { chars: number; words: number; lines: number; pages: number } {
  return {
    chars: text.length,
    words: (text.match(/\S+/g) ?? []).length,
    lines: text.split("\n").length,
    pages,
  };
}
