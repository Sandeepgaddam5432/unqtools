/**
 * Image Posterize Tool — pure level quantization math. No DOM/canvas access.
 */
export interface PosterizeOptions {
  /** Number of levels per channel (2-256). */
  levels: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Quantize a single 8-bit channel value to N levels. */
export function quantize(value: number, levels: number): number {
  if (levels <= 1) return 0;
  const l = clamp(Math.floor(levels), 1, 256);
  if (l >= 256) return clampByte(value);
  const step = 255 / (l - 1);
  const q = Math.round(clampByte(value) / step) * step;
  return clampByte(q);
}

/** Posterize a single RGB pixel. */
export function posterizePixel(
  pixel: { r: number; g: number; b: number; a: number },
  levels: number,
): { r: number; g: number; b: number; a: number } {
  return {
    r: quantize(pixel.r, levels),
    g: quantize(pixel.g, levels),
    b: quantize(pixel.b, levels),
    a: pixel.a,
  };
}

/** Compute the palette of unique values for a given level count. */
export function paletteForLevels(levels: number): number[] {
  const l = clamp(Math.floor(levels), 1, 256);
  if (l <= 1) return [0];
  const step = 255 / (l - 1);
  const out: number[] = [];
  for (let i = 0; i < l; i++) out.push(clampByte(i * step));
  return out;
}

export function validatePosterizeOptions(opts: PosterizeOptions): { ok: true } | { error: string } {
  if (!Number.isInteger(opts.levels) || opts.levels < 2 || opts.levels > 256) {
    return { error: "Levels must be an integer 2-256" };
  }
  return { ok: true };
}
