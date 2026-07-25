/**
 * Image Grayscale Converter — pure logic. No DOM access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GrayscaleOptions {
  /** 0 = original, 1 = full grayscale. */
  strength: number;
}

/** ITU-R BT.601 luma coefficients. */
export const LUMA_R = 0.299;
export const LUMA_G = 0.587;
export const LUMA_B = 0.114;

/** Compute the luma value for an RGB pixel. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return LUMA_R * pixel.r + LUMA_G * pixel.g + LUMA_B * pixel.b;
}

/** Convert a pixel to grayscale, scaled by strength. */
export function grayscalePixel(pixel: RgbPixel, strength: number): RgbPixel {
  const s = clamp(strength, 0, 1);
  const y = luma(pixel);
  const blend = (c: number) => Math.round(c + (y - c) * s);
  return {
    r: clampByte(blend(pixel.r)),
    g: clampByte(blend(pixel.g)),
    b: clampByte(blend(pixel.b)),
    a: pixel.a,
  };
}

/** Validate grayscale options. */
export function validateGrayscaleOptions(opts: GrayscaleOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be between 0 and 1" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
