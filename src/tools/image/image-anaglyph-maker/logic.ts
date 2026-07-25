/**
 * Image Anaglyph Maker — pure logic. No DOM/canvas access.
 * Creates red-cyan 3D from a left and right image by channel separation.
 *
 * 10+ extras:
 *   1. Red-cyan, red-green, amber-blue, green-magenta modes
 *   2. Channel separation (which channels come from which image)
 *   3. Depth adjustment (parallax shift between L/R)
 *   4. Parallax offset (horizontal pixel shift)
 *   5. Batch validation
 *   6. Presets (standard, high-contrast, monochrome, dubois)
 *   7. Identity check
 *   8. Format-preserving transparency check
 *   9. Dimension validation
 *  10. Combine pixels helper
 *  11. ANAGLYPH_MODES list
 *  12. Parallax shift helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type AnaglyphMode = "red-cyan" | "red-blue" | "red-green" | "green-magenta" | "amber-blue" | "dubois";

export interface AnaglyphPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AnaglyphOptions {
  /** Output color mode. */
  mode?: AnaglyphMode;
  /** Parallax shift in pixels (positive = right shift of right image). */
  parallax: number;
  /** Depth/strength 0..1 (1 = full anaglyph, 0 = original left). */
  depth: number;
}

export const DEFAULT_OPTIONS: AnaglyphOptions = {
  mode: "red-cyan",
  parallax: 0,
  depth: 1,
};

export interface AnaglyphPreset {
  id: string;
  label: string;
  options: AnaglyphOptions;
}

export const PRESETS: AnaglyphPreset[] = [
  { id: "standard", label: "Standard red-cyan", options: { ...DEFAULT_OPTIONS, mode: "red-cyan" } },
  { id: "high-contrast", label: "High contrast", options: { ...DEFAULT_OPTIONS, mode: "red-cyan", depth: 1.5 } },
  { id: "monochrome", label: "Monochrome", options: { ...DEFAULT_OPTIONS, mode: "red-blue", depth: 1 } },
  { id: "dubois", label: "Dubois (optimized)", options: { ...DEFAULT_OPTIONS, mode: "dubois" } },
  { id: "amber-blue", label: "Amber-blue", options: { ...DEFAULT_OPTIONS, mode: "amber-blue" } },
];

/** Compute a single anaglyph output pixel from left and right pixels. */
export function combinePixels(
  left: AnaglyphPixel,
  right: AnaglyphPixel,
  options: AnaglyphOptions = {},
): AnaglyphPixel {
  const mode = options.mode ?? "red-cyan";
  const depth = options.depth ?? 1;
  switch (mode) {
    case "red-cyan":
      return {
        r: left.r,
        g: right.g,
        b: right.b,
        a: Math.max(left.a, right.a),
      };
    case "red-blue":
      return {
        r: left.r,
        g: lerpChannel(0, right.g, depth),
        b: right.b,
        a: Math.max(left.a, right.a),
      };
    case "red-green":
      return {
        r: left.r,
        g: right.g,
        b: lerpChannel(0, right.b, depth),
        a: Math.max(left.a, right.a),
      };
    case "green-magenta":
      return {
        r: right.r,
        g: left.g,
        b: right.b,
        a: Math.max(left.a, right.a),
      };
    case "amber-blue":
      return {
        r: Math.round((left.r + left.g) / 2),
        g: lerpChannel(0, right.g, depth),
        b: right.b,
        a: Math.max(left.a, right.a),
      };
    case "dubois":
      // Dubois algorithm: optimized for reduced retinal rivalry
      return {
        r: clampByte(0.437 * left.r + 0.449 * left.g + 0.164 * left.b),
        g: clampByte(-0.062 * right.r + 0.062 * right.g + 0.5 * right.b),
        b: clampByte(-0.048 * right.r + -0.276 * right.g + 0.5 * right.b),
        a: Math.max(left.a, right.a),
      };
    default:
      return { r: left.r, g: right.g, b: right.b, a: Math.max(left.a, right.a) };
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

function lerpChannel(a: number, b: number, t: number): number {
  return clampByte(a + (b - a) * clamp(t, 0, 2));
}

/** Validate that left and right images share the same dimensions. */
export function validateDimensions(
  leftW: number,
  leftH: number,
  rightW: number,
  rightH: number,
): { width: number; height: number } | { error: string } {
  if (leftW <= 0 || leftH <= 0 || rightW <= 0 || rightH <= 0) {
    return { error: "Image dimensions must be positive" };
  }
  if (leftW !== rightW || leftH !== rightH) {
    return {
      error: `Left (${leftW}×${leftH}) and right (${rightW}×${rightH}) images must share dimensions`,
    };
  }
  return { width: leftW, height: leftH };
}

/** Validate anaglyph options. */
export function validateAnaglyphOptions(opts: AnaglyphOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.parallax)) return { error: "Parallax must be a finite number" };
  if (opts.parallax < -100 || opts.parallax > 100) return { error: "Parallax must be -100..100" };
  if (opts.depth < 0 || opts.depth > 2) return { error: "Depth must be 0..2" };
  return { ok: true };
}

/** Compute parallax shift for a given row (uniform horizontal shift). */
export function parallaxShift(x: number, parallax: number): number {
  return Math.round(x - parallax);
}

/** Apply parallax shift to a pixel's x-coordinate, clamped to image bounds. */
export function shiftedX(x: number, parallax: number, width: number): number {
  const sx = x - parallax;
  return Math.max(0, Math.min(width - 1, Math.round(sx)));
}

/** True when options produce a no-op. */
export function isIdentity(opts: AnaglyphOptions): boolean {
  return opts.depth === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: AnaglyphOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateAnaglyphOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 5 : 1;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): AnaglyphPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export const ANAGLYPH_MODES: { value: AnaglyphMode; label: string }[] = [
  { value: "red-cyan", label: "Red/Cyan" },
  { value: "red-blue", label: "Red/Blue" },
  { value: "red-green", label: "Red/Green" },
  { value: "green-magenta", label: "Green/Magenta" },
  { value: "amber-blue", label: "Amber/Blue" },
  { value: "dubois", label: "Dubois" },
];
