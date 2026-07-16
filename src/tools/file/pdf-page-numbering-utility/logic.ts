/**
 * PDF Page Numbering Utility — pure-JS PDF page-numbering tool.
 *
 * Uses pdf-lib to draw page numbers on existing PDFs.
 *
 * Features:
 *   - 9 positions: top/bottom × left/center/right (+ middle for completeness)
 *   - 6 formats: arabic, roman-lower, roman-upper, alpha-lower, alpha-upper,
 *     custom (with {page} and {total} placeholders)
 *   - Custom start number (e.g. start at 5)
 *   - Skip first N pages (no number printed on those)
 *   - Adjustable font size (6-72pt)
 *   - Custom hex color
 *   - Adjustable margin
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type NumberFormat =
  | "arabic"
  | "roman-lower"
  | "roman-upper"
  | "alpha-lower"
  | "alpha-upper"
  | "custom";

export type NumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberOptions {
  position: NumberPosition;
  format: NumberFormat;
  /** Custom format string when format='custom' (e.g. "Page {page} of {total}"). */
  customFormat: string;
  /** Start the numbering at this number (default 1). */
  startNumber: number;
  /** Number of leading pages to skip (default 0). */
  skipPages: number;
  /** Font size in points (default 12). */
  fontSize: number;
  /** Hex color (default "#000000"). */
  color: string;
  /** Margin from edge in points (default 24). */
  margin: number;
}

export const DEFAULT_OPTIONS: PageNumberOptions = {
  position: "bottom-center",
  format: "arabic",
  customFormat: "{page}/{total}",
  startNumber: 1,
  skipPages: 0,
  fontSize: 12,
  color: "#000000",
  margin: 24,
};

export interface PageNumberResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  numberedCount: number;
  skippedCount: number;
  pdfBytes: number;
}

// ===== Roman numerals =====

const ROMAN_DIGITS: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"],
  [1, "I"],
];

/** Convert a positive integer to uppercase Roman numerals (1-3999). */
export function toRomanUpper(num: number): string {
  if (num <= 0 || num >= 4000) return String(num);
  let n = Math.floor(num);
  let out = "";
  for (const [value, symbol] of ROMAN_DIGITS) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

/** Convert a positive integer to lowercase Roman numerals (1-3999). */
export function toRomanLower(num: number): string {
  return toRomanUpper(num).toLowerCase();
}

// ===== Alpha numerals (a, b, c, ..., z, aa, ab, ac, ...) =====

/** Convert a positive integer (1-based) to lowercase alpha (a, b, ..., z, aa, ab, ...). */
export function toAlphaLower(num: number): string {
  if (num <= 0) return String(num);
  let n = Math.floor(num);
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Convert a positive integer (1-based) to uppercase alpha (A, B, ..., Z, AA, AB, ...). */
export function toAlphaUpper(num: number): string {
  return toAlphaLower(num).toUpperCase();
}

// ===== Format label =====

/** Format a page number label using the chosen format. */
export function formatLabel(
  format: NumberFormat,
  pageNum: number,
  total: number,
  customFormat: string = "{page}/{total}",
): string {
  switch (format) {
    case "arabic":
      return String(pageNum);
    case "roman-lower":
      return toRomanLower(pageNum);
    case "roman-upper":
      return toRomanUpper(pageNum);
    case "alpha-lower":
      return toAlphaLower(pageNum);
    case "alpha-upper":
      return toAlphaUpper(pageNum);
    case "custom":
      return customFormat
        .replace(/\{page\}/g, String(pageNum))
        .replace(/\{total\}/g, String(total));
    default:
      return String(pageNum);
  }
}

// ===== Position calculation =====

export interface PositionCoords {
  x: number;
  y: number;
}

/**
 * Compute the (x, y) coordinates for drawing a page number given the page
 * dimensions, text width, position name, and margin.
 */
export function computePosition(
  position: NumberPosition,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  margin: number,
): PositionCoords {
  const [vertical, horizontal] = position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];
  let y: number;
  if (vertical === "top") {
    y = pageHeight - margin - fontSize;
  } else if (vertical === "bottom") {
    y = margin;
  } else {
    // middle
    y = (pageHeight - fontSize) / 2;
  }
  let x: number;
  if (horizontal === "left") {
    x = margin;
  } else if (horizontal === "right") {
    x = pageWidth - margin - textWidth;
  } else {
    // center
    x = (pageWidth - textWidth) / 2;
  }
  return { x, y };
}

// ===== Hex color parsing =====

/** Parse a hex color string (#RGB or #RRGGBB) into pdf-lib's rgb() tuple. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, "").trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (cleaned.length === 3 && /^[0-9a-fA-F]{3}$/.test(cleaned)) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
  } else if (cleaned.length === 6 && /^[0-9a-fA-F]{6}$/.test(cleaned)) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  }
  return { r: r / 255, g: g / 255, b: b / 255 };
}

/** Validate a hex color string. */
export function isValidHexColor(hex: string): boolean {
  const cleaned = hex.replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{3}$/.test(cleaned) || /^[0-9a-fA-F]{6}$/.test(cleaned);
}

// ===== Top-level numbering =====

/** Add page numbers to a PDF. Returns the new PDF as bytes + stats. */
export async function addPageNumbers(
  pdfBytes: Uint8Array,
  opts: PageNumberOptions = DEFAULT_OPTIONS,
  outputFileName: string = "numbered.pdf",
): Promise<ToolResult<PageNumberResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes);
  } catch {
    return {
      ok: false,
      error: "Could not read the PDF — it may be corrupted or password-protected.",
    };
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = Math.max(6, Math.min(opts.fontSize, 72));
  const margin = Math.max(0, opts.margin);
  const color = parseHexColor(opts.color);
  const pages = doc.getPages();
  const total = pages.length;
  const skipCount = Math.max(0, Math.min(opts.skipPages, total));
  const numberedTotal = total - skipCount;

  let displayNum = Math.max(1, Math.floor(opts.startNumber));
  let numberedCount = 0;
  for (let i = 0; i < total; i++) {
    if (i < skipCount) continue;
    const page = pages[i]!;
    const { width, height } = page.getSize();
    const label = formatLabel(opts.format, displayNum, numberedTotal, opts.customFormat);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = computePosition(opts.position, width, height, textWidth, fontSize, margin);
    try {
      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
    } catch {
      // Drawing can fail if the page has unusual content streams; skip gracefully
    }
    displayNum++;
    numberedCount++;
  }
  doc.setProducer("UnQTools — PDF Page Numbering Utility");
  doc.setCreator("UnQTools — PDF Page Numbering Utility");
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      pageCount: total,
      numberedCount,
      skippedCount: skipCount,
      pdfBytes: bytes.length,
    },
  };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-pdf-page-numbering-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pageCount: number;
  numberedCount: number;
  format: string;
  position: string;
  pdfBytes: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

// ===== Shareable URL =====

export function buildShareUrl(opts: PageNumberOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("pos", opts.position);
  params.set("fmt", opts.format);
  if (opts.format === "custom") params.set("custom", opts.customFormat);
  params.set("start", String(opts.startNumber));
  params.set("skip", String(opts.skipPages));
  params.set("fs", String(opts.fontSize));
  params.set("color", opts.color);
  params.set("margin", String(opts.margin));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PageNumberOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pos") && !params.has("fmt")) return null;
  const pos = (params.get("pos") ?? "bottom-center") as NumberPosition;
  const fmt = (params.get("fmt") ?? "arabic") as NumberFormat;
  const validPositions: NumberPosition[] = [
    "top-left", "top-center", "top-right",
    "middle-left", "middle-center", "middle-right",
    "bottom-left", "bottom-center", "bottom-right",
  ];
  const validFormats: NumberFormat[] = [
    "arabic", "roman-lower", "roman-upper",
    "alpha-lower", "alpha-upper", "custom",
  ];
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const start = parseInt(params.get("start") ?? "1", 10);
  const skip = parseInt(params.get("skip") ?? "0", 10);
  const margin = parseInt(params.get("margin") ?? "24", 10);
  return {
    position: validPositions.includes(pos) ? pos : "bottom-center",
    format: validFormats.includes(fmt) ? fmt : "arabic",
    customFormat: params.get("custom") ?? "{page}/{total}",
    startNumber: isNaN(start) ? 1 : Math.max(1, start),
    skipPages: isNaN(skip) ? 0 : Math.max(0, skip),
    fontSize: isNaN(fs) ? 12 : Math.max(6, Math.min(72, fs)),
    color: params.get("color") ?? "#000000",
    margin: isNaN(margin) ? 24 : Math.max(0, margin),
  };
}
