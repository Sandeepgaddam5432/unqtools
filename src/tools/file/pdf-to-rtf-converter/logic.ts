/**
 * PDF to RTF Converter — extracts PDF text and generates an RTF document.
 *
 * RTF (Rich Text Format) is a plain-text format with control words. Key
 * control words used here:
 *   \rtf1        — RTF version 1
 *   \ansi        — character set (ANSI)
 *   \deffN       — default font index N
 *   \fonttbl     — font table
 *   {\fN ...}    — font definition
 *   \fsN         — font size in half-points (so \fs24 = 12pt)
 *   \marglN      — left margin in twips (1440 twips = 1 inch)
 *   \margrN      — right margin
 *   \margtN      — top margin
 *   \margbN      — bottom margin
 *   \par         — paragraph end
 *   \page        — page break
 *   \plain       — reset character formatting
 *   \\, \{, \}   — escaped backslash, brace
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type RtfFont = "Arial" | "Times New Roman" | "Courier New" | "Calibri";

export interface RtfOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Font family. */
  fontFamily: RtfFont;
  /** Font size in half-points (24 = 12pt). */
  fontSize: number;
  /** Page margins in twips (1 inch = 1440 twips). */
  margin: number;
  /** Document title (for metadata). */
  title: string;
}

export const DEFAULT_OPTIONS: RtfOptions = {
  pageRange: "",
  fontFamily: "Arial",
  fontSize: 24, // 12pt
  margin: 1440, // 1 inch
  title: "Converted from PDF",
};

export interface RtfResult {
  rtf: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  rtfBytes: number;
}

// ===== RTF generation =====

/** Escape special RTF characters in text. */
export function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    // Encode non-ASCII characters as \uN? (RTF Unicode escape)
    .replace(/[^\x00-\x7F]/g, (ch) => `\\u${ch.charCodeAt(0)}?`);
}

/** Map font family to its RTF font table entry. */
function fontTableEntry(font: RtfFont): string {
  const families: Record<RtfFont, string> = {
    "Arial": "{\\f0\\fswiss Arial;}",
    "Times New Roman": "{\\f1\\froman Times New Roman;}",
    "Courier New": "{\\f2\\fmodern Courier New;}",
    "Calibri": "{\\f3\\fswiss Calibri;}",
  };
  return families[font];
}

/** Map font family to its default font index. */
function fontIndex(font: RtfFont): number {
  const indices: Record<RtfFont, number> = {
    "Arial": 0,
    "Times New Roman": 1,
    "Courier New": 2,
    "Calibri": 3,
  };
  return indices[font];
}

/** Generate the RTF header (font table, color table, margins). */
function generateRtfHeader(opts: RtfOptions): string {
  const fontTbl = fontTableEntry(opts.fontFamily);
  // Include all 4 fonts in the font table for compatibility.
  const allFonts = [
    "{\\f0\\fswiss Arial;}",
    "{\\f1\\froman Times New Roman;}",
    "{\\f2\\fmodern Courier New;}",
    "{\\f3\\fswiss Calibri;}",
  ].join("");
  void fontTbl;
  const margin = Math.max(720, Math.min(4320, opts.margin));
  return `{\\rtf1\\ansi\\ansicpg1252\\deff${fontIndex(opts.fontFamily)}{\\fonttbl${allFonts}}{\\colortbl ;\\red0\\green0\\blue0;}\\margl${margin}\\margr${margin}\\margt${margin}\\margb${margin}`;
}

/** Generate RTF body for a single page's text. */
function generateRtfBody(text: string, opts: RtfOptions, isLastPage: boolean): string {
  const fs = Math.max(16, Math.min(72, opts.fontSize));
  const lines = text.split("\n");
  const parts: string[] = [];
  for (const line of lines) {
    const escaped = escapeRtf(line);
    // Each line is a paragraph: \plain resets formatting, \fsN sets size, \fN sets font.
    parts.push(`\\plain\\f${fontIndex(opts.fontFamily)}\\fs${fs} ${escaped}\\par`);
  }
  // Page break between pages (but not after the last page).
  if (!isLastPage) {
    parts.push("\\page");
  }
  return parts.join("\n");
}

/** Generate a complete RTF document from a list of page texts. */
export function generateRtf(pageTexts: string[], opts: RtfOptions): string {
  const header = generateRtfHeader(opts);
  const bodyParts: string[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    bodyParts.push(generateRtfBody(pageTexts[i]!, opts, i === pageTexts.length - 1));
  }
  const infoGroup = `{\\info{\\title ${escapeRtf(opts.title)}}{\\author UnQTools}}`;
  return `${header}${infoGroup}\n${bodyParts.join("\n")}\n}`;
}

// ===== Top-level conversion =====

export async function convertPdfToRtf(
  pdfBytes: Uint8Array,
  opts: RtfOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.rtf",
): Promise<ToolResult<RtfResult>> {
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
  const pageTexts = textResult.output.pages.map((p) => p.text);
  const rtf = generateRtf(pageTexts, opts);
  let paragraphCount = 0;
  for (const t of pageTexts) {
    paragraphCount += t.split("\n").filter((l) => l.trim() !== "").length;
  }
  const rtfBytes = new TextEncoder().encode(rtf).length;
  return {
    ok: true,
    output: {
      rtf,
      fileName: outputFileName,
      pageCount: textResult.output.pageCount,
      wordCount: textResult.output.totalWordCount,
      charCount: textResult.output.totalCharCount,
      paragraphCount,
      rtfBytes,
    },
  };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-rtf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  rtfBytes: number;
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

export function buildShareUrl(opts: RtfOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("font", opts.fontFamily);
  params.set("fs", String(opts.fontSize));
  params.set("margin", String(opts.margin));
  if (opts.title && opts.title !== "Converted from PDF") params.set("title", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<RtfOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("font")) return null;
  const font = (params.get("font") ?? "Arial") as RtfFont;
  const validFonts: RtfFont[] = ["Arial", "Times New Roman", "Courier New", "Calibri"];
  const fs = parseInt(params.get("fs") ?? "24", 10);
  const margin = parseInt(params.get("margin") ?? "1440", 10);
  return {
    pageRange: params.get("pages") ?? "",
    fontFamily: validFonts.includes(font) ? font : "Arial",
    fontSize: isNaN(fs) ? 24 : Math.max(16, Math.min(72, fs)),
    margin: isNaN(margin) ? 1440 : Math.max(720, Math.min(4320, margin)),
    title: params.get("title") ?? "",
  };
}
