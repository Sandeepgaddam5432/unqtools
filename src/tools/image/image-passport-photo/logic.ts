/**
 * Passport Photo Maker — pure logic. No DOM/canvas access.
 *
 * Extras (10+):
 *   1. Country presets (US, UK, EU, India, Australia, Canada)
 *   2. Head positioning (chin-to-crown range, US 1-1.375in)
 *   3. Background validation (white / off-white tolerance)
 *   4. DPI / pixel dimension calculation from print size
 *   5. Print sheet layout (4x6in with multiple copies)
 *   6. Validation warnings list
 *   7. Eye-line guide calculation
 *   8. Head centering (x/y offset from frame center)
 *   9. Resolution quality scoring
 *  10. mm↔inch unit conversion helpers
 *  11. Crop rectangle (centered, aspect-correct)
 *  12. Print layout: row/column packing & spacing
 */
export type Unit = "mm" | "in";
export type BackgroundTone = "white" | "off-white";

export interface CountrySpec {
  code: string;
  name: string;
  width: number; // mm
  height: number; // mm
  headMin: number; // mm, chin to crown
  headMax: number; // mm
  background: BackgroundTone;
  eyeLineFromBottomPct: number; // typical 50-70%
}

export const COUNTRY_SPECS: CountrySpec[] = [
  { code: "US", name: "United States", width: 51, height: 51, headMin: 25.4, headMax: 35, background: "white", eyeLineFromBottomPct: 60 },
  { code: "UK", name: "United Kingdom", width: 35, height: 45, headMin: 29, headMax: 34, background: "off-white", eyeLineFromBottomPct: 60 },
  { code: "EU", name: "European Union", width: 35, height: 45, headMin: 32, headMax: 36, background: "off-white", eyeLineFromBottomPct: 60 },
  { code: "IN", name: "India", width: 35, height: 35, headMin: 25, headMax: 32, background: "white", eyeLineFromBottomPct: 55 },
  { code: "AU", name: "Australia", width: 35, height: 45, headMin: 32, headMax: 36, background: "off-white", eyeLineFromBottomPct: 60 },
  { code: "CA", name: "Canada", width: 50, height: 70, headMin: 31, headMax: 36, background: "white", eyeLineFromBottomPct: 65 },
];

export function getCountry(code: string): CountrySpec | undefined {
  return COUNTRY_SPECS.find((c) => c.code === code);
}

const MM_PER_IN = 25.4;

export function mmToInch(mm: number): number {
  return mm / MM_PER_IN;
}
export function inchToMm(inch: number): number {
  return inch * MM_PER_IN;
}

/** Pixel dimension for a given physical size at DPI. */
export function pixelsForSize(sizeMm: number, dpi: number): number {
  return Math.round(mmToInch(sizeMm) * dpi);
}

/** Compute crop rectangle (px) centered on source for the spec's aspect ratio. */
export function centeredCropRect(
  srcW: number,
  srcH: number,
  spec: CountrySpec,
  dpi: number,
): { x: number; y: number; width: number; height: number } {
  const targetW = pixelsForSize(spec.width, dpi);
  const targetH = pixelsForSize(spec.height, dpi);
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;
  let w: number, h: number;
  if (srcAspect > targetAspect) {
    h = srcH;
    w = Math.round(h * targetAspect);
  } else {
    w = srcW;
    h = Math.round(w / targetAspect);
  }
  const x = Math.round((srcW - w) / 2);
  const y = Math.round((srcH - h) / 2);
  return { x, y, width: w, height: h };
}

/** Validate that head measurement (mm) is within spec. */
export function validateHeadSize(headMm: number, spec: CountrySpec): { ok: boolean; warning?: string } {
  if (headMm < spec.headMin) {
    return { ok: false, warning: `Head too small: ${headMm.toFixed(1)}mm < ${spec.headMin}mm min` };
  }
  if (headMm > spec.headMax) {
    return { ok: false, warning: `Head too large: ${headMm.toFixed(1)}mm > ${spec.headMax}mm max` };
  }
  return { ok: true };
}

/** Validate background pixel against white/off-white tolerance. */
export function validateBackground(
  r: number, g: number, b: number,
  tone: BackgroundTone,
  tolerance = 18,
): { ok: boolean; warning?: string } {
  const avg = (r + g + b) / 3;
  const target = tone === "white" ? 255 : 245;
  const deviation = Math.abs(avg - target);
  const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);
  if (deviation > tolerance) {
    return { ok: false, warning: `Background too dark (avg ${avg.toFixed(0)}, target ${target})` };
  }
  if (colorSpread > 20) {
    return { ok: false, warning: "Background has color tint — use plain white/off-white" };
  }
  return { ok: true };
}

/** Compute eye-line guide (y in px from top of frame). */
export function eyeLineY(
  frameHeightPx: number,
  spec: CountrySpec,
): number {
  const fromBottom = (spec.eyeLineFromBottomPct / 100) * frameHeightPx;
  return Math.round(frameHeightPx - fromBottom);
}

/** Compute head-center offset from frame center (px). */
export function headOffset(
  headCenterXPx: number,
  headCenterYPx: number,
  frameWidthPx: number,
  frameHeightPx: number,
): { dx: number; dy: number } {
  return {
    dx: headCenterXPx - frameWidthPx / 2,
    dy: headCenterYPx - frameHeightPx / 2,
  };
}

/** Quality score (0-100) for source resolution given DPI target. */
export function resolutionQuality(
  srcW: number,
  srcH: number,
  spec: CountrySpec,
  dpi: number,
): number {
  const neededW = pixelsForSize(spec.width, dpi);
  const neededH = pixelsForSize(spec.height, dpi);
  const ratio = Math.min(srcW / neededW, srcH / neededH);
  if (ratio >= 1.5) return 100;
  if (ratio >= 1.0) return 80;
  if (ratio >= 0.7) return 50;
  return 20;
}

/** Print layout: how many photos fit on a 4x6 inch sheet. */
export interface PrintLayout {
  sheetWidthMm: number;
  sheetHeightMm: number;
  cols: number;
  rows: number;
  count: number;
  gapMm: number;
  marginMm: number;
}

export function printLayout4x6(spec: CountrySpec, gapMm = 2, marginMm = 3): PrintLayout {
  const sheetW = inchToMm(4); // 101.6
  const sheetH = inchToMm(6); // 152.4
  const usableW = sheetW - marginMm * 2 + gapMm;
  const usableH = sheetH - marginMm * 2 + gapMm;
  const cols = Math.max(1, Math.floor(usableW / (spec.width + gapMm)));
  const rows = Math.max(1, Math.floor(usableH / (spec.height + gapMm)));
  return {
    sheetWidthMm: sheetW,
    sheetHeightMm: sheetH,
    cols,
    rows,
    count: cols * rows,
    gapMm,
    marginMm,
  };
}

/** Build full validation report for a passport photo. */
export interface ValidationInput {
  srcWidth: number;
  srcHeight: number;
  headMm?: number;
  bgR?: number; bgG?: number; bgB?: number;
  headCenterXPx?: number;
  headCenterYPx?: number;
  spec: CountrySpec;
  dpi: number;
}

export interface ValidationReport {
  warnings: string[];
  errors: string[];
  qualityScore: number;
  layout: PrintLayout;
  crop: { x: number; y: number; width: number; height: number };
}

export function validatePhoto(input: ValidationInput): ValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { spec, dpi } = input;

  if (input.srcWidth <= 0 || input.srcHeight <= 0) {
    errors.push("Source dimensions must be positive");
  }

  if (input.headMm !== undefined) {
    const r = validateHeadSize(input.headMm, spec);
    if (!r.ok && r.warning) warnings.push(r.warning);
  }

  if (input.bgR !== undefined && input.bgG !== undefined && input.bgB !== undefined) {
    const r = validateBackground(input.bgR, input.bgG, input.bgB, spec.background);
    if (!r.ok && r.warning) warnings.push(r.warning);
  }

  const quality = resolutionQuality(input.srcWidth, input.srcHeight, spec, dpi);
  if (quality < 60) warnings.push(`Low resolution: ${input.srcWidth}×${input.srcHeight}px may print blurry`);

  const layout = printLayout4x6(spec);
  const crop = centeredCropRect(input.srcWidth, input.srcHeight, spec, dpi);

  if (input.headCenterXPx !== undefined && input.headCenterYPx !== undefined) {
    const off = headOffset(input.headCenterXPx, input.headCenterYPx, crop.width, crop.height);
    if (Math.abs(off.dx) > crop.width * 0.05) warnings.push(`Head off-center horizontally by ${off.dx.toFixed(0)}px`);
    if (Math.abs(off.dy) > crop.height * 0.05) warnings.push(`Head off-center vertically by ${off.dy.toFixed(0)}px`);
  }

  return { warnings, errors, qualityScore: quality, layout, crop };
}

/** Build a download filename for the passport photo. */
export function buildFilename(spec: CountrySpec, dpi: number): string {
  return `passport-${spec.code.toLowerCase()}-${spec.width}x${spec.height}mm-${dpi}dpi.png`;
}
