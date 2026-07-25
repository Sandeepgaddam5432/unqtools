/**
 * Image Contrast Adjuster — pure logic. No DOM access.
 */
export interface ContrastOptions {
  /** -100 (gray) to +100 (extreme). */
  value: number;
}

/** Compute the contrast factor for the standard formula. */
export function contrastFactor(value: number): number {
  const v = clamp(value, -100, 100);
  // Standard formula: f = (259 * (c + 255)) / (255 * (259 - c))
  // where c = v * 2.55. We simplify to a clean factor.
  const c = v * 2.55;
  return (259 * (c + 255)) / (255 * (259 - c));
}

/** Apply contrast to a single RGB pixel. */
export function applyContrast(pixel: { r: number; g: number; b: number; a: number }, value: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const f = contrastFactor(value);
  return {
    r: clampByte(f * (pixel.r - 128) + 128),
    g: clampByte(f * (pixel.g - 128) + 128),
    b: clampByte(f * (pixel.b - 128) + 128),
    a: pixel.a,
  };
}

/** Validate contrast options. */
export function validateContrastOptions(opts: ContrastOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.value)) return { error: "Contrast must be a number" };
  if (opts.value < -100 || opts.value > 100) return { error: "Contrast must be between -100 and 100" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
