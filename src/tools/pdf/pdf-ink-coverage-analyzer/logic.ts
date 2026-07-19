/**
 * PDF Ink Coverage Analyzer — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual content-stream parsing
 * lives in ui.tsx; this module handles page-area math, CMYK channel
 * separation, ink-volume estimation, cost calculation, multi-format rendering,
 * history (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type AnalysisMode = "per-page" | "per-channel-cmyk" | "per-color" | "total-document";

export const ANALYSIS_MODES: AnalysisMode[] = [
  "per-page",
  "per-channel-cmyk",
  "per-color",
  "total-document",
];

export const MODE_LABELS: Record<AnalysisMode, string> = {
  "per-page": "Per page (one row per page)",
  "per-channel-cmyk": "Per channel (CMYK breakdown per page)",
  "per-color": "Per color (distinct colors per page)",
  "total-document": "Total document (aggregates only)",
};

export interface InkOptions {
  analysisMode: AnalysisMode;
  pageRange: string;
  /** Comma-separated CMYK cost per ml in cents, e.g. "0.05,0.06,0.07,0.08". */
  inkCostPerMl: string;
  /** % coverage above which a page is flagged as heavy ink usage. */
  coverageThreshold: number;
  /** Whether to include image ink separately from text/graphics. */
  includeImages: boolean;
}

export const DEFAULT_OPTIONS: InkOptions = {
  analysisMode: "per-page",
  pageRange: "all",
  inkCostPerMl: "0.05,0.06,0.07,0.08",
  coverageThreshold: 50,
  includeImages: true,
};

/** Default ink thickness in millimeters used for volume estimation. */
export const DEFAULT_INK_THICKNESS_MM = 0.01;

/** Conversion: 1 PDF point = 1/72 inch = 25.4/72 mm. */
export const POINTS_PER_MM = 72 / 25.4;

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface CMYKColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

/** One entry in the per-color coverage breakdown. */
export interface ColorCoverageEntry {
  color: RGBColor;
  hex: string;
  /** Square PDF points covered with this color. */
  area: number;
  /** Same area converted to CMYK channels. */
  cmyk: CMYKColor;
}

/** Raw per-page content statistics, produced by ui.tsx from the PDF. */
export interface PageContentStats {
  pageNumber: number;
  width: number;
  height: number;
  /** Total characters drawn via text operators. */
  textChars: number;
  /** Average font size observed on the page (points). */
  avgFontSize: number;
  /** Total area of rectangle paths (square PDF points). */
  rectArea: number;
  /** Estimated area covered by images (square PDF points). */
  imageArea: number;
  /** Per-color coverage breakdown (text + graphics + images combined). */
  colorCoverages: ColorCoverageEntry[];
}

/** Final per-page analysis. */
export interface PageInkAnalysis {
  pageNumber: number;
  pageArea: number;
  textCoveragePct: number;
  graphicsCoveragePct: number;
  imageCoveragePct: number;
  totalCoveragePct: number;
  /** Per-channel coverage percentage (0–100). */
  c: number;
  m: number;
  y: number;
  k: number;
  /** True if any non-gray color was used. */
  isColor: boolean;
  /** True if only grays/black were used. */
  isGrayscale: boolean;
  /** Estimated ink volume in milliliters. */
  inkVolumeMl: number;
  /** Estimated cost in cents. */
  costCents: number;
  /** Distinct colors used on the page. */
  distinctColorCount: number;
  /** Top 5 colors by covered area. */
  topColors: ColorCoverageEntry[];
}

export interface SummaryStats {
  totalPages: number;
  pageAreaTotal: number;
  avgCoveragePct: number;
  maxCoveragePct: number;
  minCoveragePct: number;
  /** Per-channel averages (0–100). */
  avgC: number;
  avgM: number;
  avgY: number;
  avgK: number;
  totalInkVolumeMl: number;
  totalCostCents: number;
  colorPages: number;
  grayscalePages: number;
  heavyPages: number;
}

export interface HistogramBucket {
  /** Inclusive lower bound (0, 10, 20, …, 90). */
  lower: number;
  /** Exclusive upper bound (10, 20, …, 100). */
  upper: number;
  label: string;
  count: number;
  pageNumbers: number[];
}

export interface Recommendation {
  pageNumber: number;
  severity: "info" | "warn" | "critical";
  message: string;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  analysisMode: AnalysisMode;
  avgCoveragePct: number;
  totalCostCents: number;
}

// ---------------------------------------------------------------------------
// Page-range normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Ink cost parsing
// ---------------------------------------------------------------------------

/**
 * Parse "0.05,0.06,0.07,0.08" → { c, m, y, k } in cents per ml.
 * Falls back to defaults if missing/invalid.
 */
export function parseInkCosts(spec: string): CMYKColor {
  const parts = (spec ?? "")
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (parts.length < 4) return { c: 0.05, m: 0.06, y: 0.07, k: 0.08 };
  return { c: parts[0], m: parts[1], y: parts[2], k: parts[3] };
}

/** Format a CMYK cost object back to a "0.05,0.06,0.07,0.08" string. */
export function formatInkCosts(cost: CMYKColor): string {
  return [cost.c, cost.m, cost.y, cost.k].map((n) => n.toString()).join(",");
}

// ---------------------------------------------------------------------------
// Page-area math
// ---------------------------------------------------------------------------

/** Page area in square PDF points. */
export function calculatePageArea(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/** Convert square PDF points to square millimeters. */
export function pointsToMm2(areaPoints: number): number {
  return areaPoints / (POINTS_PER_MM * POINTS_PER_MM);
}

/** Convert square millimeters to milliliters (1 ml = 1 cm³ = 100 mm³). */
export function mm2ToMl(areaMm2: number, thicknessMm: number): number {
  const volumeMm3 = areaMm2 * Math.max(0, thicknessMm);
  return volumeMm3 / 1000;
}

// ---------------------------------------------------------------------------
// Color-space conversions
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clampRgb(c: RGBColor): RGBColor {
  return {
    r: clamp(Math.round(c.r), 0, 255),
    g: clamp(Math.round(c.g), 0, 255),
    b: clamp(Math.round(c.b), 0, 255),
  };
}

export function rgbToHex(c: RGBColor): string {
  const x = clampRgb(c);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(x.r)}${h(x.g)}${h(x.b)}`;
}

export function hexToRgb(hex: string): RGBColor {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/** Convert RGB (0–255) to CMYK (0–1 each). Pure black returns c=m=y=0, k=1. */
export function rgbToCmyk(rgb: RGBColor): CMYKColor {
  const c = clampRgb(rgb);
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  const denom = 1 - k;
  return {
    c: (1 - r - k) / denom,
    m: (1 - g - k) / denom,
    y: (1 - b - k) / denom,
    k,
  };
}

/** True if a color is a pure gray (r === g === b). */
export function isGrayColor(c: RGBColor): boolean {
  const x = clampRgb(c);
  return x.r === x.g && x.g === x.b;
}

// ---------------------------------------------------------------------------
// Coverage estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the area covered by text given a character count and average font size.
 * Uses an average glyph advance of 0.5 × fontSize and line height of 1.2 × fontSize.
 * Returns square PDF points.
 */
export function estimateTextArea(textChars: number, avgFontSize: number): number {
  if (textChars <= 0 || avgFontSize <= 0) return 0;
  const glyphWidth = avgFontSize * 0.5;
  const glyphHeight = avgFontSize * 1.0;
  return textChars * glyphWidth * glyphHeight;
}

/**
 * Estimate the area covered by N rectangles of total area `rectArea`,
 * capped to the page area.
 */
export function estimateGraphicsArea(rectArea: number, pageArea: number): number {
  if (rectArea <= 0 || pageArea <= 0) return 0;
  return Math.min(rectArea, pageArea);
}

/**
 * Estimate the area covered by images on a page. We can't easily measure
 * the on-page image dimensions without parsing the CTM, so we accept the
 * precomputed imageArea from ui.tsx (or 0).
 */
export function estimateImageArea(imageArea: number, pageArea: number, includeImages: boolean): number {
  if (!includeImages) return 0;
  if (imageArea <= 0 || pageArea <= 0) return 0;
  return Math.min(imageArea, pageArea);
}

/** Coverage percentage (0–100) of an area relative to a page. */
export function coveragePct(area: number, pageArea: number): number {
  if (pageArea <= 0) return 0;
  return Math.round((clamp(area, 0, pageArea) / pageArea) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Color usage analyzer
// ---------------------------------------------------------------------------

/**
 * Build a per-color coverage breakdown by aggregating ColorCoverageEntry
 * records. Identical colors are merged.
 */
export function aggregateColorCoverages(entries: ColorCoverageEntry[]): ColorCoverageEntry[] {
  const map = new Map<string, ColorCoverageEntry>();
  for (const e of entries) {
    const key = e.hex;
    const existing = map.get(key);
    if (existing) {
      existing.area += e.area;
    } else {
      map.set(key, {
        color: { ...e.color },
        hex: e.hex,
        area: e.area,
        cmyk: { ...e.cmyk },
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.area - a.area);
}

/** Return the top N colors by covered area. */
export function topColorsByArea(entries: ColorCoverageEntry[], n = 5): ColorCoverageEntry[] {
  return aggregateColorCoverages(entries).slice(0, Math.max(1, n));
}

// ---------------------------------------------------------------------------
// CMYK channel separator
// ---------------------------------------------------------------------------

/**
 * Given a list of ColorCoverageEntry records, compute the per-channel
 * covered area (square PDF points) by weighting each color's area by its
 * CMYK channel components.
 */
export function cmykChannelAreas(entries: ColorCoverageEntry[]): CMYKColor {
  let c = 0, m = 0, y = 0, k = 0;
  for (const e of entries) {
    c += e.area * e.cmyk.c;
    m += e.area * e.cmyk.m;
    y += e.area * e.cmyk.y;
    k += e.area * e.cmyk.k;
  }
  return { c, m, y, k };
}

// ---------------------------------------------------------------------------
// Ink volume & cost
// ---------------------------------------------------------------------------

/**
 * Estimate ink volume in milliliters for a coverage area.
 * `area` is in square PDF points.
 */
export function estimateInkVolume(area: number, thicknessMm = DEFAULT_INK_THICKNESS_MM): number {
  if (area <= 0) return 0;
  const mm2 = pointsToMm2(area);
  return Math.round(mm2ToMl(mm2, thicknessMm) * 1_000_000) / 1_000_000;
}

/**
 * Estimate cost in cents for an ink volume given per-channel costs.
 * `volumeByChannel` is in milliliters; `cost` is per-ml in cents.
 */
export function estimateCost(
  volumeByChannel: CMYKColor,
  costPerMl: CMYKColor,
): number {
  const total =
    volumeByChannel.c * costPerMl.c +
    volumeByChannel.m * costPerMl.m +
    volumeByChannel.y * costPerMl.y +
    volumeByChannel.k * costPerMl.k;
  return Math.round(total * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Full per-page analysis
// ---------------------------------------------------------------------------

/**
 * Convert raw PageContentStats into a full PageInkAnalysis.
 * Pure: takes the stats and options, returns the analysis.
 */
export function analyzePage(stats: PageContentStats, costPerMl: CMYKColor, thicknessMm = DEFAULT_INK_THICKNESS_MM): PageInkAnalysis {
  const pageArea = calculatePageArea(stats.width, stats.height);
  const textArea = estimateTextArea(stats.textChars, stats.avgFontSize);
  const graphicsArea = estimateGraphicsArea(stats.rectArea, pageArea);
  const imageArea = estimateImageArea(stats.imageArea, pageArea, true);
  const aggregated = aggregateColorCoverages(stats.colorCoverages);
  const cmykAreas = cmykChannelAreas(aggregated);
  const cPct = coveragePct(cmykAreas.c, pageArea);
  const mPct = coveragePct(cmykAreas.m, pageArea);
  const yPct = coveragePct(cmykAreas.y, pageArea);
  const kPct = coveragePct(cmykAreas.k, pageArea);
  // Total coverage: cap the sum of text+graphics+image to pageArea so we never exceed 100%.
  const cappedTotalArea = Math.min(textArea + graphicsArea + imageArea, pageArea);
  const totalCoverage = coveragePct(cappedTotalArea, pageArea);
  const isColor = aggregated.some((e) => !isGrayColor(e.color));
  const isGrayscale = aggregated.length === 0 || aggregated.every((e) => isGrayColor(e.color));
  const volumeMl = estimateInkVolume(cappedTotalArea, thicknessMm);
  // Distribute volume across channels by their area fractions.
  const totalCmykArea = cmykAreas.c + cmykAreas.m + cmykAreas.y + cmykAreas.k;
  const volumeByChannel: CMYKColor = totalCmykArea > 0
    ? {
        c: volumeMl * (cmykAreas.c / totalCmykArea),
        m: volumeMl * (cmykAreas.m / totalCmykArea),
        y: volumeMl * (cmykAreas.y / totalCmykArea),
        k: volumeMl * (cmykAreas.k / totalCmykArea),
      }
    : { c: 0, m: 0, y: 0, k: 0 };
  const cost = estimateCost(volumeByChannel, costPerMl);
  return {
    pageNumber: stats.pageNumber,
    pageArea,
    textCoveragePct: coveragePct(textArea, pageArea),
    graphicsCoveragePct: coveragePct(graphicsArea, pageArea),
    imageCoveragePct: coveragePct(imageArea, pageArea),
    totalCoveragePct: totalCoverage,
    c: cPct,
    m: mPct,
    y: yPct,
    k: kPct,
    isColor,
    isGrayscale,
    inkVolumeMl: volumeMl,
    costCents: cost,
    distinctColorCount: aggregated.length,
    topColors: topColorsByArea(aggregated, 5),
  };
}

// ---------------------------------------------------------------------------
// Heavy-usage detector
// ---------------------------------------------------------------------------

/** Filter pages whose total coverage is at or above the threshold. */
export function detectHeavyUsage(pages: PageInkAnalysis[], threshold: number): PageInkAnalysis[] {
  return pages.filter((p) => p.totalCoveragePct >= threshold);
}

/** Rank pages by cost (most expensive first). */
export function rankByCost(pages: PageInkAnalysis[]): PageInkAnalysis[] {
  return [...pages].sort((a, b) => b.costCents - a.costCents);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(pages: PageInkAnalysis[], threshold: number): SummaryStats {
  const totalPages = pages.length;
  if (totalPages === 0) {
    return {
      totalPages: 0,
      pageAreaTotal: 0,
      avgCoveragePct: 0,
      maxCoveragePct: 0,
      minCoveragePct: 0,
      avgC: 0,
      avgM: 0,
      avgY: 0,
      avgK: 0,
      totalInkVolumeMl: 0,
      totalCostCents: 0,
      colorPages: 0,
      grayscalePages: 0,
      heavyPages: 0,
    };
  }
  let totalCoverage = 0;
  let maxCov = -Infinity;
  let minCov = Infinity;
  let sumC = 0, sumM = 0, sumY = 0, sumK = 0;
  let totalVol = 0;
  let totalCost = 0;
  let colorPages = 0;
  let grayPages = 0;
  let heavy = 0;
  let pageAreaTotal = 0;
  for (const p of pages) {
    totalCoverage += p.totalCoveragePct;
    if (p.totalCoveragePct > maxCov) maxCov = p.totalCoveragePct;
    if (p.totalCoveragePct < minCov) minCov = p.totalCoveragePct;
    sumC += p.c;
    sumM += p.m;
    sumY += p.y;
    sumK += p.k;
    totalVol += p.inkVolumeMl;
    totalCost += p.costCents;
    if (p.isColor) colorPages += 1;
    if (p.isGrayscale) grayPages += 1;
    if (p.totalCoveragePct >= threshold) heavy += 1;
    pageAreaTotal += p.pageArea;
  }
  return {
    totalPages,
    pageAreaTotal,
    avgCoveragePct: Math.round((totalCoverage / totalPages) * 10) / 10,
    maxCoveragePct: Math.round(maxCov * 10) / 10,
    minCoveragePct: Math.round(minCov * 10) / 10,
    avgC: Math.round((sumC / totalPages) * 10) / 10,
    avgM: Math.round((sumM / totalPages) * 10) / 10,
    avgY: Math.round((sumY / totalPages) * 10) / 10,
    avgK: Math.round((sumK / totalPages) * 10) / 10,
    totalInkVolumeMl: Math.round(totalVol * 1_000_000) / 1_000_000,
    totalCostCents: Math.round(totalCost * 100) / 100,
    colorPages,
    grayscalePages: grayPages,
    heavyPages: heavy,
  };
}

// ---------------------------------------------------------------------------
// Histogram (10 buckets: 0-10, 11-20, ..., 91-100)
// ---------------------------------------------------------------------------

/** Build a 10-bucket coverage histogram from per-page analyses. */
export function buildHistogram(pages: PageInkAnalysis[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < 10; i++) {
    const lower = i * 10;
    const upper = i === 9 ? 100 : lower + 10;
    buckets.push({
      lower,
      upper,
      label: i === 9 ? "91-100%" : `${lower + (i === 0 ? 0 : 1)}-${upper}%`,
      count: 0,
      pageNumbers: [],
    });
  }
  // First bucket is 0-10% inclusive of 0; subsequent buckets are (lower, upper].
  for (const p of pages) {
    const cov = clamp(p.totalCoveragePct, 0, 100);
    let idx: number;
    if (cov <= 10) idx = 0;
    else if (cov > 90) idx = 9;
    else idx = Math.floor((cov - 1) / 10);
    if (idx < 0) idx = 0;
    if (idx > 9) idx = 9;
    buckets[idx].count += 1;
    buckets[idx].pageNumbers.push(p.pageNumber);
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Ink-saving recommendations
// ---------------------------------------------------------------------------

/**
 * Generate ink-saving recommendations per page based on coverage and channel mix.
 * Returns at most one recommendation per page (the most severe).
 */
export function generateRecommendations(pages: PageInkAnalysis[], threshold: number): Recommendation[] {
  const out: Recommendation[] = [];
  for (const p of pages) {
    let rec: Recommendation | null = null;
    if (p.totalCoveragePct >= threshold) {
      // Identify dominant channel
      const max = Math.max(p.c, p.m, p.y, p.k);
      const channel = max === p.c ? "Cyan" : max === p.m ? "Magenta" : max === p.y ? "Yellow" : "Black";
      const severity: Recommendation["severity"] = p.totalCoveragePct >= 80 ? "critical" : "warn";
      rec = {
        pageNumber: p.pageNumber,
        severity,
        message: `Page ${p.pageNumber} has ${p.totalCoveragePct}% total coverage with ${max.toFixed(1)}% ${channel}. Consider removing backgrounds, lightening images, or applying GCR.`,
      };
    } else if (p.k > 40) {
      rec = {
        pageNumber: p.pageNumber,
        severity: "warn",
        message: `Page ${p.pageNumber} has ${p.k.toFixed(1)}% Black (K) coverage — heavy solid fills waste ink. Consider lighter tints or grayscale conversion.`,
      };
    } else if (p.imageCoveragePct > 60) {
      rec = {
        pageNumber: p.pageNumber,
        severity: "info",
        message: `Page ${p.pageNumber} is image-dominant (${p.imageCoveragePct.toFixed(1)}% image coverage). Downscaling or compressing images can reduce ink usage significantly.`,
      };
    }
    if (rec) out.push(rec);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

function cents(n: number): string {
  if (n < 1) return `${(Math.round(n * 100) / 100).toFixed(2)}¢`;
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render per-page analyses as a human-readable text report. */
export function renderTextReport(
  pages: PageInkAnalysis[],
  summary: SummaryStats,
  mode: AnalysisMode,
): string {
  const lines: string[] = [];
  lines.push("PDF Ink Coverage Report");
  lines.push("=======================");
  lines.push(`Mode: ${mode}`);
  lines.push(`Pages analyzed: ${summary.totalPages}`);
  lines.push(`Avg coverage: ${pct(summary.avgCoveragePct)} • Max: ${pct(summary.maxCoveragePct)} • Min: ${pct(summary.minCoveragePct)}`);
  lines.push(`Avg C/M/Y/K: ${pct(summary.avgC)} / ${pct(summary.avgM)} / ${pct(summary.avgY)} / ${pct(summary.avgK)}`);
  lines.push(`Total ink volume: ${summary.totalInkVolumeMl.toFixed(6)} ml`);
  lines.push(`Total estimated cost: ${cents(summary.totalCostCents)}`);
  lines.push(`Color pages: ${summary.colorPages} • Grayscale pages: ${summary.grayscalePages} • Heavy pages: ${summary.heavyPages}`);
  lines.push("");
  if (mode === "total-document") {
    lines.push("(Total-document mode — per-page breakdown omitted.)");
    return lines.join("\n");
  }
  for (const p of pages) {
    lines.push(`--- Page ${p.pageNumber} ---`);
    lines.push(`  Total coverage: ${pct(p.totalCoveragePct)}  (text ${pct(p.textCoveragePct)} / graphics ${pct(p.graphicsCoveragePct)} / image ${pct(p.imageCoveragePct)})`);
    if (mode === "per-channel-cmyk" || mode === "per-color") {
      lines.push(`  CMYK: C ${pct(p.c)}  M ${pct(p.m)}  Y ${pct(p.y)}  K ${pct(p.k)}`);
    }
    lines.push(`  Color page: ${p.isColor} • Grayscale: ${p.isGrayscale} • Distinct colors: ${p.distinctColorCount}`);
    lines.push(`  Ink volume: ${p.inkVolumeMl.toFixed(6)} ml • Cost: ${cents(p.costCents)}`);
    if (mode === "per-color" && p.topColors.length > 0) {
      lines.push(`  Top colors:`);
      for (const t of p.topColors.slice(0, 5)) {
        lines.push(`    ${t.hex}  area=${t.area.toFixed(0)} sq pt  (C ${(t.cmyk.c * 100).toFixed(0)}% M ${(t.cmyk.m * 100).toFixed(0)}% Y ${(t.cmyk.y * 100).toFixed(0)}% K ${(t.cmyk.k * 100).toFixed(0)}%)`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render per-page analyses as CSV: page,total_pct,text_pct,graphics_pct,image_pct,c_pct,m_pct,y_pct,k_pct,volume_ml,cost_cents,color_page. */
export function renderCsvReport(pages: PageInkAnalysis[]): string {
  const lines: string[] = [
    "page,total_pct,text_pct,graphics_pct,image_pct,c_pct,m_pct,y_pct,k_pct,volume_ml,cost_cents,color_page,distinct_colors",
  ];
  for (const p of pages) {
    lines.push([
      p.pageNumber,
      p.totalCoveragePct,
      p.textCoveragePct,
      p.graphicsCoveragePct,
      p.imageCoveragePct,
      p.c,
      p.m,
      p.y,
      p.k,
      p.inkVolumeMl.toFixed(6),
      p.costCents.toFixed(4),
      p.isColor,
      p.distinctColorCount,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render an HTML report with bar charts for each page. */
export function renderHtmlReport(
  pages: PageInkAnalysis[],
  summary: SummaryStats,
  mode: AnalysisMode,
): string {
  const pageRows: string[] = [];
  for (const p of pages) {
    const bar = (label: string, value: number, color: string) => `
      <div class="bar">
        <div class="bar-label">${label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, value).toFixed(1)}%;background:${color}"></div></div>
        <div class="bar-value">${value.toFixed(1)}%</div>
      </div>`;
    pageRows.push(`
      <div class="page">
        <h3>Page ${p.pageNumber}</h3>
        <div class="bars">
          ${bar("Total", p.totalCoveragePct, "#1f2937")}
          ${bar("Cyan", p.c, "#06b6d4")}
          ${bar("Magenta", p.m, "#ec4899")}
          ${bar("Yellow", p.y, "#eab308")}
          ${bar("Black", p.k, "#111827")}
        </div>
        <p class="meta">Text ${p.textCoveragePct.toFixed(1)}% • Graphics ${p.graphicsCoveragePct.toFixed(1)}% • Image ${p.imageCoveragePct.toFixed(1)}% • ${p.isColor ? "color" : "grayscale"} • ${p.inkVolumeMl.toFixed(6)} ml • ${cents(p.costCents)}</p>
      </div>`);
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PDF Ink Coverage Report</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin-top: 24px; }
  h3 { font-size: 14px; margin: 12px 0 6px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; font-size: 12px; }
  .summary div { padding: 8px; background: #f3f4f6; border-radius: 6px; }
  .page { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  .bars { display: flex; flex-direction: column; gap: 4px; }
  .bar { display: grid; grid-template-columns: 80px 1fr 60px; gap: 8px; align-items: center; font-size: 12px; }
  .bar-track { background: #f3f4f6; border-radius: 4px; height: 14px; overflow: hidden; }
  .bar-fill { height: 100%; }
  .meta { font-size: 11px; color: #6b7280; margin-top: 6px; }
</style>
</head>
<body>
<h1>PDF Ink Coverage Report</h1>
<p>Mode: ${escapeHtml(mode)} • Pages: ${summary.totalPages}</p>
<div class="summary">
  <div><strong>Avg coverage</strong><br/>${summary.avgCoveragePct.toFixed(1)}%</div>
  <div><strong>Max coverage</strong><br/>${summary.maxCoveragePct.toFixed(1)}%</div>
  <div><strong>Min coverage</strong><br/>${summary.minCoveragePct.toFixed(1)}%</div>
  <div><strong>Avg C/M/Y/K</strong><br/>${summary.avgC.toFixed(1)} / ${summary.avgM.toFixed(1)} / ${summary.avgY.toFixed(1)} / ${summary.avgK.toFixed(1)}%</div>
  <div><strong>Total ink</strong><br/>${summary.totalInkVolumeMl.toFixed(6)} ml</div>
  <div><strong>Total cost</strong><br/>${cents(summary.totalCostCents)}</div>
  <div><strong>Color pages</strong><br/>${summary.colorPages}</div>
  <div><strong>Grayscale pages</strong><br/>${summary.grayscalePages}</div>
  <div><strong>Heavy pages</strong><br/>${summary.heavyPages}</div>
</div>
<h2>Per-page breakdown</h2>
${mode === "total-document" ? "<p>(Total-document mode — per-page breakdown omitted.)</p>" : pageRows.join("\n")}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-ink-coverage-analyzer:history";
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
      // ignore quota errors
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

const VALID_MODES = new Set<AnalysisMode>(ANALYSIS_MODES);

export function buildShareUrl(opts: InkOptions): string {
  const params = new URLSearchParams();
  if (opts.analysisMode !== DEFAULT_OPTIONS.analysisMode) params.set("mode", opts.analysisMode);
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.inkCostPerMl !== DEFAULT_OPTIONS.inkCostPerMl) params.set("cost", opts.inkCostPerMl);
  if (opts.coverageThreshold !== DEFAULT_OPTIONS.coverageThreshold) params.set("threshold", String(opts.coverageThreshold));
  if (opts.includeImages !== DEFAULT_OPTIONS.includeImages) params.set("images", opts.includeImages ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<InkOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<InkOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as AnalysisMode)) out.analysisMode = mode as AnalysisMode;
  const range = params.get("range");
  if (range) out.pageRange = range;
  const cost = params.get("cost");
  if (cost) out.inkCostPerMl = cost;
  const threshold = params.get("threshold");
  if (threshold !== null) {
    const n = parseInt(threshold, 10);
    if (Number.isFinite(n)) out.coverageThreshold = clamp(n, 0, 100);
  }
  const images = params.get("images");
  if (images !== null) out.includeImages = images !== "0";
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: InkOptions, pageCount: number): ToolResult<InkOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.analysisMode)) {
    return { ok: false, error: `Unknown analysis mode: ${opts.analysisMode}` };
  }
  if (!Number.isFinite(opts.coverageThreshold) || opts.coverageThreshold < 0 || opts.coverageThreshold > 100) {
    return { ok: false, error: "Coverage threshold must be between 0 and 100." };
  }
  const costs = parseInkCosts(opts.inkCostPerMl);
  if (costs.c < 0 || costs.m < 0 || costs.y < 0 || costs.k < 0) {
    return { ok: false, error: "Ink cost per ml must be a non-negative number." };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
