/**
 * Print Size Calculator — pure logic for computing print dimensions
 * from pixels and DPI, with standard paper sizes and quality metrics.
 *
 * 10+ Extras:
 *   1. Pixels → inches/cm/mm conversion
 *   2. Standard paper sizes (A4/A3/Letter/Legal/Tabloid/A1/A2/A5)
 *   3. Resolution quality indicator (good/fair/poor)
 *   4. Minimum DPI for print quality
 *   5. Max print size from pixels at recommended DPI
 *   6. Unit conversion (cm ↔ mm ↔ inches)
 *   7. Validation
 *   8. Stats
 *   9. Batch helper
 *  10. CSV export
 *  11. Aspect ratio helper
 *  12. Print size fits check (does it fit on A4 etc.)
 *  13. Recommendations
 */

export type LengthUnit = "in" | "cm" | "mm";
export type QualityLevel = "good" | "fair" | "poor";

export interface PrintCalcInput {
  width: number;
  height: number;
  dpi: number;
  unit: LengthUnit;
}

export interface PrintCalcResult {
  width: number;
  height: number;
  dpi: number;
  printSize: { width: number; height: number; unit: LengthUnit };
  quality: QualityLevel;
  maxPrintAtDpi: { width: number; height: number; unit: LengthUnit };
  minDpiForGood: number;
  aspectRatio: number;
  warnings: string[];
  recommendations: string[];
  stats: PrintStats;
}

export interface PrintStats {
  width: number;
  height: number;
  dpi: number;
  megapixels: number;
  aspectRatio: number;
  durationMs: number;
}

/** Standard paper sizes in mm. */
export const PAPER_SIZES: { name: string; widthMm: number; heightMm: number }[] = [
  { name: "A1", widthMm: 594, heightMm: 841 },
  { name: "A2", widthMm: 420, heightMm: 594 },
  { name: "A3", widthMm: 297, heightMm: 420 },
  { name: "A4", widthMm: 210, heightMm: 297 },
  { name: "A5", widthMm: 148, heightMm: 210 },
  { name: "Letter", widthMm: 216, heightMm: 279 },
  { name: "Legal", widthMm: 216, heightMm: 356 },
  { name: "Tabloid", widthMm: 279, heightMm: 432 },
];

const MM_PER_INCH = 25.4;
const MM_PER_CM = 10;

/** Convert mm to target unit. */
export function fromMm(mm: number, unit: LengthUnit): number {
  if (unit === "in") return mm / MM_PER_INCH;
  if (unit === "cm") return mm / MM_PER_CM;
  return mm;
}

/** Convert target unit to mm. */
export function toMm(value: number, unit: LengthUnit): number {
  if (unit === "in") return value * MM_PER_INCH;
  if (unit === "cm") return value * MM_PER_CM;
  return value;
}

/** Print size (in target unit) from pixels and DPI. */
export function printSize(width: number, height: number, dpi: number, unit: LengthUnit): { width: number; height: number } {
  if (dpi <= 0) return { width: 0, height: 0 };
  const inchesW = width / dpi;
  const inchesH = height / dpi;
  const mmW = inchesW * MM_PER_INCH;
  const mmH = inchesH * MM_PER_INCH;
  return { width: fromMm(mmW, unit), height: fromMm(mmH, unit) };
}

/** Quality indicator based on DPI. */
export function qualityFromDpi(dpi: number): QualityLevel {
  if (dpi >= 300) return "good";
  if (dpi >= 150) return "fair";
  return "poor";
}

/** Minimum DPI to maintain "good" print quality for a given print size (mm). */
export function minDpiForGoodPrint(widthMm: number, heightMm: number, pixelsW: number, pixelsH: number): number {
  if (widthMm <= 0 || heightMm <= 0) return 300;
  const minDim = Math.min(widthMm, heightMm);
  const minPx = Math.min(pixelsW, pixelsH);
  // 300 DPI = 300/25.4 pixels per mm
  // To get "good" quality, need at least 300 DPI
  // For our min dimension, dpi = pixels / inches = pixels * 25.4 / mm
  return Math.round((minPx * MM_PER_INCH) / minDim);
}

/** Maximum print size (mm) for given pixels at recommended DPI (300). */
export function maxPrintAt300Dpi(width: number, height: number, unit: LengthUnit): { width: number; height: number } {
  const mmW = (width / 300) * MM_PER_INCH;
  const mmH = (height / 300) * MM_PER_INCH;
  return { width: fromMm(mmW, unit), height: fromMm(mmH, unit) };
}

/** Aspect ratio (width / height). */
export function aspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}

/** Megapixels (rounded to 1 decimal). */
export function megapixels(width: number, height: number): number {
  return Math.round((width * height / 1_000_000) * 10) / 10;
}

/** Check whether given print size (mm) fits on a named paper size. */
export function fitsOnPaper(printMmW: number, printMmH: number, paperName: string): boolean {
  const paper = PAPER_SIZES.find((p) => p.name === paperName);
  if (!paper) return false;
  // Allow rotation (landscape vs portrait)
  const fits1 = printMmW <= paper.widthMm && printMmH <= paper.heightMm;
  const fits2 = printMmW <= paper.heightMm && printMmH <= paper.widthMm;
  return fits1 || fits2;
}

/** Validate input. */
export function validateInput(input: PrintCalcInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (input.dpi <= 0 || input.dpi > 4000) return { error: "DPI must be 1-4000" };
  if (input.unit !== "in" && input.unit !== "cm" && input.unit !== "mm") return { error: "Unknown unit" };
  return { ok: true };
}

/** Run the print size calculation. */
export function calculatePrintSize(input: PrintCalcInput): PrintCalcResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { width, height, dpi, unit } = input;
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (dpi < 150) warnings.push("DPI below 150 will produce visible pixelation.");
  if (dpi > 600) warnings.push("DPI above 600 typically doesn't improve perceived quality.");

  const q = qualityFromDpi(dpi);
  if (q === "poor") recommendations.push("Increase DPI to at least 150 for acceptable print quality.");
  if (q === "fair") recommendations.push("For best results, use 300 DPI.");

  const ps = printSize(width, height, dpi, unit);
  const maxP = maxPrintAt300Dpi(width, height, unit);
  const minDpi = minDpiForGoodPrint(toMm(ps.width, unit), toMm(ps.height, unit), width, height);
  const ar = aspectRatio(width, height);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    width, height, dpi,
    printSize: { width: Math.round(ps.width * 1000) / 1000, height: Math.round(ps.height * 1000) / 1000, unit },
    quality: q,
    maxPrintAtDpi: { width: Math.round(maxP.width * 1000) / 1000, height: Math.round(maxP.height * 1000) / 1000, unit },
    minDpiForGood: minDpi,
    aspectRatio: Math.round(ar * 1000) / 1000,
    warnings,
    recommendations,
    stats: {
      width, height, dpi,
      megapixels: megapixels(width, height),
      aspectRatio: Math.round(ar * 1000) / 1000,
      durationMs: Math.max(0, end - start),
    },
  };
}

/** Batch helper. */
export function batchCalculate(inputs: PrintCalcInput[]): (PrintCalcResult | { error: string })[] {
  return inputs.map((input) => calculatePrintSize(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: PrintStats): string {
  return [
    "Field,Value",
    `Width,${stats.width}`,
    `Height,${stats.height}`,
    `DPI,${stats.dpi}`,
    `Megapixels,${stats.megapixels}`,
    `AspectRatio,${stats.aspectRatio}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}
