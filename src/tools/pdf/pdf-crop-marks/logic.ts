/**
 * PDF Crop Marks — pure logic.
 *
 * Computes the geometry for adding crop marks (trim marks), registration
 * crosses, bleed marks, and color density bars to a PDF page. All functions
 * are pure: given a page size and a marks configuration they return lines,
 * shapes, and color values without touching pdf-lib or the DOM.
 */
import type { ToolResult } from "../../../lib/tool";

// ---- Constants ----------------------------------------------------------

/** 1 millimetre expressed in PostScript/PDF points. */
export const MM_TO_POINTS = 2.83465;

// ---- Mark types ---------------------------------------------------------

export type MarkType = "corner-crop" | "edge-crop" | "both" | "registration-cross";

export const MARK_TYPES: MarkType[] = [
  "corner-crop",
  "edge-crop",
  "both",
  "registration-cross",
];

export const MARK_TYPE_LABELS: Record<MarkType, string> = {
  "corner-crop": "Corner crop marks (4 corners, 2 lines each)",
  "edge-crop": "Edge crop marks (4 edges, 1 line each)",
  "both": "Corner + edge marks",
  "registration-cross": "Registration crosses (plus signs at corners)",
};

/** Selector that returns true if corner marks should be drawn for a given type. */
export function includesCornerMarks(t: MarkType): boolean {
  return t === "corner-crop" || t === "both";
}

/** Selector that returns true if edge marks should be drawn for a given type. */
export function includesEdgeMarks(t: MarkType): boolean {
  return t === "edge-crop" || t === "both";
}

/** Selector that returns true if registration crosses should be drawn. */
export function includesRegistrationCross(t: MarkType): boolean {
  return t === "registration-cross";
}

// ---- Mark color ---------------------------------------------------------

export type MarkColor = "black" | "registration-black" | "red" | "blue";

export const MARK_COLORS: MarkColor[] = [
  "black",
  "registration-black",
  "red",
  "blue",
];

export const MARK_COLOR_LABELS: Record<MarkColor, string> = {
  "black": "Black (RGB 0,0,0)",
  "registration-black": "Registration black (CMYK all 100%)",
  "red": "Red (RGB 0.8,0.1,0.1)",
  "blue": "Blue (RGB 0.1,0.3,0.8)",
};

export interface RgbColor { r: number; g: number; b: number; }
export interface CmykColor { c: number; m: number; y: number; k: number; }

export interface MarkColorDef {
  rgb: RgbColor;
  /** Optional CMYK equivalent — present for registration black. */
  cmyk?: CmykColor;
}

/** Lookup table of mark colors (rgb in 0-1 range). */
export const MARK_COLOR_DEFS: Record<MarkColor, MarkColorDef> = {
  "black": { rgb: { r: 0, g: 0, b: 0 } },
  "registration-black": {
    rgb: { r: 0, g: 0, b: 0 },
    cmyk: { c: 1, m: 1, y: 1, k: 1 },
  },
  "red": { rgb: { r: 0.8, g: 0.1, b: 0.1 } },
  "blue": { rgb: { r: 0.1, g: 0.3, b: 0.8 } },
};

/** Look up a MarkColorDef by name with a safe fallback to black. */
export function lookupMarkColor(c: MarkColor): MarkColorDef {
  return MARK_COLOR_DEFS[c] ?? MARK_COLOR_DEFS.black;
}

// ---- Mark length / weight / offset -------------------------------------

/** Convert mm to points for mark length. */
export function markLengthToPoints(mm: number): number {
  return mm * MM_TO_POINTS;
}

/** Mark weight is already in points — pass through with clamping. */
export function markWeightToPoints(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) return 0.25;
  return Math.max(0.1, Math.min(weight, 5));
}

/** Convert mm offset to points. */
export function markOffsetToPoints(mm: number): number {
  return mm * MM_TO_POINTS;
}

// ---- Page + trim box ----------------------------------------------------

export interface PageSize { width: number; height: number; }
export interface Line { x1: number; y1: number; x2: number; y2: number; }

/**
 * Trim box is the rectangle inside the page where the final cut will happen.
 * For a page with no existing bleed, the trim box equals the page bounds.
 */
export function calculateTrimBox(
  pageSize: PageSize,
  bleed?: { top: number; bottom: number; left: number; right: number },
): { x: number; y: number; width: number; height: number } {
  if (!bleed) {
    return { x: 0, y: 0, width: pageSize.width, height: pageSize.height };
  }
  return {
    x: bleed.left,
    y: bleed.bottom,
    width: pageSize.width - bleed.left - bleed.right,
    height: pageSize.height - bleed.top - bleed.bottom,
  };
}

// ---- Mark generators ----------------------------------------------------

/**
 * Generate corner crop marks at the four trim corners. Each corner gets two
 * perpendicular short lines offset OUTSIDE the trim box by `offsetPt`.
 * Returns 8 lines.
 */
export function generateCornerCropMarks(
  trimW: number,
  trimH: number,
  offsetPt: number,
  markLengthPt: number,
): Line[] {
  const lines: Line[] = [];
  const x0 = 0, x1 = trimW, y0 = 0, y1 = trimH;

  // Bottom-left
  lines.push({ x1: x0, y1: y0 - offsetPt, x2: x0, y2: y0 - offsetPt - markLengthPt });
  lines.push({ x1: x0 - offsetPt, y1: y0, x2: x0 - offsetPt - markLengthPt, y2: y0 });
  // Bottom-right
  lines.push({ x1: x1, y1: y0 - offsetPt, x2: x1, y2: y0 - offsetPt - markLengthPt });
  lines.push({ x1: x1 + offsetPt, y1: y0, x2: x1 + offsetPt + markLengthPt, y2: y0 });
  // Top-left
  lines.push({ x1: x0, y1: y1 + offsetPt, x2: x0, y2: y1 + offsetPt + markLengthPt });
  lines.push({ x1: x0 - offsetPt, y1: y1, x2: x0 - offsetPt - markLengthPt, y2: y1 });
  // Top-right
  lines.push({ x1: x1, y1: y1 + offsetPt, x2: x1, y2: y1 + offsetPt + markLengthPt });
  lines.push({ x1: x1 + offsetPt, y1: y1, x2: x1 + offsetPt + markLengthPt, y2: y1 });
  return lines;
}

/**
 * Generate edge crop marks — one short line at the midpoint of each edge,
 * pointing outward. Returns 4 lines.
 */
export function generateEdgeCropMarks(
  trimW: number,
  trimH: number,
  offsetPt: number,
  markLengthPt: number,
): Line[] {
  const cx = trimW / 2;
  const cy = trimH / 2;
  return [
    // Top edge — line above midpoint, pointing up
    { x1: cx, y1: trimH + offsetPt, x2: cx, y2: trimH + offsetPt + markLengthPt },
    // Bottom edge — line below midpoint, pointing down
    { x1: cx, y1: -offsetPt, x2: cx, y2: -offsetPt - markLengthPt },
    // Left edge — line left of midpoint, pointing left
    { x1: -offsetPt, y1: cy, x2: -offsetPt - markLengthPt, y2: cy },
    // Right edge — line right of midpoint, pointing right
    { x1: trimW + offsetPt, y1: cy, x2: trimW + offsetPt + markLengthPt, y2: cy },
  ];
}

/**
 * Generate registration crosses — a plus sign at each trim corner.
 * Each cross is 2 lines (horizontal + vertical) centred on the corner point,
 * with the cross extended OUTSIDE the trim box by `offsetPt`.
 * Returns 8 lines (4 corners × 2 lines).
 */
export function generateRegistrationCrosses(
  trimW: number,
  trimH: number,
  offsetPt: number,
  markLengthPt: number,
): Line[] {
  const lines: Line[] = [];
  const halfArm = markLengthPt / 2;
  // For each corner, the cross sits at offset OUTSIDE the trim corner
  const corners: Array<[number, number, number, number]> = [
    // [cx, cy, dirX, dirY] — direction away from trim box
    [0, 0, -1, -1],      // bottom-left, cross sits at (-offset, -offset)
    [trimW, 0, 1, -1],   // bottom-right
    [0, trimH, -1, 1],   // top-left
    [trimW, trimH, 1, 1], // top-right
  ];
  for (const [cx, cy, dx, dy] of corners) {
    const crossX = cx + dx * offsetPt;
    const crossY = cy + dy * offsetPt;
    // Horizontal arm of the plus
    lines.push({ x1: crossX - halfArm, y1: crossY, x2: crossX + halfArm, y2: crossY });
    // Vertical arm
    lines.push({ x1: crossX, y1: crossY - halfArm, x2: crossX, y2: crossY + halfArm });
  }
  return lines;
}

/**
 * Generate bleed marks — short marks placed at the trim edge midpoints
 * extended inward by `markLengthPt`. Useful for verifying the trim position
 * when there's bleed present.
 */
export function generateBleedMarks(
  trimW: number,
  trimH: number,
  markLengthPt: number,
): Line[] {
  const cx = trimW / 2;
  const cy = trimH / 2;
  return [
    { x1: cx, y1: trimH, x2: cx, y2: trimH - markLengthPt }, // top, inward
    { x1: cx, y1: 0, x2: cx, y2: markLengthPt },             // bottom, inward
    { x1: 0, y1: cy, x2: markLengthPt, y2: cy },             // left, inward
    { x1: trimW, y1: cy, x2: trimW - markLengthPt, y2: cy }, // right, inward
  ];
}

// ---- Density bars -------------------------------------------------------

export interface DensityBar {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Color name — caller maps to RgbColor via MARK_COLOR_DEFS-like table. */
  color: "cyan" | "magenta" | "yellow" | "black" | "red" | "green" | "blue" | "gray50";
}

export const DENSITY_BAR_COLORS: Record<DensityBar["color"], RgbColor> = {
  cyan:    { r: 0,   g: 1,   b: 1   },
  magenta: { r: 1,   g: 0,   b: 1   },
  yellow:  { r: 1,   g: 1,   b: 0   },
  black:   { r: 0,   g: 0,   b: 0   },
  red:     { r: 0.8, g: 0.1, b: 0.1 },
  green:   { r: 0.1, g: 0.5, b: 0.1 },
  blue:    { r: 0.1, g: 0.3, b: 0.8 },
  gray50:  { r: 0.5, g: 0.5, b: 0.5 },
};

/**
 * Generate a row of CMYK + RGB density bars at the bottom edge of the page,
 * sitting just outside the trim area. Returns 8 bars.
 *
 * @param trimW        trim width (pt)
 * @param trimH        trim height (pt)
 * @param offsetPt     gap below trim where the bar row sits
 * @param barWidth     width of each bar (pt)
 * @param barHeight    height of each bar (pt)
 */
export function generateDensityBars(
  trimW: number,
  trimH: number,
  offsetPt: number,
  barWidth: number,
  barHeight: number,
): DensityBar[] {
  const colors: DensityBar["color"][] = [
    "cyan", "magenta", "yellow", "black", "red", "green", "blue", "gray50",
  ];
  const totalWidth = colors.length * barWidth;
  const startX = (trimW - totalWidth) / 2;
  const y = -offsetPt - barHeight; // below the trim box
  return colors.map((c, i) => ({
    x: startX + i * barWidth,
    y,
    width: barWidth,
    height: barHeight,
    color: c,
  }));
}

// ---- Print-standard checker --------------------------------------------

export type PrintStandard = "iso" | "ansi";

export const PRINT_STANDARDS: Record<PrintStandard, {
  label: string;
  /** Minimum recommended mark length in pt. */
  minMarkLengthPt: number;
  /** Minimum recommended mark offset in pt. */
  minMarkOffsetPt: number;
  /** Recommended mark weight (pt). */
  recommendedWeightPt: number;
}> = {
  iso: {
    label: "ISO 15930 (PDF/X) — 5 mm mark length, 3 mm offset, 0.25 pt weight",
    minMarkLengthPt: 5 * MM_TO_POINTS,
    minMarkOffsetPt: 3 * MM_TO_POINTS,
    recommendedWeightPt: 0.25,
  },
  ansi: {
    label: "ANSI/CGATS — 0.25 inch mark length, 0.0625 inch offset, 0.25 pt weight",
    minMarkLengthPt: 0.25 * 72,
    minMarkOffsetPt: 0.0625 * 72,
    recommendedWeightPt: 0.25,
  },
};

export interface PrintStandardCheckResult {
  meets: boolean;
  warnings: string[];
  standard: PrintStandard;
}

/**
 * Verify that the supplied mark parameters meet a named print standard.
 * Returns meets=true only if every parameter is at or above the standard.
 */
export function checkPrintStandard(
  markLengthPt: number,
  markOffsetPt: number,
  markWeightPt: number,
  standard: PrintStandard = "iso",
): PrintStandardCheckResult {
  const std = PRINT_STANDARDS[standard];
  const warnings: string[] = [];
  if (markLengthPt < std.minMarkLengthPt) {
    warnings.push(
      `Mark length ${markLengthPt.toFixed(2)}pt is below ${standard.toUpperCase()} minimum ${std.minMarkLengthPt.toFixed(2)}pt.`,
    );
  }
  if (markOffsetPt < std.minMarkOffsetPt) {
    warnings.push(
      `Mark offset ${markOffsetPt.toFixed(2)}pt is below ${standard.toUpperCase()} minimum ${std.minMarkOffsetPt.toFixed(2)}pt.`,
    );
  }
  if (markWeightPt < std.recommendedWeightPt) {
    warnings.push(
      `Mark weight ${markWeightPt.toFixed(2)}pt is below ${standard.toUpperCase()} recommended ${std.recommendedWeightPt.toFixed(2)}pt.`,
    );
  }
  return { meets: warnings.length === 0, warnings, standard };
}

// ---- Mark visibility verifier ------------------------------------------

/**
 * Verify that a mark color has sufficient contrast against a page background
 * color (simple luminance-difference check). Returns meets=true if the
 * luminance difference exceeds the threshold (default 0.4 — roughly WCAG AA
 * for large text).
 */
export function verifyMarkVisibility(
  markColor: MarkColor,
  backgroundHex: string,
  threshold = 0.4,
): ToolResult<{ meets: boolean; contrast: number }> {
  const def = lookupMarkColor(markColor);
  const bgParsed = parseHex(backgroundHex);
  if (!bgParsed.ok) return bgParsed;
  const markLum = 0.299 * def.rgb.r + 0.587 * def.rgb.g + 0.114 * def.rgb.b;
  const bgLum = 0.299 * bgParsed.output.r + 0.587 * bgParsed.output.g + 0.114 * bgParsed.output.b;
  const contrast = Math.abs(markLum - bgLum);
  return { ok: true, output: { meets: contrast >= threshold, contrast } };
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;
const HEX_SHORT_RE = /^#?([0-9a-fA-F]{3})$/;

function parseHex(hex: string): ToolResult<RgbColor> {
  const s = (hex || "").trim();
  const m = HEX_RE.exec(s);
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

// ---- Page-level result + summary + renderers ---------------------------

export interface MarkPageResult {
  pageNum: number;
  markType: MarkType;
  markLengthPt: number;
  markWeightPt: number;
  markOffsetPt: number;
  markColor: MarkColor;
  cornerMarks: number;
  edgeMarks: number;
  registrationCrosses: number;
  bleedMarks: number;
  densityBars: number;
}

export interface MarkSummaryStats {
  totalPages: number;
  totalMarks: number;
  byType: Record<MarkType, number>;
  marksPerPage: number;
  densityBarsPerPage: number;
}

/** Compute summary stats from a list of page results. */
export function computeSummaryStats(pages: MarkPageResult[]): MarkSummaryStats {
  const byType: Record<MarkType, number> = {
    "corner-crop": 0,
    "edge-crop": 0,
    "both": 0,
    "registration-cross": 0,
  };
  let totalMarks = 0;
  let densityBars = 0;
  for (const p of pages) {
    byType[p.markType] += 1;
    totalMarks += p.cornerMarks + p.edgeMarks + p.registrationCrosses + p.bleedMarks;
    densityBars += p.densityBars;
  }
  return {
    totalPages: pages.length,
    totalMarks,
    byType,
    marksPerPage: pages.length > 0 ? Math.round((totalMarks / pages.length) * 10) / 10 : 0,
    densityBarsPerPage: pages.length > 0 ? Math.round((densityBars / pages.length) * 10) / 10 : 0,
  };
}

/** Render the per-page report as human-readable text. */
export function renderTextReport(pages: MarkPageResult[]): string {
  if (pages.length === 0) return "No pages processed.";
  const lines: string[] = [];
  lines.push(`PDF Crop Marks — ${pages.length} page(s) processed`);
  lines.push("=".repeat(60));
  for (const p of pages) {
    lines.push(
      `Page ${p.pageNum}: type="${p.markType}" length=${p.markLengthPt.toFixed(2)}pt weight=${p.markWeightPt.toFixed(2)}pt offset=${p.markOffsetPt.toFixed(2)}pt color=${p.markColor}`,
    );
    lines.push(
      `  Corner: ${p.cornerMarks}  Edge: ${p.edgeMarks}  Reg-cross: ${p.registrationCrosses}  Bleed: ${p.bleedMarks}  Density bars: ${p.densityBars}`,
    );
  }
  const stats = computeSummaryStats(pages);
  const totalDensityBars = Math.round(stats.densityBarsPerPage * pages.length);
  lines.push("=".repeat(60));
  lines.push(`Total marks drawn: ${stats.totalMarks} (avg ${stats.marksPerPage}/page)`);
  lines.push(`Density bars drawn: ${totalDensityBars} (avg ${stats.densityBarsPerPage}/page)`);
  return lines.join("\n");
}

/** CSV escape helper. */
function csvEscape(s: string | number): string {
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Render the per-page report as CSV with a header row. */
export function renderCsvReport(pages: MarkPageResult[]): string {
  const header = "page_num,mark_type,length_pt,weight_pt,offset_pt,color,corner_marks,edge_marks,reg_crosses,bleed_marks,density_bars";
  const rows = pages.map((p) =>
    [
      p.pageNum,
      csvEscape(p.markType),
      p.markLengthPt.toFixed(2),
      p.markWeightPt.toFixed(2),
      p.markOffsetPt.toFixed(2),
      csvEscape(p.markColor),
      p.cornerMarks,
      p.edgeMarks,
      p.registrationCrosses,
      p.bleedMarks,
      p.densityBars,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

// ---- History (localStorage) --------------------------------------------

const HISTORY_KEY = "unqtools:pdf-crop-marks:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  markType: MarkType;
  markLengthMm: number;
  markWeight: number;
  markColor: MarkColor;
  markOffsetMm: number;
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
  markType: MarkType;
  markLengthMm: number;
  markWeight: number;
  markColor: MarkColor;
  markOffsetMm: number;
  includeBleedMarks: boolean;
  includeDensityBars: boolean;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  params.set("type", p.markType);
  params.set("len", String(p.markLengthMm));
  params.set("wt", String(p.markWeight));
  params.set("col", p.markColor);
  params.set("off", String(p.markOffsetMm));
  params.set("bm", p.includeBleedMarks ? "1" : "0");
  params.set("db", p.includeDensityBars ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareParams> = {};
  const type = params.get("type");
  if (type !== null && MARK_TYPES.includes(type as MarkType)) {
    out.markType = type as MarkType;
  }
  const len = params.get("len");
  if (len !== null && !Number.isNaN(Number(len))) out.markLengthMm = Number(len);
  const wt = params.get("wt");
  if (wt !== null && !Number.isNaN(Number(wt))) out.markWeight = Number(wt);
  const col = params.get("col");
  if (col !== null && MARK_COLORS.includes(col as MarkColor)) {
    out.markColor = col as MarkColor;
  }
  const off = params.get("off");
  if (off !== null && !Number.isNaN(Number(off))) out.markOffsetMm = Number(off);
  out.includeBleedMarks = params.get("bm") === "1";
  out.includeDensityBars = params.get("db") === "1";
  return out;
}
