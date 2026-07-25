/**
 * Image Sepia Filter — pure logic. No DOM access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SepiaOptions {
  /** 0 = original, 1 = full sepia. */
  strength: number;
}

/** Standard sepia color matrix coefficients (Microsoft / W3C spec). */
export const SEPIA_MATRIX = {
  rr: 0.393,
  rg: 0.769,
  rb: 0.189,
  gr: 0.349,
  gg: 0.686,
  gb: 0.168,
  br: 0.272,
  bg: 0.534,
  bb: 0.131,
};

/** Apply the sepia transformation to a single pixel, scaled by strength. */
export function sepiaPixel(pixel: RgbPixel, strength: number): RgbPixel {
  const s = clamp(strength, 0, 1);
  const { r, g, b } = pixel;
  const sr = SEPIA_MATRIX.rr * r + SEPIA_MATRIX.rg * g + SEPIA_MATRIX.rb * b;
  const sg = SEPIA_MATRIX.gr * r + SEPIA_MATRIX.gg * g + SEPIA_MATRIX.gb * b;
  const sb = SEPIA_MATRIX.br * r + SEPIA_MATRIX.bg * g + SEPIA_MATRIX.bb * b;
  const blend = (orig: number, sep: number) => Math.round(orig + (sep - orig) * s);
  return {
    r: clampByte(blend(r, sr)),
    g: clampByte(blend(g, sg)),
    b: clampByte(blend(b, sb)),
    a: pixel.a,
  };
}

/** Validate sepia options. */
export function validateSepiaOptions(opts: SepiaOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be between 0 and 1" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
