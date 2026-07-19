/**
 * PDF Grayscale Converter — pure logic.
 *
 * Color-to-grayscale converters (luminance, average, lightness, desaturate,
 * custom-weighted), threshold applier, black/white preservers, color analyzer,
 * ink-usage calculator, color-distance (Euclidean) helper, dithering (none /
 * Floyd-Steinberg / ordered), histogram generator, summary stats, text/CSV
 * reports, history (localStorage), shareable URL.
 *
 * No DOM, no pdf-lib — pure functions only. PDF manipulation lives in ui.tsx.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type ConversionMethod =
  | "luminance"
  | "average"
  | "lightness"
  | "desaturate"
  | "custom-weighted";

export type DitheringMode = "none" | "floyd-steinberg" | "ordered";

export interface RGBColor {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
}

export interface CustomWeights {
  r: number;
  g: number;
  b: number;
}

export interface ConversionOptions {
  method: ConversionMethod;
  /** Required when method === "custom-weighted". */
  customWeights?: CustomWeights;
  /** Keep pure black (#000000) as-is when true. */
  preserveBlack: boolean;
  /** Keep pure white (#FFFFFF) as-is when true. */
  preserveWhite: boolean;
  /** -1 = grayscale only; >0 = apply threshold for B&W (0–255). */
  threshold: number;
  /** Dithering mode for B&W threshold output. */
  dithering: DitheringMode;
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  method: "luminance",
  preserveBlack: true,
  preserveWhite: true,
  threshold: -1,
  dithering: "none",
};

export const CONVERSION_METHODS: ConversionMethod[] = [
  "luminance",
  "average",
  "lightness",
  "desaturate",
  "custom-weighted",
];

export const DITHERING_MODES: DitheringMode[] = ["none", "floyd-steinberg", "ordered"];

export const METHOD_LABELS: Record<ConversionMethod, string> = {
  luminance: "Luminance (NTSC 0.299/0.587/0.114)",
  average: "Average ((R+G+B)/3)",
  lightness: "Lightness (HSL (max+min)/2)",
  desaturate: "Desaturate (HSL S=0)",
  "custom-weighted": "Custom weighted",
};

export interface PageConversionStats {
  pageNumber: number;
  originalColorCount: number;
  uniqueOriginalColors: number;
  grayscaleColorCount: number;
  inkBefore: number; // 0–100 percent
  inkAfter: number;
  inkSavedPercent: number;
  topColorsBefore: { color: RGBColor; count: number; hex: string }[];
  topColorsAfter: { value: number; count: number }[];
}

export interface SummaryStats {
  totalPages: number;
  totalColorsConverted: number;
  uniqueColorsBefore: number;
  uniqueColorsAfter: number;
  totalInkSavedPercent: number;
  method: ConversionMethod;
  threshold: number;
  dithering: DitheringMode;
}

export interface HistogramBucket {
  binStart: number; // inclusive 0–255
  binEnd: number; // exclusive
  count: number;
}

export interface Histogram {
  before: HistogramBucket[];
  after: HistogramBucket[];
}

export interface ColorComparison {
  totalColors: number;
  changedColors: number;
  avgColorDistance: number;
  maxColorDistance: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  method: ConversionMethod;
  threshold: number;
  inkSavedPercent: number;
}

// ---------------------------------------------------------------------------
// Color normalization & conversions
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampByte(n: number): number {
  return clamp(Math.round(n), 0, 255);
}

/** Clamp an RGB color to 0–255 range with rounding. */
export function normalizeRgb(c: RGBColor): RGBColor {
  return { r: clampByte(c.r), g: clampByte(c.g), b: clampByte(c.b) };
}

/** NTSC luminance: 0.299R + 0.587G + 0.114B (0–255). */
export function rgbToLuminance(c: RGBColor): number {
  const x = normalizeRgb(c);
  return clampByte(0.299 * x.r + 0.587 * x.g + 0.114 * x.b);
}

/** Arithmetic mean: (R+G+B)/3 (0–255). */
export function rgbToAverage(c: RGBColor): number {
  const x = normalizeRgb(c);
  return clampByte((x.r + x.g + x.b) / 3);
}

/** HSL lightness: (max(R,G,B) + min(R,G,B)) / 2 (0–255). */
export function rgbToLightness(c: RGBColor): number {
  const x = normalizeRgb(c);
  return clampByte((Math.max(x.r, x.g, x.b) + Math.min(x.r, x.g, x.b)) / 2);
}

/** HSL desaturation: returns the lightness value (S=0 means same as lightness). */
export function rgbToDesaturate(c: RGBColor): number {
  // HSL with S=0 reduces to L
  return rgbToLightness(c);
}

/** Parse a custom weights string like "0.4,0.4,0.2" into weights. Returns null if invalid. */
export function parseCustomWeights(input: string): CustomWeights | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const r = parseFloat(parts[0]);
  const g = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  if (r < 0 || g < 0 || b < 0) return null;
  return { r, g, b };
}

/** Custom-weighted grayscale: wR*R + wG*G + wB*B (0–255). */
export function rgbToCustomWeighted(c: RGBColor, weights: CustomWeights): number {
  const x = normalizeRgb(c);
  return clampByte(weights.r * x.r + weights.g * x.g + weights.b * x.b);
}

/** Dispatch to the right converter based on the chosen method. */
export function convertWithMethod(
  c: RGBColor,
  method: ConversionMethod,
  weights?: CustomWeights,
): number {
  switch (method) {
    case "luminance":
      return rgbToLuminance(c);
    case "average":
      return rgbToAverage(c);
    case "lightness":
      return rgbToLightness(c);
    case "desaturate":
      return rgbToDesaturate(c);
    case "custom-weighted":
      if (!weights) return rgbToLuminance(c);
      return rgbToCustomWeighted(c, weights);
  }
}

// ---------------------------------------------------------------------------
// Threshold, black/white preservation
// ---------------------------------------------------------------------------

/** Apply a threshold: values >= threshold → 255 (white), else 0 (black). */
export function applyThreshold(value: number, threshold: number): 0 | 255 {
  if (threshold < 0 || threshold > 255) return value >= 128 ? 255 : 0;
  return value >= threshold ? 255 : 0;
}

/** If preserveBlack is true and the original color is pure black, keep gray as 0. */
export function preserveBlack(c: RGBColor, gray: number, preserve: boolean): number {
  if (preserve && c.r === 0 && c.g === 0 && c.b === 0) return 0;
  return gray;
}

/** If preserveWhite is true and the original color is pure white, keep gray as 255. */
export function preserveWhite(c: RGBColor, gray: number, preserve: boolean): number {
  if (preserve && c.r === 255 && c.g === 255 && c.b === 255) return 255;
  return gray;
}

// ---------------------------------------------------------------------------
// Color distance & ink estimation
// ---------------------------------------------------------------------------

/** Euclidean distance between two RGB colors. */
export function colorDistance(a: RGBColor, b: RGBColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Estimate ink usage (0–100 percent).
 * Treats 0 (black) as full ink, 255 (white) as no ink.
 */
export function estimateInkUsage(grayValues: number[]): number {
  if (grayValues.length === 0) return 0;
  let sum = 0;
  for (const v of grayValues) sum += (255 - clampByte(v)) / 255;
  return Math.round((sum / grayValues.length) * 1000) / 10;
}

/** Ink savings percentage (before vs after). Negative = more ink used. */
export function computeInkSavings(beforeInk: number, afterInk: number): number {
  if (beforeInk <= 0) return 0;
  return Math.round(((beforeInk - afterInk) / beforeInk) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Page analysis & comparison
// ---------------------------------------------------------------------------

function colorKey(c: RGBColor): string {
  return `${c.r},${c.g},${c.b}`;
}

function rgbToHex(c: RGBColor): string {
  const x = normalizeRgb(c);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(x.r)}${h(x.g)}${h(x.b)}`;
}

export interface PageAnalysis {
  uniqueColorCount: number;
  topColors: { color: RGBColor; count: number; hex: string }[];
}

/** Count unique colors and return the top N by frequency. */
export function analyzePageColors(colors: RGBColor[], topN = 10): PageAnalysis {
  const counts = new Map<string, { color: RGBColor; count: number }>();
  for (const c of colors) {
    const key = colorKey(c);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { color: { ...c }, count: 1 });
  }
  const top = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((x) => ({ color: x.color, count: x.count, hex: rgbToHex(x.color) }));
  return { uniqueColorCount: counts.size, topColors: top };
}

/** Compare before/after color lists (must be the same length). */
export function compareBeforeAfter(before: RGBColor[], after: RGBColor[]): ColorComparison {
  const len = Math.min(before.length, after.length);
  let changed = 0;
  let totalDist = 0;
  let maxDist = 0;
  for (let i = 0; i < len; i++) {
    const b = before[i];
    const a = after[i];
    const d = colorDistance(b, a);
    if (d > 0.5) changed += 1;
    totalDist += d;
    if (d > maxDist) maxDist = d;
  }
  return {
    totalColors: len,
    changedColors: changed,
    avgColorDistance: len > 0 ? Math.round((totalDist / len) * 100) / 100 : 0,
    maxColorDistance: Math.round(maxDist * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Histogram generator
// ---------------------------------------------------------------------------

/** Bin a list of values (0–255) into N buckets. Default 16 bins of width 16. */
export function buildHistogram(values: number[], bins = 16): HistogramBucket[] {
  const buckets: HistogramBucket[] = [];
  const width = 256 / bins;
  for (let i = 0; i < bins; i++) {
    buckets.push({
      binStart: Math.round(i * width),
      binEnd: Math.round((i + 1) * width),
      count: 0,
    });
  }
  for (const v of values) {
    const idx = clamp(Math.floor(v / width), 0, bins - 1);
    buckets[idx].count += 1;
  }
  return buckets;
}

/** Build a before/after histogram from two value lists. */
export function buildBeforeAfterHistogram(
  beforeGray: number[],
  afterGray: number[],
  bins = 16,
): Histogram {
  return {
    before: buildHistogram(beforeGray, bins),
    after: buildHistogram(afterGray, bins),
  };
}

// ---------------------------------------------------------------------------
// Dithering (1D approximation for color lists)
// ---------------------------------------------------------------------------

/** 4×4 Bayer matrix for ordered dithering. */
const BAYER_4X4: number[] = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/**
 * Apply Floyd-Steinberg error diffusion to a 1D list of gray values.
 * Returns a list of 0/255 values. Threshold is the cut-off (default 128).
 * Error diffusion: each pixel distributes its error to the next 1-3 neighbors.
 */
export function generateFloydSteinberg(values: number[], threshold = 128): number[] {
  if (values.length === 0) return [];
  const work = values.map((v) => clampByte(v));
  const out: number[] = new Array(work.length);
  for (let i = 0; i < work.length; i++) {
    const old = work[i];
    const newVal = old >= threshold ? 255 : 0;
    out[i] = newVal;
    const err = old - newVal;
    // Distribute error: 7/16 to next, 3/16 to next-2, 5/16 to next-1, 1/16 to next+1
    if (i + 1 < work.length) work[i + 1] = clampByte(work[i + 1] + (err * 7) / 16);
    if (i + 2 < work.length) work[i + 2] = clampByte(work[i + 2] + (err * 3) / 16);
    if (i + 3 < work.length) work[i + 3] = clampByte(work[i + 3] + (err * 5) / 16);
    if (i + 4 < work.length) work[i + 4] = clampByte(work[i + 4] + (err * 1) / 16);
  }
  return out;
}

/** Apply 4×4 ordered (Bayer) dithering. Threshold is shifted by Bayer position. */
export function generateOrderedDither(values: number[], threshold = 128): number[] {
  if (values.length === 0) return [];
  const out: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const m = BAYER_4X4[i % 16];
    const offset = (m / 16) * 32 - 16; // -16..+16
    const adjusted = threshold + offset;
    out[i] = clampByte(values[i]) >= adjusted ? 255 : 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(
  pageStats: PageConversionStats[],
  opts: ConversionOptions,
): SummaryStats {
  const totalPages = pageStats.length;
  const totalColorsConverted = pageStats.reduce((acc, p) => acc + p.originalColorCount, 0);
  const uniqueBefore = pageStats.reduce((acc, p) => acc + p.uniqueOriginalColors, 0);
  const uniqueAfter = pageStats.reduce((acc, p) => acc + p.grayscaleColorCount, 0);
  const totalInkSaved = pageStats.reduce((acc, p) => acc + p.inkSavedPercent, 0);
  return {
    totalPages,
    totalColorsConverted,
    uniqueColorsBefore: uniqueBefore,
    uniqueColorsAfter: uniqueAfter,
    totalInkSavedPercent: totalPages > 0 ? Math.round((totalInkSaved / totalPages) * 10) / 10 : 0,
    method: opts.method,
    threshold: opts.threshold,
    dithering: opts.dithering,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render a human-readable text report. */
export function renderTextReport(
  pageStats: PageConversionStats[],
  summary: SummaryStats,
): string {
  const lines: string[] = [];
  lines.push(`PDF Grayscale Conversion Report`);
  lines.push(`Method: ${summary.method}`);
  lines.push(`Threshold: ${summary.threshold < 0 ? "off (grayscale only)" : summary.threshold}`);
  lines.push(`Dithering: ${summary.dithering}`);
  lines.push(`Pages converted: ${summary.totalPages}`);
  lines.push(`Total colors converted: ${summary.totalColorsConverted}`);
  lines.push(`Unique colors before → after: ${summary.uniqueColorsBefore} → ${summary.uniqueColorsAfter}`);
  lines.push(`Average ink saved per page: ${summary.totalInkSavedPercent}%`);
  lines.push("");
  for (const p of pageStats) {
    lines.push(`--- Page ${p.pageNumber} ---`);
    lines.push(`  Original colors: ${p.originalColorCount} (${p.uniqueOriginalColors} unique)`);
    lines.push(`  Grayscale colors: ${p.grayscaleColorCount}`);
    lines.push(`  Ink before/after: ${p.inkBefore}% / ${p.inkAfter}%  (saved ${p.inkSavedPercent}%)`);
    if (p.topColorsBefore.length > 0) {
      lines.push(`  Top colors before:`);
      for (const t of p.topColorsBefore.slice(0, 5)) {
        lines.push(`    ${t.hex}  ×${t.count}`);
      }
    }
    if (p.topColorsAfter.length > 0) {
      lines.push(`  Top grayscale values after:`);
      for (const t of p.topColorsAfter.slice(0, 5)) {
        lines.push(`    ${t.value}  ×${t.count}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render page stats as CSV: page, original_colors, grayscale_colors, ink_saved. */
export function renderCsv(pageStats: PageConversionStats[]): string {
  const lines = ["page,original_colors,grayscale_colors,ink_before,ink_after,ink_saved_percent"];
  for (const p of pageStats) {
    lines.push(
      [
        p.pageNumber,
        p.originalColorCount,
        p.grayscaleColorCount,
        p.inkBefore,
        p.inkAfter,
        p.inkSavedPercent,
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-grayscale-converter:history";
const HISTORY_MAX = 20;

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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_METHODS = new Set<ConversionMethod>(CONVERSION_METHODS);
const VALID_DITHER = new Set<DitheringMode>(DITHERING_MODES);

export function buildShareUrl(opts: ConversionOptions): string {
  const params = new URLSearchParams();
  if (opts.method !== DEFAULT_OPTIONS.method) params.set("m", opts.method);
  if (opts.preserveBlack !== DEFAULT_OPTIONS.preserveBlack) params.set("pb", opts.preserveBlack ? "1" : "0");
  if (opts.preserveWhite !== DEFAULT_OPTIONS.preserveWhite) params.set("pw", opts.preserveWhite ? "1" : "0");
  if (opts.threshold !== DEFAULT_OPTIONS.threshold) params.set("t", String(opts.threshold));
  if (opts.dithering !== DEFAULT_OPTIONS.dithering) params.set("d", opts.dithering);
  if (opts.method === "custom-weighted" && opts.customWeights) {
    params.set("w", `${opts.customWeights.r},${opts.customWeights.g},${opts.customWeights.b}`);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConversionOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConversionOptions> = {};
  const m = params.get("m");
  if (m && VALID_METHODS.has(m as ConversionMethod)) out.method = m as ConversionMethod;
  const pb = params.get("pb");
  if (pb !== null) out.preserveBlack = pb !== "0";
  const pw = params.get("pw");
  if (pw !== null) out.preserveWhite = pw !== "0";
  const t = params.get("t");
  if (t !== null) {
    const tn = Number(t);
    if (Number.isFinite(tn)) out.threshold = tn;
  }
  const d = params.get("d");
  if (d && VALID_DITHER.has(d as DitheringMode)) out.dithering = d as DitheringMode;
  const w = params.get("w");
  if (w) {
    const parsed = parseCustomWeights(w);
    if (parsed) out.customWeights = parsed;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: ConversionOptions): ToolResult<ConversionOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_METHODS.has(opts.method)) {
    return { ok: false, error: `Unknown conversion method: ${opts.method}` };
  }
  if (!VALID_DITHER.has(opts.dithering)) {
    return { ok: false, error: `Unknown dithering mode: ${opts.dithering}` };
  }
  if (opts.method === "custom-weighted") {
    if (!opts.customWeights) {
      return { ok: false, error: "Custom-weighted method requires weights (e.g. 0.299,0.587,0.114)." };
    }
    const { r, g, b } = opts.customWeights;
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || r < 0 || g < 0 || b < 0) {
      return { ok: false, error: "Custom weights must be non-negative numbers." };
    }
  }
  if (opts.threshold !== -1 && (opts.threshold < 0 || opts.threshold > 255)) {
    return { ok: false, error: "Threshold must be -1 (off) or 0–255." };
  }
  return { ok: true, output: { ...opts } };
}
