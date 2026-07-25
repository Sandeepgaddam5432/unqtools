/**
 * Image Color Inverter — pure logic. No DOM access.
 */
export interface InvertOptions {
  /** 0 = no inversion, 1 = full inversion. */
  strength: number;
}

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Invert a single RGB pixel using the formula 255 - c, scaled by strength. */
export function invertPixel(pixel: RgbPixel, strength: number): RgbPixel {
  const s = clamp(strength, 0, 1);
  const inv = (c: number) => Math.round(c + (255 - 2 * c) * s);
  return {
    r: clampByte(inv(pixel.r)),
    g: clampByte(inv(pixel.g)),
    b: clampByte(inv(pixel.b)),
    a: pixel.a,
  };
}

/** Validate invert options. */
export function validateInvertOptions(opts: InvertOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be between 0 and 1" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
