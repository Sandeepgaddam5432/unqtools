/**
 * PDF Page Numbers — advanced.
 *
 * Number formats (plain, "Page x", "Page x of n", "- x -", zero-padded,
 * Roman), start page / start number, skip cover pages, apply-to-range,
 * 6 positions, font size + color + bold, prefix/suffix. Pure pdf-lib.
 */
import { PDFDocument, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type NumberPosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export type NumberFormat = "x" | "page-x" | "page-x-of-n" | "x-of-n" | "dash-x-dash" | "padded" | "roman";

export interface PageNumberOptions {
  position: NumberPosition;
  format: NumberFormat;
  /** Number printed on the first numbered page. */
  startAt: number;
  /** Physical page where numbering begins (1-indexed). Pages before it get nothing. */
  startPage: number;
  fontSize: number;
  color?: string; // hex like "#333333"
  bold?: boolean;
  prefix?: string;
  suffix?: string;
  /** 1-indexed physical pages to skip (e.g. cover pages inside the range). */
  skipPages?: string;
  /** Only number these pages (1-indexed). Empty = all after startPage. */
  applyPages?: string;
}

export interface PageNumberPreview {
  total: number;
  numbered: number;
  firstLabel: string;
  lastLabel: string;
}

/** Pure label formatter (unit-testable). */
export function formatNumber(format: NumberFormat, current: number, total: number): string {
  switch (format) {
    case "x":
      return `${current}`;
    case "page-x":
      return `Page ${current}`;
    case "page-x-of-n":
      return `Page ${current} of ${total}`;
    case "x-of-n":
      return `${current} / ${total}`;
    case "dash-x-dash":
      return `- ${current} -`;
    case "padded":
      return String(current).padStart(Math.max(2, String(total).length), "0");
    case "roman":
      return toRoman(current);
    default:
      return `${current}`;
  }
}

export function toRoman(n: number): string {
  if (n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let v = Math.floor(n);
  let out = "";
  for (const [num, sym] of table) {
    while (v >= num) {
      out += sym;
      v -= num;
    }
  }
  return out;
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Preview labels without touching the document. */
export function previewNumbers(
  total: number,
  options: PageNumberOptions
): PageNumberPreview {
  const numbered = countNumberedPages(total, options);
  const first = pageNumberValues(total, options);
  const last = first.length > 0 ? first[first.length - 1]! : 0;
  const firstLabel = formatNumber(options.format, first.length > 0 ? first[0]! : 0, numbered);
  const lastLabel = formatNumber(options.format, last, numbered);
  return { total, numbered, firstLabel, lastLabel };
}

function countNumberedPages(total: number, options: PageNumberOptions): number {
  return pageNumberValues(total, options).length;
}

function pageNumberValues(total: number, options: PageNumberOptions): number[] {
  const startPage = Math.max(1, Math.floor(options.startPage ?? 1));
  const startAt = Math.max(1, Math.floor(options.startAt ?? 1));
  let skipSet = new Set<number>();
  const skipSpec = (options.skipPages ?? "").trim();
  if (skipSpec) {
    const parsed = parsePageRanges(skipSpec, total);
    if (parsed.ok) skipSet = new Set(parsed.output);
  }
  let applySet: Set<number> | null = null;
  const applySpec = (options.applyPages ?? "").trim();
  if (applySpec) {
    const parsed = parsePageRanges(applySpec, total);
    if (parsed.ok) applySet = new Set(parsed.output);
  }
  const values: number[] = [];
  let n = startAt;
  for (let i = startPage - 1; i < total; i++) {
    if (skipSet.has(i)) continue;
    if (applySet && !applySet.has(i)) continue;
    values.push(n);
    n++;
  }
  return values;
}

export async function addPageNumbers(
  bytes: Uint8Array,
  options: PageNumberOptions
): Promise<ToolResult<Uint8Array>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  const startPage = Math.max(1, Math.floor(options.startPage ?? 1));
  if (startPage > total) {
    return { ok: false, error: `Start page ${startPage} is beyond the document's ${total} page${total === 1 ? "" : "s"}.` };
  }
  const startAt = Math.max(1, Math.floor(options.startAt ?? 1));
  const fs = Math.max(6, Math.min(Number(options.fontSize) || 12, 72));
  const margin = 24;

  let skipSet = new Set<number>();
  const skipSpec = (options.skipPages ?? "").trim();
  if (skipSpec) {
    const parsed = parsePageRanges(skipSpec, total);
    if (!parsed.ok) return parsed;
    skipSet = new Set(parsed.output);
  }
  let applySet: Set<number> | null = null;
  const applySpec = (options.applyPages ?? "").trim();
  if (applySpec) {
    const parsed = parsePageRanges(applySpec, total);
    if (!parsed.ok) return parsed;
    applySet = new Set(parsed.output);
  }

  const font: PDFFont = options.bold
    ? await src.embedFont(StandardFonts.HelveticaBold)
    : await src.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color ?? "#000000");
  const prefix = options.prefix ?? "";
  const suffix = options.suffix ?? "";

  const pages = src.getPages();
  let n = startAt;
  const numberedTotal = countNumberedPages(total, options);
  for (let i = startPage - 1; i < total; i++) {
    if (skipSet.has(i)) continue;
    if (applySet && !applySet.has(i)) continue;
    const page = pages[i]!;
    const { width, height } = page.getSize();
    const core = formatNumber(options.format, n, numberedTotal);
    const label = `${prefix}${core}${suffix}`;
    const textW = font.widthOfTextAtSize(label, fs);
    const top = options.position.startsWith("top");
    const y = top ? height - margin - fs : margin;
    const part = options.position.split("-")[1] as "left" | "center" | "right";
    const x = part === "left" ? margin : part === "right" ? width - margin - textW : (width - textW) / 2;
    page.drawText(label, { x, y, size: fs, font, color, opacity: 0.8 });
    n++;
  }
  return { ok: true, output: await src.save() };
}
