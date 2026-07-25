/**
 * EPUB to PDF Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - Page-size presets (A4 / Letter / Legal)
 *  - Margin + font size + font family
 *  - Title-page generator with author / source metadata
 *  - OPF metadata parsing (title, author, language, subject, identifier)
 *  - Chapter extraction from spine order (HTML files inside the EPUB)
 *  - HTML → plain-text conversion (strip tags, decode entities, lists, headings)
 *  - Table-of-Contents generation from chapter list
 *  - Pagination with word-wrap
 *  - Batch conversion queue
 *  - Progress state machine (0..100%)
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch outcomes
 *  - Validation of options
 *  - Page count estimate from text length & geometry
 *  - Compression ratio / size-delta reporting
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
  includeToc?: boolean;
  title?: string;
  author?: string;
  language?: string;
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

export interface OpfMetadata {
  title: string;
  author: string;
  language: string;
  subject: string;
  identifier: string;
}

export interface Chapter {
  index: number;
  href: string;
  title: string;
  text: string;
  charCount: number;
}

export interface BatchOutcome {
  id: string;
  filename: string;
  success: boolean;
  pageCount: number;
  outputSize: number;
  chapters: number;
  warnings: string[];
  log: string[];
}

export interface ProgressState {
  percent: number;
  stage: string;
  processed: number;
  total: number;
}

export const SOURCE_FORMAT = "EPUB";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".epub";
export const TARGET_EXT = ".pdf";

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

/** Decode the 5 core HTML entities + numeric/hex entities. Pure regex. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeFromCodePoint(parseInt(n, 16)));
}

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try { return String.fromCodePoint(cp); } catch { return ""; }
}

/** Strip HTML tags and convert to plain text (preserve paragraphs/headings/lists). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/** Parse OPF XML metadata (pure regex). */
export function parseOpfMetadata(opfXml: string): OpfMetadata {
  const pick = (re: RegExp): string => {
    const m = re.exec(opfXml);
    return m ? m[1]!.trim() : "";
  };
  return {
    title: pick(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) || "Untitled",
    author: pick(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i) || "Unknown",
    language: pick(/<dc:language[^>]*>([^<]+)<\/dc:language>/i) || "en",
    subject: pick(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/i) || "",
    identifier: pick(/<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/i) || "",
  };
}

/** Build a Chapter object from raw HTML. */
export function buildChapter(index: number, href: string, html: string): Chapter {
  const text = htmlToText(html);
  const titleMatch = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]!.trim()) : (href.split("/").pop() ?? href);
  return { index, href, title, text, charCount: text.length };
}

/** Generate TOC text from chapter list. */
export function generateToc(chapters: Chapter[]): string {
  if (chapters.length === 0) return "";
  const lines = ["Table of Contents", "====================", ""];
  chapters.forEach((c) => lines.push(`${String(c.index + 1).padStart(2, "0")}. ${c.title}  (${c.charCount} chars)`));
  return lines.join("\n");
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

/** Concatenate chapter texts into a single document with chapter headers. */
export function concatenateChapters(chapters: Chapter[]): string {
  return chapters.map((c) => `${c.title}\n${"=".repeat(Math.min(40, c.title.length))}\n\n${c.text}`).join("\n\n\n");
}

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
  const header = "Id,Filename,Success,Pages,Chapters,Bytes,Warnings";
  const rows = outcomes.map((o) => [o.id, `"${o.filename.replace(/"/g, '""')}"`, o.success ? "yes" : "no", o.pageCount, o.chapters, o.outputSize, o.warnings.length].join(","));
  return [header, ...rows].join("\n");
}

export function formatMetadata(opts: ConvertOptions, opf?: OpfMetadata): string {
  return [
    `Title: ${opf?.title ?? opts.title ?? "Untitled"}`,
    `Author: ${opf?.author ?? opts.author ?? "Unknown"}`,
    `Language: ${opf?.language ?? opts.language ?? "en"}`,
    `Subject: ${opf?.subject ?? ""}`,
    `Identifier: ${opf?.identifier ?? ""}`,
    `Page size: ${opts.pageSize ?? "a4"}`,
    `Font: ${opts.fontFamily ?? "helvetica"} ${opts.fontSize ?? 12}pt`,
  ].filter((l) => !l.endsWith(": ")).join("\n");
}

export function compressionRatio(inputSize: number, outputSize: number): string {
  if (outputSize === 0) return "n/a";
  const r = inputSize / outputSize;
  return r >= 1 ? `${r.toFixed(2)}:1 (smaller)` : `1:${(1 / r).toFixed(2)} (larger)`;
}

export function quickStats(text: string, pages: number, chapters: number): { chars: number; words: number; lines: number; pages: number; chapters: number } {
  return { chars: text.length, words: (text.match(/\S+/g) ?? []).length, lines: text.split("\n").length, pages, chapters };
}
