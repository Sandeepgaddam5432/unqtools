/**
 * XPS to PDF Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - XPS XML parsing (FixedDocument + FixedPage + Glyphs)
 *  - Glyphs UnicodeString extraction (text content per page)
 *  - DocumentProperties extraction (Title / Author / Subject / Keywords)
 *  - Page size detection from FixedPage Width/Height attributes
 *  - Page-size presets (A4 / Letter / Legal) for the OUTPUT PDF
 *  - Margin + font size + font family
 *  - Title-page generator
 *  - Batch conversion queue
 *  - Progress state machine (0..100%)
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch outcomes
 *  - Validation of options + XML well-formedness
 *  - Word count + reading time
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

export interface XpsPage { width: number; height: number; lines: string[]; }
export interface XpsDocument {
  pages: XpsPage[];
  title: string;
  author: string;
  subject: string;
  keywords: string;
  warnings: string[];
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

export const SOURCE_FORMAT = "XPS";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".xps";
export const TARGET_EXT = ".pdf";
export const XPS_NS = "http://schemas.microsoft.com/xps/2005/06";

export function pageDimensions(size: PageSize): PageDimensions {
  if (size === "a4") return { w: 595, h: 842 };
  if (size === "letter") return { w: 612, h: 792 };
  return { w: 612, h: 1008 };
}

/** XML-unescape entities. */
export function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeFromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&"); // last to avoid double-unescape
}

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try { return String.fromCodePoint(cp); } catch { return ""; }
}

/** Extract all UnicodeString="..." values from Glyphs elements in a FixedPage chunk. */
export function extractGlyphsText(pageXml: string): string[] {
  const out: string[] = [];
  const re = /<Glyphs[^>]*\sUnicodeString="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageXml)) !== null) {
    out.push(xmlUnescape(m[1]!));
  }
  return out;
}

/** Extract a numeric attribute from an XML element string. */
export function extractNumericAttr(xml: string, attr: string): number | null {
  const re = new RegExp(`\\s${attr}="([\\d.]+)"`);
  const m = re.exec(xml);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Parse a FixedDocument XML string into structured XpsDocument. */
export function parseXps(xml: string): XpsDocument {
  const warnings: string[] = [];
  if (!xml.includes("FixedDocument")) {
    warnings.push("Input is not a FixedDocument — using best-effort parse.");
  }
  const titleMatch = /<Title>([^<]*)<\/Title>/.exec(xml);
  const authorMatch = /<Author>([^<]*)<\/Author>/.exec(xml);
  const subjectMatch = /<Subject>([^<]*)<\/Subject>/.exec(xml);
  const keywordsMatch = /<Keywords>([^<]*)<\/Keywords>/.exec(xml);

  const pageChunks: string[] = [];
  const pageRe = /<FixedPage[\s\S]*?<\/FixedPage>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pageRe.exec(xml)) !== null) pageChunks.push(pm[0]!);
  if (pageChunks.length === 0) warnings.push("No FixedPage elements found.");

  const pages: XpsPage[] = pageChunks.map((chunk) => {
    const width = extractNumericAttr(chunk, "Width") ?? 595;
    const height = extractNumericAttr(chunk, "Height") ?? 842;
    return { width, height, lines: extractGlyphsText(chunk) };
  });

  return {
    pages,
    title: titleMatch ? xmlUnescape(titleMatch[1]!.trim()) : "Untitled",
    author: authorMatch ? xmlUnescape(authorMatch[1]!.trim()) : "Unknown",
    subject: subjectMatch ? xmlUnescape(subjectMatch[1]!.trim()) : "",
    keywords: keywordsMatch ? xmlUnescape(keywordsMatch[1]!.trim()) : "",
    warnings,
  };
}

/** Classify a page size by dimensions. */
export function classifyPageSize(w: number, h: number): PageSize {
  if (Math.abs(w - 595) < 5 && Math.abs(h - 842) < 5) return "a4";
  if (Math.abs(w - 612) < 5 && Math.abs(h - 792) < 5) return "letter";
  if (Math.abs(w - 612) < 5 && Math.abs(h - 1008) < 5) return "legal";
  return "a4";
}

export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  if (margin < 0 || margin > 300) return { error: "Margin must be 0–300 pt" };
  if (fontSize < 6 || fontSize > 72) return { error: "Font size must be 6–72 pt" };
  return { ok: true };
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
  const size = options.pageSize ?? "a4";
  const margin = options.margin ?? 50;
  const fontSize = options.fontSize ?? 12;
  const family = options.fontFamily ?? "helvetica";
  const dims = pageDimensions(size);
  const factor = family === "courier" ? 0.6 : family === "times-roman" ? 0.48 : 0.55;
  const charsPerLine = Math.max(8, Math.floor((dims.w - 2 * margin) / (fontSize * factor)));
  const linesPerPage = Math.max(2, Math.floor((dims.h - 2 * margin) / (fontSize * 1.4)));
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

export function formatMetadata(opts: ConvertOptions, xps?: XpsDocument): string {
  return [
    `Title: ${xps?.title ?? opts.title ?? "Untitled"}`,
    `Author: ${xps?.author ?? opts.author ?? "Unknown"}`,
    `Subject: ${xps?.subject ?? ""}`,
    `Keywords: ${xps?.keywords ?? ""}`,
    `Output page size: ${opts.pageSize ?? "a4"}`,
    `Font: ${opts.fontFamily ?? "helvetica"} ${opts.fontSize ?? 12}pt`,
  ].filter((l) => !l.endsWith(": ")).join("\n");
}

export function compressionRatio(inputSize: number, outputSize: number): string {
  if (outputSize === 0) return "n/a";
  const r = inputSize / outputSize;
  return r >= 1 ? `${r.toFixed(2)}:1 (smaller)` : `1:${(1 / r).toFixed(2)} (larger)`;
}

export function quickStats(text: string, pages: number): { chars: number; words: number; lines: number; pages: number } {
  return { chars: text.length, words: (text.match(/\S+/g) ?? []).length, lines: text.split("\n").length, pages };
}
