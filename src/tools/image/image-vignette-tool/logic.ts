/**
 * Image Vignette Tool — pure math. No DOM/canvas access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface VignetteOptions {
  /** 0-100 — strength of darkening. */
  amount: number;
  /** 0-100 — size of unaffected center. 0 = vignette everywhere, 100 = no vignette. */
  size: number;
  /** 0-100 — feathering softness. */
  feather: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Normalized distance from center (0 at center, 1 at corner). */
export function normalizedDistance(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const cx = width / 2;
  const cy = height / 2;
  const dx = (x - cx) / (width / 2);
  const dy = (y - cy) / (height / 2);
  return Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
}

/** Compute vignette multiplier (0-1) for a single pixel. */
export function vignetteFactor(
  x: number,
  y: number,
  width: number,
  height: number,
  opts: VignetteOptions,
): number {
  const d = normalizedDistance(x, y, width, height);
  const inner = clamp(opts.size / 100, 0, 1);
  const feather = clamp(opts.feather / 100, 0.01, 1);
  const amount = clamp(opts.amount / 100, 0, 1);
  // Linear ramp from inner to inner+feather.
  const t = clamp((d - inner) / feather, 0, 1);
  return 1 - amount * t;
}

/** Apply vignette to a single pixel. */
export function applyVignette(
  pixel: RgbPixel,
  factor: number,
): RgbPixel {
  return {
    r: clampByte(pixel.r * factor),
    g: clampByte(pixel.g * factor),
    b: clampByte(pixel.b * factor),
    a: pixel.a,
  };
}

export function validateVignetteOptions(opts: VignetteOptions): { ok: true } | { error: string } {
  if (opts.amount < 0 || opts.amount > 100) return { error: "Amount must be 0-100" };
  if (opts.size < 0 || opts.size > 100) return { error: "Size must be 0-100" };
  if (opts.feather < 0 || opts.feather > 100) return { error: "Feather must be 0-100" };
  return { ok: true };
}
