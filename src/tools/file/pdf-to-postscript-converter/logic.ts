/**
 * PDF to PostScript Converter — pure-JS PS generator.
 *
 * PostScript is a plain-text page description language. We generate:
 *   %!PS-Adobe-3.0
 *   %%Creator: ...
 *   %%Title: ...
 *   %%Pages: N
 *   %%Page: 1 1
 *   <page setup>
 *   <text commands>
 *   showpage
 *   %%Page: 2 2
 *   ...
 *   %%EOF
 *
 * Each PDF page becomes one PS page. Text is rendered with the 'show'
 * operator after /findfont, /scalefont, /setfont.
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type PsFont = "Helvetica" | "Times-Roman" | "Courier";
export type PsPageSize = "a4" | "letter" | "legal";

export interface PsOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Font family. */
  font: PsFont;
  /** Font size in points. */
  fontSize: number;
  /** Page size. */
  pageSize: PsPageSize;
  /** Margins in points (1 inch = 72 points). */
  margin: number;
  /** Line wrap width in characters (0 = no wrap). */
  wrapWidth: number;
  /** Line height multiplier (1.0 = single, 1.5 = 1.5x). */
  lineHeight: number;
  /** Document title. */
  title: string;
}

export const DEFAULT_OPTIONS: PsOptions = {
  pageRange: "",
  font: "Helvetica",
  fontSize: 12,
  pageSize: "letter",
  margin: 72,
  wrapWidth: 80,
  lineHeight: 1.4,
  title: "Converted from PDF",
};

export interface PsResult {
  /** PostScript source code. */
  source: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
  lineCount: number;
  psBytes: number;
}

// ===== Page size helpers =====

/** Get page dimensions in points. */
export function getPageSizePoints(size: PsPageSize): { width: number; height: number } {
  if (size === "a4") return { width: 595.276, height: 841.89 };
  if (size === "legal") return { width: 612, height: 1008 };
  return { width: 612, height: 792 }; // Letter
}

/** Clamp a value to a range. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ===== PostScript text escaping =====

/** Escape special PostScript string chars (parens, backslashes). */
export function escapePsString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// ===== Word wrap =====

/** Wrap a line to a max character count. Returns an array of lines. */
export function wrapLine(line: string, maxChars: number): string[] {
  if (maxChars <= 0 || line.length <= maxChars) return [line];
  const out: string[] = [];
  let current = "";
  for (const word of line.split(/\s+/)) {
    if (word === "") continue;
    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current !== "") out.push(current);
  return out.length > 0 ? out : [""];
}

// ===== PostScript generation =====

/** Generate the PS header (%%BeginSetup). */
export function generateHeader(opts: PsOptions, pageCount: number): string {
  const now = new Date().toISOString();
  return `%!PS-Adobe-3.0
%%Creator: UnQTools PDF to PostScript Converter
%%Title: ${escapePsString(opts.title)}
%%CreationDate: ${now}
%%Pages: ${pageCount}
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%EndComments
%%BeginSetup
%%EndSetup
%%BeginProlog
%%EndProlog
`;
}

/** Generate the PS footer (%%EOF). */
export function generateFooter(): string {
  return `%%EOF
`;
}

/** Generate one PS page. */
export function generatePage(pageNumber: number, lines: string[], opts: PsOptions): string {
  const dims = getPageSizePoints(opts.pageSize);
  const margin = clamp(opts.margin, 18, 144);
  const fs = clamp(opts.fontSize, 6, 36);
  const leading = Math.round(fs * clamp(opts.lineHeight, 1.0, 3.0));
  const top = dims.height - margin;
  const left = margin;
  const out: string[] = [];
  out.push(`%%Page: ${pageNumber} ${pageNumber}`);
  out.push(`%%BeginPageSetup`);
  out.push(`/pgsave save def`);
  out.push(`%%EndPageSetup`);
  // Font setup
  out.push(`/${opts.font} findfont ${fs} scalefont setfont`);
  // Position at top-left
  let y = top;
  out.push(`${left} ${y} moveto`);
  // Render each line
  const wrap = clamp(opts.wrapWidth, 0, 200);
  for (const line of lines) {
    const wrapped = wrapLine(line, wrap);
    for (const w of wrapped) {
      if (y < margin) break; // page overflow guard
      out.push(`${left} ${y} moveto`);
      out.push(`(${escapePsString(w)}) show`);
      y -= leading;
    }
  }
  out.push(`showpage`);
  out.push(`pgsave restore`);
  return out.join("\n") + "\n";
}

/** Generate the full PostScript document. */
export function generatePostScript(pages: string[][], opts: PsOptions): string {
  const header = generateHeader(opts, pages.length);
  const footer = generateFooter();
  const pageBlocks = pages.map((lines, i) => generatePage(i + 1, lines, opts)).join("\n");
  return header + "\n" + pageBlocks + "\n" + footer;
}

// ===== Top-level conversion =====

export async function convertPdfToPostScript(
  pdfBytes: Uint8Array,
  opts: PsOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.ps",
): Promise<ToolResult<PsResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const pages = textResult.output.pages.map((p) => p.text.split("\n"));
  if (pages.every((p) => p.length === 0)) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const source = generatePostScript(pages, opts);
  const psBytes = new TextEncoder().encode(source).length;
  return {
    ok: true,
    output: {
      source,
      fileName: outputFileName,
      pageCount: textResult.output.pageCount,
      wordCount: textResult.output.totalWordCount,
      charCount: textResult.output.totalCharCount,
      lineCount: textResult.output.totalLineCount,
      psBytes,
    },
  };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-ps-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  psBytes: number;
  pageCount: number;
  wordCount: number;
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

export function buildShareUrl(opts: PsOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("font", opts.font);
  params.set("fs", String(opts.fontSize));
  params.set("page", opts.pageSize);
  params.set("margin", String(opts.margin));
  params.set("wrap", String(opts.wrapWidth));
  params.set("lh", String(opts.lineHeight));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PsOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("font") && !params.has("pages")) return null;
  const font = (params.get("font") ?? "Helvetica") as PsFont;
  const validFonts: PsFont[] = ["Helvetica", "Times-Roman", "Courier"];
  const page = (params.get("page") ?? "letter") as PsPageSize;
  const validPages: PsPageSize[] = ["a4", "letter", "legal"];
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const margin = parseInt(params.get("margin") ?? "72", 10);
  const wrap = parseInt(params.get("wrap") ?? "80", 10);
  const lh = parseFloat(params.get("lh") ?? "1.4");
  return {
    pageRange: params.get("pages") ?? "",
    font: validFonts.includes(font) ? font : "Helvetica",
    fontSize: isNaN(fs) ? 12 : Math.max(6, Math.min(36, fs)),
    pageSize: validPages.includes(page) ? page : "letter",
    margin: isNaN(margin) ? 72 : Math.max(18, Math.min(144, margin)),
    wrapWidth: isNaN(wrap) ? 80 : Math.max(0, Math.min(200, wrap)),
    lineHeight: isNaN(lh) ? 1.4 : Math.max(1.0, Math.min(3.0, lh)),
  };
}
