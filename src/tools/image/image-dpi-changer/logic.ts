/**
 * DPI Changer — pure logic for DPI/PPI metadata and resolution math.
 *
 * 10+ Extras:
 *   1. DPI presets (72/96/150/300/600/1200)
 *   2. Pixel dimensions from DPI + inches
 *   3. Print size from pixels + DPI
 *   4. Resolution unit conversion (DPI ↔ DPCM ↔ DPMM)
 *   5. Quality indicator (good/fair/poor)
 *   6. Common print size table
 *   7. Metadata update flag
 *   8. Validation
 *   9. Stats
 *  10. Batch helper
 *  11. CSV export
 *  12. Aspect ratio helper
 */

export type ResolutionUnit = "dpi" | "dpcm" | "dpmm";
export type QualityLevel = "good" | "fair" | "poor";

export interface DpiChangeInput {
  /** Original pixel width. */
  width: number;
  /** Original pixel height. */
  height: number;
  /** Target DPI. */
  targetDpi: number;
  /** Update metadata only (no resampling). Default true. */
  metadataOnly?: boolean;
  /** If resampling, target width (optional override). */
  targetWidth?: number;
  /** If resampling, target height (optional override). */
  targetHeight?: number;
}

export interface DpiChangeResult {
  width: number;
  height: number;
  targetDpi: number;
  printSizeInches: { width: number; height: number };
  printSizeCm: { width: number; height: number };
  printSizeMm: { width: number; height: number };
  quality: QualityLevel;
  resampled: boolean;
  warnings: string[];
  stats: DpiStats;
}

export interface DpiStats {
  width: number;
  height: number;
  targetDpi: number;
  megapixels: number;
  aspectRatio: number;
  durationMs: number;
}

/** Standard DPI presets. */
export const DPI_PRESETS: { value: number; label: string; use: string }[] = [
  { value: 72, label: "72 DPI", use: "Web/screen" },
  { value: 96, label: "96 DPI", use: "Windows screen" },
  { value: 150, label: "150 DPI", use: "Draft print" },
  { value: 300, label: "300 DPI", use: "Standard print" },
  { value: 600, label: "600 DPI", use: "High-quality print" },
  { value: 1200, label: "1200 DPI", use: "Professional print" },
];

/** Common print sizes in inches. */
export const PRINT_SIZES: { name: string; widthIn: number; heightIn: number }[] = [
  { name: "4×6", widthIn: 4, heightIn: 6 },
  { name: "5×7", widthIn: 5, heightIn: 7 },
  { name: "8×10", widthIn: 8, heightIn: 10 },
  { name: "8.5×11 (Letter)", widthIn: 8.5, heightIn: 11 },
  { name: "11×14", widthIn: 11, heightIn: 14 },
  { name: "11×17 (Tabloid)", widthIn: 11, heightIn: 17 },
  { name: "16×20", widthIn: 16, heightIn: 20 },
  { name: "20×30", widthIn: 20, heightIn: 30 },
];

/** Convert between resolution units. */
export function convertDpi(value: number, from: ResolutionUnit, to: ResolutionUnit): number {
  // First convert to DPI
  let dpi: number;
  if (from === "dpi") dpi = value;
  else if (from === "dpcm") dpi = value * 2.54;
  else dpi = value * 25.4; // dpmm
  if (to === "dpi") return dpi;
  if (to === "dpcm") return dpi / 2.54;
  return dpi / 25.4; // dpmm
}

/** Compute pixel dimensions from DPI and physical inches. */
export function pixelsFromInches(inchesW: number, inchesH: number, dpi: number): { width: number; height: number } {
  return { width: Math.round(inchesW * dpi), height: Math.round(inchesH * dpi) };
}

/** Compute print size (inches) from pixels and DPI. */
export function printSizeInches(width: number, height: number, dpi: number): { width: number; height: number } {
  if (dpi <= 0) return { width: 0, height: 0 };
  return { width: width / dpi, height: height / dpi };
}

/** Convert inches to cm. */
export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

/** Convert inches to mm. */
export function inchesToMm(inches: number): number {
  return inches * 25.4;
}

/** Quality indicator based on DPI. */
export function qualityFromDpi(dpi: number): QualityLevel {
  if (dpi >= 300) return "good";
  if (dpi >= 150) return "fair";
  return "poor";
}

/** Compute aspect ratio (width / height). */
export function aspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}

/** Megapixels (rounded to 1 decimal). */
export function megapixels(width: number, height: number): number {
  return Math.round((width * height / 1_000_000) * 10) / 10;
}

/** Validate input. */
export function validateInput(input: DpiChangeInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (input.targetDpi <= 0 || input.targetDpi > 4000) return { error: "DPI must be 1-4000" };
  return { ok: true };
}

/** Run the DPI change. */
export function changeDpi(input: DpiChangeInput): DpiChangeResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const metadataOnly = input.metadataOnly ?? true;
  const warnings: string[] = [];

  let finalW = input.width;
  let finalH = input.height;

  if (!metadataOnly) {
    if (input.targetWidth && input.targetHeight) {
      finalW = input.targetWidth;
      finalH = input.targetHeight;
    } else {
      // Resample to match new DPI at the SAME physical size
      const oldSize = printSizeInches(input.width, input.height, 72); // assume original 72 DPI baseline
      const newSize = pixelsFromInches(oldSize.width, oldSize.height, input.targetDpi);
      finalW = newSize.width;
      finalH = newSize.height;
    }
    warnings.push("Resampling changes pixel data. Use metadata-only mode for lossless DPI tagging.");
  }

  if (input.targetDpi < 72) warnings.push("DPI below 72 may look pixelated on screen.");
  if (input.targetDpi > 1200) warnings.push("Very high DPI — file size will be large.");

  const print = printSizeInches(finalW, finalH, input.targetDpi);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    width: finalW,
    height: finalH,
    targetDpi: input.targetDpi,
    printSizeInches: { width: Math.round(print.width * 1000) / 1000, height: Math.round(print.height * 1000) / 1000 },
    printSizeCm: { width: Math.round(inchesToCm(print.width) * 1000) / 1000, height: Math.round(inchesToCm(print.height) * 1000) / 1000 },
    printSizeMm: { width: Math.round(inchesToMm(print.width) * 1000) / 1000, height: Math.round(inchesToMm(print.height) * 1000) / 1000 },
    quality: qualityFromDpi(input.targetDpi),
    resampled: !metadataOnly,
    warnings,
    stats: {
      width: finalW,
      height: finalH,
      targetDpi: input.targetDpi,
      megapixels: megapixels(finalW, finalH),
      aspectRatio: Math.round(aspectRatio(finalW, finalH) * 1000) / 1000,
      durationMs: Math.max(0, end - start),
    },
  };
}

/** Batch helper. */
export function batchChangeDpi(inputs: DpiChangeInput[]): (DpiChangeResult | { error: string })[] {
  return inputs.map((input) => changeDpi(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: DpiStats): string {
  return [
    "Field,Value",
    `Width,${stats.width}`,
    `Height,${stats.height}`,
    `DPI,${stats.targetDpi}`,
    `Megapixels,${stats.megapixels}`,
    `AspectRatio,${stats.aspectRatio}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}

/** Suggest a DPI based on intended viewing distance (inches). */
export function suggestDpi(viewingDistanceInches: number): number {
  // Based on 0.000291 radians human eye resolution
  if (viewingDistanceInches <= 0) return 300;
  return Math.round(1 / (2 * viewingDistanceInches * Math.tan(0.000291 / 2)));
}
