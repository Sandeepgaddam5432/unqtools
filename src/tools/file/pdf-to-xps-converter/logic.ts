/**
 * PDF to XPS Converter — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - XPS XML document generation (FixedDocument + FixedPage structure)
 *  - Page size presets with point dimensions
 *  - Margin + font size configuration
 *  - Glyphs XML emission with proper text escaping
 *  - Multi-page XPS generation (FixedPage per source page)
 *  - PDF metadata propagation (Title / Author / Subject / Keywords)
 *  - Batch conversion queue with per-item progress
 *  - Progress state machine (0..100%)
 *  - Result summary, log formatting, warnings, statistics
 *  - CSV export of batch outcomes
 *  - Validation of options
 *  - XML well-formedness check
 *  - Compression ratio / size-delta reporting
 *  - Page dimensions + glyph positioning math
 *
 * NOTE: True binary PDF→XPS rasterization requires a WASM rasterizer. This
 * pure module produces a valid XPS-flavored XML wrapper around extracted
 * text content; the UI uses pdf.js to extract that text.
 */
export type PageSize = "a4" | "letter" | "legal";

export interface ConvertOptions {
  pageSize?: PageSize;
  margin?: number;
  fontSize?: number;
  includePageNumbers?: boolean;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
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

export interface ProgressState { percent: number; stage: string; processed: number; total: number; }

export const SOURCE_FORMAT = "PDF";
export const TARGET_FORMAT = "XPS";
export const SOURCE_EXT = ".pdf";
export const TARGET_EXT = ".xps";
export const XPS_NS = "http://schemas.microsoft.com/xps/2005/06";

export function pageDimensions(size: PageSize): PageDimensions {
  if (size === "a4") return { w: 595, h: 842 };
  if (size === "letter") return { w: 612, h: 792 };
  return { w: 612, h: 1008 };
}

/** XML-escape a string for embedding inside attribute or text content. */
export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Build a single FixedPage element string from a list of text lines. */
export function buildFixedPage(lines: string[], opts: ConvertOptions, pageNum: number, includePageNumbers: boolean): string {
  const size = opts.pageSize ?? "a4";
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  const dims = pageDimensions(size);
  const lineHeight = fontSize * 1.4;
  const glyphs = lines.map((ln, i) => {
    const y = (dims.h - margin - (i + 1) * lineHeight).toFixed(2);
    return `      <Glyphs UnicodeString="${xmlEscape(ln)}" FontUri="/Resources/Fonts/arial.ttf" FontRenderingEmSize="${fontSize}" OriginX="${margin}" OriginY="${y}" />`;
  });
  const pageGlyph = includePageNumbers
    ? `      <Glyphs UnicodeString="${pageNum}" FontUri="/Resources/Fonts/arial.ttf" FontRenderingEmSize="10" OriginX="${(dims.w / 2 - 5).toFixed(2)}" OriginY="20" />`
    : "";
  return `    <FixedPage Width="${dims.w}" Height="${dims.h}" xmlns="${XPS_NS}">
      <Canvas>
${glyphs.join("\n")}
${pageGlyph}
      </Canvas>
    </FixedPage>`;
}

/** Build the full FixedDocument XML from a list of page-line-arrays. */
export function buildFixedDocument(pages: string[][], opts: ConvertOptions): string {
  const includePageNumbers = opts.includePageNumbers ?? true;
  const pageXml = pages.map((lines, i) => buildFixedPage(lines, opts, i + 1, includePageNumbers)).join("\n");
  const title = xmlEscape(opts.title ?? "Untitled");
  const author = xmlEscape(opts.author ?? "Unknown");
  const subject = xmlEscape(opts.subject ?? "");
  const keywords = xmlEscape(opts.keywords ?? "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<FixedDocument xmlns="${XPS_NS}">
  <Pages>
${pageXml}
  </Pages>
  <DocumentProperties>
    <Title>${title}</Title>
    <Author>${author}</Author>
    <Subject>${subject}</Subject>
    <Keywords>${keywords}</Keywords>
  </DocumentProperties>
</FixedDocument>`;
}

/** Split text into pages (line arrays) by lines-per-page. */
export function paginateByLines(text: string, opts: ConvertOptions): string[][] {
  const size = opts.pageSize ?? "a4";
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  const dims = pageDimensions(size);
  const usableH = Math.max(0, dims.h - 2 * margin);
  const linesPerPage = Math.max(2, Math.floor(usableH / (fontSize * 1.4)));
  const allLines = text.split("\n");
  const pages: string[][] = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pages.push(allLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);
  return pages;
}

/** Quick XML well-formedness check (basic — looks for balanced root element). */
export function isWellFormedXml(xml: string): boolean {
  if (!xml.startsWith("<?xml")) return false;
  // Opening tags: <tag ...> (including self-closing like <tag/>)
  const allOpen = (xml.match(/<[A-Za-z][^>]*>/g) ?? []).length;
  // Self-closing tags: <tag .../>
  const selfClosing = (xml.match(/<[A-Za-z][^>]*\/>/g) ?? []).length;
  // Closing tags: </tag>
  const closeTags = (xml.match(/<\/[A-Za-z][^>]*>/g) ?? []).length;
  // Opening (excluding self-closing) should equal closing
  return allOpen - selfClosing === closeTags;
}

export function validateOptions(opts: ConvertOptions): { ok: true } | { error: string } {
  const margin = opts.margin ?? 50;
  const fontSize = opts.fontSize ?? 12;
  if (margin < 0 || margin > 300) return { error: "Margin must be 0–300 pt" };
  if (fontSize < 6 || fontSize > 72) return { error: "Font size must be 6–72 pt" };
  if (opts.pageSize && !["a4", "letter", "legal"].includes(opts.pageSize)) return { error: "Invalid page size" };
  return { ok: true };
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

export function formatMetadata(opts: ConvertOptions): string {
  return [
    `Title: ${opts.title ?? "Untitled"}`,
    `Author: ${opts.author ?? "Unknown"}`,
    `Subject: ${opts.subject ?? ""}`,
    `Keywords: ${opts.keywords ?? ""}`,
    `Page size: ${opts.pageSize ?? "a4"}`,
    `Font size: ${opts.fontSize ?? 12}pt`,
    `Margin: ${opts.margin ?? 50}pt`,
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
