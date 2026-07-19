/**
 * PDF Bleed Adder — pure logic.
 *
 * Computes the geometry for adding a bleed margin to a PDF page so the
 * resulting page is ready for professional print finishing. All functions
 * are pure: given an original page size and a bleed configuration they
 * return new sizes, content offsets, crop marks, and bleed marks without
 * touching pdf-lib or the DOM.
 *
 * Conversion factors:
 *   1 mm   = 2.83465 pt
 *   1 inch = 72 pt
 */
import type { ToolResult } from "../../../lib/tool";

// ---- Constants ----------------------------------------------------------

/** 1 millimetre expressed in PostScript/PDF points. */
export const MM_TO_POINTS = 2.83465;
/** 1 inch in points. */
export const INCH_TO_POINTS = 72;

/** All supported bleed-side configurations. */
export type BleedSides =
  | "all-sides"
  | "top-bottom"
  | "left-right"
  | "top-only"
  | "bottom-only"
  | "left-only"
  | "right-only";

export const BLEED_SIDES_LIST: BleedSides[] = [
  "all-sides",
  "top-bottom",
  "left-right",
  "top-only",
  "bottom-only",
  "left-only",
  "right-only",
];

export const BLEED_SIDES_LABELS: Record<BleedSides, string> = {
  "all-sides": "All four sides",
  "top-bottom": "Top + Bottom only",
  "left-right": "Left + Right only",
  "top-only": "Top only",
  "bottom-only": "Bottom only",
  "left-only": "Left only",
  "right-only": "Right only",
};

/** Per-side bleed amounts (all values in points). */
export interface BleedAmounts {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Standard bleed presets expressed as a human label + raw input. */
export interface BleedPreset {
  id: string;
  label: string;
  /** Original size in the unit given. */
  value: number;
  unit: "mm" | "inch";
}

export const BLEED_PRESETS: BleedPreset[] = [
  { id: "3mm", label: '3 mm (standard print)', value: 3, unit: "mm" },
  { id: "5mm", label: '5 mm (large-format / safe)', value: 5, unit: "mm" },
  { id: "0.125in", label: '0.125" (US standard)', value: 0.125, unit: "inch" },
];

/** Common print-ready standards for verification. */
export type PrintStandard = "iso-3mm" | "iso-5mm" | "us-0.125in";

export const PRINT_STANDARDS: Record<PrintStandard, { minBleedPt: number; label: string }> = {
  "iso-3mm": { minBleedPt: 3 * MM_TO_POINTS, label: "ISO 3 mm bleed" },
  "iso-5mm": { minBleedPt: 5 * MM_TO_POINTS, label: "ISO 5 mm bleed" },
  "us-0.125in": { minBleedPt: 0.125 * INCH_TO_POINTS, label: 'US 0.125" bleed' },
};

// ---- Geometry types -----------------------------------------------------

export interface PageSize {
  width: number;
  height: number;
}

/** A single straight line in PDF user-space coordinates (origin bottom-left). */
export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MarkSpec {
  /** Marks for the four trim corners — 2 lines per corner (horizontal + vertical). */
  lines: Line[];
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

// ---- Conversions --------------------------------------------------------

/** Convert millimetres → points. */
export function mmToPoints(mm: number): number {
  return mm * MM_TO_POINTS;
}

/** Convert inches → points. */
export function inchesToPoints(inches: number): number {
  return inches * INCH_TO_POINTS;
}

/** Resolve a unit-tagged value to points. */
export function toPoints(value: number, unit: "mm" | "inch" | "pt"): number {
  if (unit === "mm") return mmToPoints(value);
  if (unit === "inch") return inchesToPoints(value);
  return value;
}

// ---- Bleed applicator ---------------------------------------------------

/** Build a per-side bleed-amounts object from a single size and a side selection. */
export function applyBleedSides(bleedSizePt: number, sides: BleedSides): BleedAmounts {
  const z = 0;
  const v = bleedSizePt;
  switch (sides) {
    case "all-sides":    return { top: v, bottom: v, left: v, right: v };
    case "top-bottom":   return { top: v, bottom: v, left: z, right: z };
    case "left-right":   return { top: z, bottom: z, left: v, right: v };
    case "top-only":     return { top: v, bottom: z, left: z, right: z };
    case "bottom-only":  return { top: z, bottom: v, left: z, right: z };
    case "left-only":    return { top: z, bottom: z, left: v, right: z };
    case "right-only":   return { top: z, bottom: z, left: z, right: v };
  }
}

/** True if any side has a non-zero bleed. */
export function hasAnyBleed(a: BleedAmounts): boolean {
  return a.top > 0 || a.bottom > 0 || a.left > 0 || a.right > 0;
}

// ---- New page size + offset --------------------------------------------

/** Compute the new (enlarged) page size given an original and bleed amounts. */
export function calculateNewSize(orig: PageSize, bleed: BleedAmounts): PageSize {
  return {
    width: orig.width + bleed.left + bleed.right,
    height: orig.height + bleed.top + bleed.bottom,
  };
}

/**
 * Compute the (x, y) offset at which the original page content should be
 * placed inside the enlarged page. PDF user-space origin is bottom-left, so
 * `x = bleed.left` and `y = bleed.bottom`.
 */
export function calculateContentOffset(bleed: BleedAmounts): { x: number; y: number } {
  return { x: bleed.left, y: bleed.bottom };
}

/** Validate that the enlarged page would still have positive dimensions. */
export function validatePageExtension(
  orig: PageSize,
  bleed: BleedAmounts,
): ToolResult<true> {
  if (orig.width <= 0 || orig.height <= 0) {
    return { ok: false, error: "Original page size must be greater than zero." };
  }
  if ([bleed.top, bleed.bottom, bleed.left, bleed.right].some((v) => v < 0)) {
    return { ok: false, error: "Bleed amounts cannot be negative." };
  }
  const next = calculateNewSize(orig, bleed);
  if (next.width <= 0 || next.height <= 0) {
    return { ok: false, error: "Bleed would produce a zero-size page." };
  }
  return { ok: true, output: true };
}

// ---- Crop + bleed marks -------------------------------------------------

/**
 * Generate crop (trim) marks at the four trim-box corners. Each corner gets
 * two short perpendicular lines offset OUTSIDE the trim box by `offsetPt`.
 *
 * The trim box is the rectangle (0, 0, trimW, trimH) in the *new* page's
 * coordinate space, but offset by (bleed.left, bleed.bottom) because the
 * original content sits there. So the trim box's bottom-left corner sits at
 * (bleed.left, bleed.bottom) and its top-right corner at
 * (bleed.left + trimW, bleed.bottom + trimH).
 *
 * @param trimW       original page width (pt)
 * @param trimH       original page height (pt)
 * @param bleed       per-side bleed amounts (pt) — used to locate the trim box
 * @param offsetPt    gap between trim corner and the start of the mark (pt)
 * @param markLength  length of each crop-mark line (pt)
 */
export function generateCropMarks(
  trimW: number,
  trimH: number,
  bleed: BleedAmounts,
  offsetPt: number,
  markLength: number,
): Line[] {
  const lines: Line[] = [];
  const ox = bleed.left;
  const oy = bleed.bottom;
  const x0 = ox;             // left trim edge
  const x1 = ox + trimW;     // right trim edge
  const y0 = oy;             // bottom trim edge
  const y1 = oy + trimH;     // top trim edge

  // Bottom-left corner — horizontal line below + vertical line left of trim
  lines.push({ x1: x0, y1: y0 - offsetPt, x2: x0, y2: y0 - offsetPt - markLength });
  lines.push({ x1: x0 - offsetPt, y1: y0, x2: x0 - offsetPt - markLength, y2: y0 });
  // Bottom-right corner
  lines.push({ x1: x1, y1: y0 - offsetPt, x2: x1, y2: y0 - offsetPt - markLength });
  lines.push({ x1: x1 + offsetPt, y1: y0, x2: x1 + offsetPt + markLength, y2: y0 });
  // Top-left corner
  lines.push({ x1: x0, y1: y1 + offsetPt, x2: x0, y2: y1 + offsetPt + markLength });
  lines.push({ x1: x0 - offsetPt, y1: y1, x2: x0 - offsetPt - markLength, y2: y1 });
  // Top-right corner
  lines.push({ x1: x1, y1: y1 + offsetPt, x2: x1, y2: y1 + offsetPt + markLength });
  lines.push({ x1: x1 + offsetPt, y1: y1, x2: x1 + offsetPt + markLength, y2: y1 });
  return lines;
}

/**
 * Generate bleed marks — short marks placed exactly at the bleed edge (the
 * outer perimeter of the new page). Useful for verifying the bleed margin
 * was added correctly when proofing.
 */
export function generateBleedMarks(
  newPage: PageSize,
  markLength: number,
): Line[] {
  const { width: w, height: h } = newPage;
  const m = Math.min(markLength, w / 4, h / 4); // clamp to avoid overlap
  return [
    // Midpoints of each edge, drawn inward
    { x1: w / 2, y1: h, x2: w / 2, y2: h - m }, // top centre, downward
    { x1: w / 2, y1: 0, x2: w / 2, y2: m },     // bottom centre, upward
    { x1: 0, y1: h / 2, x2: m, y2: h / 2 },     // left centre, rightward
    { x1: w, y1: h / 2, x2: w - m, y2: h / 2 }, // right centre, leftward
  ];
}

// ---- Trim box + bleed area percentage ----------------------------------

/** Calculate the trim-box rectangle (where to trim after printing). */
export function calculateTrimBox(
  newSize: PageSize,
  bleed: BleedAmounts,
): { x: number; y: number; width: number; height: number } {
  return {
    x: bleed.left,
    y: bleed.bottom,
    width: newSize.width - bleed.left - bleed.right,
    height: newSize.height - bleed.top - bleed.bottom,
  };
}

/** What percentage of the new page is bleed area (0-100). */
export function calculateBleedAreaPercent(
  origW: number,
  origH: number,
  newW: number,
  newH: number,
): number {
  if (origW <= 0 || origH <= 0 || newW <= 0 || newH <= 0) return 0;
  const origArea = origW * origH;
  const newArea = newW * newH;
  if (newArea <= origArea) return 0;
  return Math.round(((newArea - origArea) / newArea) * 1000) / 10;
}

// ---- Background color ---------------------------------------------------

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;
const HEX_SHORT_RE = /^#?([0-9a-fA-F]{3})$/;

/** Parse a hex color string (#RGB or #RRGGBB) → RGB triple in [0,1]. */
export function parseBackgroundColor(hex: string): ToolResult<RgbColor> {
  const s = (hex || "").trim();
  let m = HEX_RE.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return {
      ok: true,
      output: {
        r: ((n >> 16) & 0xff) / 255,
        g: ((n >> 8) & 0xff) / 255,
        b: (n & 0xff) / 255,
      },
    };
  }
  const ms = HEX_SHORT_RE.exec(s);
  if (ms) {
    const r = parseInt(ms[1][0] + ms[1][0], 16);
    const g = parseInt(ms[1][1] + ms[1][1], 16);
    const b = parseInt(ms[1][2] + ms[1][2], 16);
    return { ok: true, output: { r: r / 255, g: g / 255, b: b / 255 } };
  }
  return { ok: false, error: `Invalid color "${hex}" — use #RRGGBB or #RGB.` };
}

// ---- Print-ready verifier ----------------------------------------------

/**
 * Verify that the supplied bleed meets the named print standard's minimum.
 * Returns ok with the verdict, or ok=false with an error message.
 */
export function verifyPrintReady(
  bleed: BleedAmounts,
  standard: PrintStandard = "iso-3mm",
): ToolResult<{ meets: boolean; minBleedPt: number; smallestSidePt: number }> {
  const std = PRINT_STANDARDS[standard];
  const sides = [bleed.top, bleed.bottom, bleed.left, bleed.right].filter((v) => v > 0);
  if (sides.length === 0) {
    return { ok: false, error: "No bleed was applied — cannot verify." };
  }
  const smallest = Math.min(...sides);
  return {
    ok: true,
    output: { meets: smallest >= std.minBleedPt, minBleedPt: std.minBleedPt, smallestSidePt: smallest },
  };
}

// ---- Page-level result + renderers -------------------------------------

export interface BleedPageResult {
  pageNum: number;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  bleedAmountPt: number;
  sides: BleedSides;
  cropMarksAdded: boolean;
  bleedMarksAdded: boolean;
  backgroundFilled: boolean;
}

export interface BleedSummaryStats {
  totalPages: number;
  originalSize: PageSize;
  newSize: PageSize;
  totalBleedAreaPt: number;
  bleedAreaPercent: number;
  marksAdded: number;
}

/** Compute summary stats from a list of page results (assumes uniform page size). */
export function computeSummaryStats(pages: BleedPageResult[]): BleedSummaryStats {
  if (pages.length === 0) {
    return {
      totalPages: 0,
      originalSize: { width: 0, height: 0 },
      newSize: { width: 0, height: 0 },
      totalBleedAreaPt: 0,
      bleedAreaPercent: 0,
      marksAdded: 0,
    };
  }
  const first = pages[0];
  const origArea = first.originalWidth * first.originalHeight;
  const newArea = first.newWidth * first.newHeight;
  const bleedArea = Math.max(0, newArea - origArea);
  const marksAdded = pages.reduce(
    (sum, p) => sum + (p.cropMarksAdded ? 8 : 0) + (p.bleedMarksAdded ? 4 : 0),
    0,
  );
  return {
    totalPages: pages.length,
    originalSize: { width: first.originalWidth, height: first.originalHeight },
    newSize: { width: first.newWidth, height: first.newHeight },
    totalBleedAreaPt: bleedArea * pages.length,
    bleedAreaPercent: calculateBleedAreaPercent(
      first.originalWidth,
      first.originalHeight,
      first.newWidth,
      first.newHeight,
    ),
    marksAdded,
  };
}

/** Render the per-page report as human-readable text. */
export function renderTextReport(pages: BleedPageResult[]): string {
  if (pages.length === 0) return "No pages processed.";
  const lines: string[] = [];
  lines.push(`PDF Bleed Adder — ${pages.length} page(s) processed`);
  lines.push("=".repeat(60));
  for (const p of pages) {
    lines.push(
      `Page ${p.pageNum}: ${p.originalWidth.toFixed(1)}×${p.originalHeight.toFixed(1)}pt → ${p.newWidth.toFixed(1)}×${p.newHeight.toFixed(1)}pt`,
    );
    lines.push(
      `  Bleed: ${p.bleedAmountPt.toFixed(2)}pt on "${p.sides}"`,
    );
    lines.push(
      `  Marks: ${p.cropMarksAdded ? "crop ✓" : "crop ✗"}  ${p.bleedMarksAdded ? "bleed ✓" : "bleed ✗"}  bg: ${p.backgroundFilled ? "filled" : "none"}`,
    );
  }
  const stats = computeSummaryStats(pages);
  lines.push("=".repeat(60));
  lines.push(`Total bleed area: ${stats.totalBleedAreaPt.toFixed(1)} pt² (${stats.bleedAreaPercent}% of page)`);
  lines.push(`Total marks drawn: ${stats.marksAdded}`);
  return lines.join("\n");
}

/** CSV escape helper. */
function csvEscape(s: string | number | boolean): string {
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Render the per-page report as CSV with a header row. */
export function renderCsvReport(pages: BleedPageResult[]): string {
  const header = "page_num,original_width_pt,original_height_pt,new_width_pt,new_height_pt,bleed_amount_pt,sides,crop_marks,bleed_marks,background_filled";
  const rows = pages.map((p) =>
    [
      p.pageNum,
      p.originalWidth.toFixed(2),
      p.originalHeight.toFixed(2),
      p.newWidth.toFixed(2),
      p.newHeight.toFixed(2),
      p.bleedAmountPt.toFixed(2),
      csvEscape(p.sides),
      p.cropMarksAdded ? "yes" : "no",
      p.bleedMarksAdded ? "yes" : "no",
      p.backgroundFilled ? "yes" : "no",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

// ---- History (localStorage) --------------------------------------------

const HISTORY_KEY = "unqtools:pdf-bleed-adder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  bleedMm: number;
  sides: BleedSides;
  cropMarks: boolean;
  bleedMarks: boolean;
  extendBackground: boolean;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ------------------------------------------------------

export interface ShareParams {
  bleedMm: number;
  sides: BleedSides;
  extendBackground: boolean;
  backgroundColor: string;
  includeCropMarks: boolean;
  includeBleedMarks: boolean;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  params.set("bleed", String(p.bleedMm));
  params.set("sides", p.sides);
  params.set("bg", p.extendBackground ? "1" : "0");
  if (p.backgroundColor) params.set("color", p.backgroundColor);
  params.set("crop", p.includeCropMarks ? "1" : "0");
  params.set("bmk", p.includeBleedMarks ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareParams> = {};
  const bleed = params.get("bleed");
  if (bleed !== null && !Number.isNaN(Number(bleed))) out.bleedMm = Number(bleed);
  const sides = params.get("sides");
  if (sides !== null && BLEED_SIDES_LIST.includes(sides as BleedSides)) {
    out.sides = sides as BleedSides;
  }
  out.extendBackground = params.get("bg") === "1";
  const color = params.get("color");
  if (color) out.backgroundColor = color;
  out.includeCropMarks = params.get("crop") === "1";
  out.includeBleedMarks = params.get("bmk") === "1";
  return out;
}
