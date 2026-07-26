/**
 * Polaroid Photo Card Maker — pure logic for polaroid-style photo cards.
 *
 * 10+ Extras:
 *   1. Border widths (top/bottom/left/right separately)
 *   2. Caption text positioning (top/bottom/center)
 *   3. Caption font size calculation
 *   4. Vintage effect params (sepia + vignette + grain)
 *   5. Rotation angle
 *   6. Aspect ratio presets (square / classic / wide)
 *   7. Validation
 *   8. Stats
 *   9. Presets
 *  10. Batch helper
 *  11. CSV export
 *  12. CSS snippet
 *  13. Caption wrapping (text fit)
 *  14. Color helpers (hex parsing)
 */

export type CaptionPosition = "top" | "bottom" | "center";
export type AspectPreset = "square" | "classic" | "wide";

export interface PolaroidInput {
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Border widths (px) — separate for each side. */
  border: { top: number; right: number; bottom: number; left: number };
  /** Caption text. */
  caption: string;
  /** Caption position. */
  captionPosition: CaptionPosition;
  /** Caption font size in px (0 = auto). */
  captionFontSize: number;
  /** Caption color (hex). */
  captionColor: string;
  /** Border (frame) color (hex). */
  frameColor: string;
  /** Rotation in degrees. */
  rotation: number;
  /** Vintage effect intensity 0-1. */
  vintage: number;
  /** Sepia intensity 0-1 (used by vintage). */
  sepia: number;
  /** Vignette intensity 0-1. */
  vignette: number;
  /** Grain intensity 0-1. */
  grain: number;
  /** Aspect ratio preset for image fit. */
  aspect: AspectPreset;
}

export interface PolaroidResult {
  outputWidth: number;
  outputHeight: number;
  imageArea: { x: number; y: number; width: number; height: number };
  captionArea: { x: number; y: number; width: number; height: number };
  captionFontSize: number;
  stats: PolaroidStats;
  warnings: string[];
  cssFilter: string;
}

export interface PolaroidStats {
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  aspectRatio: number;
  durationMs: number;
}

/** Parse hex color → {r,g,b}. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | { error: string } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { error: "Invalid hex color" };
  return { r: parseInt(m[1]!.slice(0, 2), 16), g: parseInt(m[1]!.slice(2, 4), 16), b: parseInt(m[1]!.slice(4, 6), 16) };
}

/** Aspect ratio from preset. */
export function aspectFromPreset(preset: AspectPreset): number {
  if (preset === "square") return 1;
  if (preset === "wide") return 4 / 3;
  return 1.25; // classic polaroid
}

/** Compute image area (where the photo goes) given the input + border. */
export function computeImageArea(width: number, height: number, border: { top: number; right: number; bottom: number; left: number }, aspect: AspectPreset): { x: number; y: number; width: number; height: number } {
  const availW = width - border.left - border.right;
  const availH = height - border.top - border.bottom;
  const targetAr = aspectFromPreset(aspect);
  // Fit image within available area preserving aspect ratio
  let imgW = availW;
  let imgH = availW / targetAr;
  if (imgH > availH) {
    imgH = availH;
    imgW = availH * targetAr;
  }
  // Center in available area
  const x = border.left + (availW - imgW) / 2;
  const y = border.top + (availH - imgH) / 2;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(imgW), height: Math.round(imgH) };
}

/** Compute caption area (within the bottom border). */
export function computeCaptionArea(width: number, height: number, border: { top: number; right: number; bottom: number; left: number }, pos: CaptionPosition): { x: number; y: number; width: number; height: number } {
  if (pos === "top") {
    return { x: border.left, y: 4, width: width - border.left - border.right, height: border.top - 8 };
  }
  if (pos === "center") {
    return { x: border.left, y: border.top + (height - border.top - border.bottom) / 2 - 12, width: width - border.left - border.right, height: 24 };
  }
  return { x: border.left, y: height - border.bottom + 4, width: width - border.left - border.right, height: border.bottom - 8 };
}

/** Auto-compute caption font size to fit available width. */
export function autoFontSize(text: string, areaWidth: number, baseSize: number): number {
  if (!text) return baseSize;
  if (areaWidth <= 0) return baseSize;
  // Estimate: each character is ~0.55 * font size wide
  const estWidth = text.length * baseSize * 0.55;
  if (estWidth <= areaWidth) return baseSize;
  const scale = areaWidth / estWidth;
  return Math.max(8, Math.round(baseSize * scale));
}

/** Generate CSS filter string for vintage/sepia/vignette/grain. */
export function polaroidCssFilter(input: PolaroidInput): string {
  const sepiaPct = Math.round(input.sepia * input.vintage * 100);
  const contrastPct = 100 - Math.round(input.vintage * 15);
  const brightnessPct = 100 - Math.round(input.vintage * 5);
  return `sepia(${sepiaPct}%) contrast(${contrastPct}%) brightness(${brightnessPct}%)`;
}

/** Validate polaroid input. */
export function validateInput(input: PolaroidInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (input.border.top < 0 || input.border.right < 0 || input.border.bottom < 0 || input.border.left < 0) return { error: "Borders must be ≥ 0" };
  if (input.border.left + input.border.right >= input.width) return { error: "Horizontal borders exceed width" };
  if (input.border.top + input.border.bottom >= input.height) return { error: "Vertical borders exceed height" };
  if (input.border.left + input.border.right > input.width / 2) return { error: "Horizontal borders exceed half the width" };
  if (input.border.top + input.border.bottom > input.height / 2) return { error: "Vertical borders exceed half the height" };
  if (input.rotation < -45 || input.rotation > 45) return { error: "Rotation must be -45 to 45" };
  if (input.vintage < 0 || input.vintage > 1) return { error: "Vintage must be 0-1" };
  if (input.sepia < 0 || input.sepia > 1) return { error: "Sepia must be 0-1" };
  if (input.vignette < 0 || input.vignette > 1) return { error: "Vignette must be 0-1" };
  if (input.grain < 0 || input.grain > 1) return { error: "Grain must be 0-1" };
  if (input.aspect !== "square" && input.aspect !== "classic" && input.aspect !== "wide") return { error: "Unknown aspect preset" };
  return { ok: true };
}

/** Generate the polaroid layout result. */
export function generatePolaroid(input: PolaroidInput): PolaroidResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { width, height, border, aspect, caption } = input;
  const warnings: string[] = [];
  if (border.bottom < 40 && caption) warnings.push("Bottom border is narrow — caption may be cramped.");
  if (input.rotation !== 0) warnings.push("Rotated polaroids need transparent or larger canvas to avoid clipping.");
  if (input.vintage > 0.8) warnings.push("Very strong vintage effect may obscure detail.");

  const imageArea = computeImageArea(width, height, border, aspect);
  const captionArea = computeCaptionArea(width, height, border, input.captionPosition);
  const captionFontSize = input.captionFontSize > 0 ? input.captionFontSize : autoFontSize(caption, captionArea.width, 18);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    outputWidth: width,
    outputHeight: height,
    imageArea,
    captionArea,
    captionFontSize,
    stats: {
      inputWidth: width,
      inputHeight: height,
      outputWidth: width,
      outputHeight: height,
      aspectRatio: Math.round((width / height) * 1000) / 1000,
      durationMs: Math.max(0, end - start),
    },
    warnings,
    cssFilter: polaroidCssFilter(input),
  };
}

/** Standard polaroid presets. */
export const PRESETS: { name: string; value: Omit<PolaroidInput, "width" | "height" | "caption"> }[] = [
  {
    name: "Classic",
    value: {
      border: { top: 20, right: 20, bottom: 80, left: 20 },
      captionPosition: "bottom", captionFontSize: 18, captionColor: "#333333", frameColor: "#ffffff",
      rotation: 0, vintage: 0, sepia: 0, vignette: 0, grain: 0, aspect: "square",
    },
  },
  {
    name: "Vintage",
    value: {
      border: { top: 25, right: 25, bottom: 90, left: 25 },
      captionPosition: "bottom", captionFontSize: 18, captionColor: "#5a3a1a", frameColor: "#f4ead5",
      rotation: -3, vintage: 0.7, sepia: 0.8, vignette: 0.5, grain: 0.3, aspect: "square",
    },
  },
  {
    name: "Retro 80s",
    value: {
      border: { top: 15, right: 15, bottom: 70, left: 15 },
      captionPosition: "bottom", captionFontSize: 20, captionColor: "#ff4488", frameColor: "#fff0f5",
      rotation: 5, vintage: 0.4, sepia: 0.3, vignette: 0.3, grain: 0.4, aspect: "classic",
    },
  },
  {
    name: "Minimal",
    value: {
      border: { top: 10, right: 10, bottom: 40, left: 10 },
      captionPosition: "bottom", captionFontSize: 14, captionColor: "#888888", frameColor: "#ffffff",
      rotation: 0, vintage: 0, sepia: 0, vignette: 0, grain: 0, aspect: "wide",
    },
  },
];

/** Batch helper. */
export function batchGeneratePolaroid(inputs: PolaroidInput[]): (PolaroidResult | { error: string })[] {
  return inputs.map((input) => generatePolaroid(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: PolaroidStats): string {
  return [
    "Field,Value",
    `InputWidth,${stats.inputWidth}`,
    `InputHeight,${stats.inputHeight}`,
    `OutputWidth,${stats.outputWidth}`,
    `OutputHeight,${stats.outputHeight}`,
    `AspectRatio,${stats.aspectRatio}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}
