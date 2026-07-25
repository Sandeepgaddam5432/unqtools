/**
 * Image Rainbow Noise — pure math. No DOM/canvas.
 * Random RGB noise per pixel blended with a rainbow gradient.
 */
export interface RainbowNoiseOptions {
  /** Noise strength 0-1. */
  strength: number;
  /** Rainbow hue offset 0-360. */
  hueOffset: number;
  /** Rainbow frequency (pixels per cycle). */
  frequency: number;
}

/** Mulberry32 seeded PRNG. Returns a function that yields values in [0,1). */
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

/** Compute rainbow hue at a position. */
export function rainbowHue(x: number, y: number, opts: RainbowNoiseOptions): number {
  const phase = ((x + y) / opts.frequency) * 360 + opts.hueOffset;
  return ((phase % 360) + 360) % 360;
}

/** HSV (0-360, 0-1, 0-1) → RGB (0-255). */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return { r: Math.round((rp + m) * 255), g: Math.round((gp + m) * 255), b: Math.round((bp + m) * 255) };
}

/** Generate random noise triple in [0, 255]. */
export function randomNoise(rng: () => number): { r: number; g: number; b: number } {
  return {
    r: Math.floor(rng() * 256),
    g: Math.floor(rng() * 256),
    b: Math.floor(rng() * 256),
  };
}

/** Blend a base color with noise by strength (0 = base, 1 = full noise). */
export function blendWithNoise(base: { r: number; g: number; b: number }, noise: { r: number; g: number; b: number }, strength: number): { r: number; g: number; b: number } {
  const s = Math.max(0, Math.min(1, strength));
  return {
    r: Math.round(base.r * (1 - s) + noise.r * s),
    g: Math.round(base.g * (1 - s) + noise.g * s),
    b: Math.round(base.b * (1 - s) + noise.b * s),
  };
}

export function validateRainbowNoiseOptions(opts: RainbowNoiseOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be 0-1" };
  if (opts.hueOffset < 0 || opts.hueOffset > 360) return { error: "Hue offset must be 0-360" };
  if (opts.frequency <= 0) return { error: "Frequency must be positive" };
  return { ok: true };
}
