/**
 * Image Saturation Adjuster — pure logic. No DOM access.
 */
export interface SaturationOptions {
  /** -100 (full grayscale) to +100 (extreme vivid). */
  value: number;
}

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Compute the saturation multiplier from a -100..+100 value. */
export function saturationFactor(value: number): number {
  const v = clamp(value, -100, 100);
  // -100 -> 0 (gray), 0 -> 1 (no change), +100 -> 2 (double saturation).
  return 1 + v / 100;
}

/** Compute the luma (per BT.601) of a pixel. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

/** Apply saturation to a single RGB pixel. */
export function applySaturation(pixel: RgbPixel, value: number): RgbPixel {
  const f = saturationFactor(value);
  const y = luma(pixel);
  const blend = (c: number) => Math.round(y + (c - y) * f);
  return {
    r: clampByte(blend(pixel.r)),
    g: clampByte(blend(pixel.g)),
    b: clampByte(blend(pixel.b)),
    a: pixel.a,
  };
}

/** Validate saturation options. */
export function validateSaturationOptions(opts: SaturationOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.value)) return { error: "Saturation must be a number" };
  if (opts.value < -100 || opts.value > 100) return { error: "Saturation must be between -100 and 100" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
