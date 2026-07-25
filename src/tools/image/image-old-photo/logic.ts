/**
 * Image Old Photo — pure math. No DOM/canvas.
 * Combines sepia + vignette + grain.
 */
export interface RgbPixel { r: number; g: number; b: number; a: number; }

export interface OldPhotoOptions {
  /** Sepia strength 0-1. */
  sepia: number;
  /** Vignette strength 0-1. */
  vignette: number;
  /** Grain strength 0-1. */
  grain: number;
  /** Vignette radius (0-1 normalized). */
  vignetteRadius: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Standard W3C sepia matrix. */
export const SEPIA = {
  rr: 0.393, rg: 0.769, rb: 0.189,
  gr: 0.349, gg: 0.686, gb: 0.168,
  br: 0.272, bg: 0.534, bb: 0.131,
};

/** Apply sepia transformation scaled by strength. */
export function applySepia(p: RgbPixel, strength: number): RgbPixel {
  const s = clamp(strength, 0, 1);
  const sr = SEPIA.rr * p.r + SEPIA.rg * p.g + SEPIA.rb * p.b;
  const sg = SEPIA.gr * p.r + SEPIA.gg * p.g + SEPIA.gb * p.b;
  const sb = SEPIA.br * p.r + SEPIA.bg * p.g + SEPIA.bb * p.b;
  const blend = (orig: number, sep: number) => orig + (sep - orig) * s;
  return { r: clampByte(blend(p.r, sr)), g: clampByte(blend(p.g, sg)), b: clampByte(blend(p.b, sb)), a: p.a };
}

/** Compute vignette multiplier (0-1) at a position. */
export function vignetteFactor(x: number, y: number, w: number, h: number, strength: number, radius: number): number {
  const cx = w / 2, cy = h / 2;
  const dx = (x - cx) / (w / 2);
  const dy = (y - cy) / (h / 2);
  const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
  const inner = clamp(radius, 0, 1);
  const t = clamp((d - inner) / (1 - inner || 1), 0, 1);
  return 1 - clamp(strength, 0, 1) * t;
}

/** Add grain noise (offset by `n` in [-1,1]). */
export function applyGrain(p: RgbPixel, n: number, strength: number): RgbPixel {
  const s = clamp(strength, 0, 1) * 60; // max ±60 luminance
  const delta = n * s;
  return {
    r: clampByte(p.r + delta),
    g: clampByte(p.g + delta),
    b: clampByte(p.b + delta),
    a: p.a,
  };
}

/** Full old-photo pipeline for one pixel. */
export function oldPhotoPixel(p: RgbPixel, x: number, y: number, w: number, h: number, noise: number, opts: OldPhotoOptions): RgbPixel {
  const sep = applySepia(p, opts.sepia);
  const vig = vignetteFactor(x, y, w, h, opts.vignette, opts.vignetteRadius);
  const dark = { r: sep.r * vig, g: sep.g * vig, b: sep.b * vig, a: sep.a };
  return applyGrain({ r: dark.r, g: dark.g, b: dark.b, a: dark.a }, noise, opts.grain);
}

/** Mulberry32 PRNG for deterministic grain. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function validateOldPhotoOptions(opts: OldPhotoOptions): { ok: true } | { error: string } {
  if (opts.sepia < 0 || opts.sepia > 1) return { error: "Sepia must be 0-1" };
  if (opts.vignette < 0 || opts.vignette > 1) return { error: "Vignette must be 0-1" };
  if (opts.grain < 0 || opts.grain > 1) return { error: "Grain must be 0-1" };
  if (opts.vignetteRadius < 0 || opts.vignetteRadius > 1) return { error: "Vignette radius must be 0-1" };
  return { ok: true };
}
