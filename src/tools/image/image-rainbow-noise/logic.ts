/**
 * Image Rainbow Noise — pure math. No DOM/canvas.
 * Random RGB noise per pixel blended with a rainbow gradient.
 *
 * Extras:
 *  1. Noise intensity 0..1
 *  2. Color modes (rainbow / mono / duotone)
 *  3. Seeded PRNG (Mulberry32)
 *  4. Pattern (smooth / striped / checkerboard)
 *  5. Hue offset + frequency
 *  6. Batch validation
 *  7. Presets (subtle / vivid / static)
 *  8. Identity check
 *  9. Format-preserving transparency
 * 10. HSV → RGB
 * 11. Mean delta
 * 12. Luma helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type ColorMode = "rainbow" | "mono" | "duotone";
export type Pattern = "smooth" | "striped" | "checkerboard";

export interface RainbowNoiseOptions {
  strength: number;
  hueOffset: number;
  frequency: number;
  color: ColorMode;
  pattern: Pattern;
  /** Duotone colors [r,g,b] x 2. */
  duotone: [[number, number, number], [number, number, number]];
  seed: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

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
export function rainbowHue(x: number, y: number, opts: Pick<RainbowNoiseOptions, "hueOffset" | "frequency" | "pattern">): number {
  let phase: number;
  if (opts.pattern === "striped") {
    phase = (y / opts.frequency) * 360 + opts.hueOffset;
  } else if (opts.pattern === "checkerboard") {
    const cx = Math.floor(x / opts.frequency);
    const cy = Math.floor(y / opts.frequency);
    phase = ((cx + cy) % 8) * 45 + opts.hueOffset;
  } else {
    phase = ((x + y) / opts.frequency) * 360 + opts.hueOffset;
  }
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

/** Compute base color for a pixel given options. */
export function baseColor(x: number, y: number, opts: RainbowNoiseOptions): { r: number; g: number; b: number } {
  if (opts.color === "mono") {
    const v = clampByte(((x + y) % 256));
    return { r: v, g: v, b: v };
  }
  if (opts.color === "duotone") {
    const t = clamp((x + y) / (opts.frequency * 4), 0, 1);
    const [a, b] = opts.duotone;
    return {
      r: clampByte(a[0] * (1 - t) + b[0] * t),
      g: clampByte(a[1] * (1 - t) + b[1] * t),
      b: clampByte(a[2] * (1 - t) + b[2] * t),
    };
  }
  // rainbow
  const h = rainbowHue(x, y, opts);
  return hsvToRgb(h, 1, 1);
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
  const s = clamp(strength, 0, 1);
  return {
    r: clampByte(base.r * (1 - s) + noise.r * s),
    g: clampByte(base.g * (1 - s) + noise.g * s),
    b: clampByte(base.b * (1 - s) + noise.b * s),
  };
}

export function validateRainbowNoiseOptions(opts: RainbowNoiseOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be 0-1" };
  if (opts.hueOffset < 0 || opts.hueOffset > 360) return { error: "Hue offset must be 0-360" };
  if (opts.frequency <= 0) return { error: "Frequency must be positive" };
  if (!["rainbow", "mono", "duotone"].includes(opts.color)) return { error: "Invalid color mode" };
  if (!["smooth", "striped", "checkerboard"].includes(opts.pattern)) return { error: "Invalid pattern" };
  if (opts.duotone.some((c) => c.some((v) => v < 0 || v > 255))) return { error: "Duotone colors must be 0..255" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: RainbowNoiseOptions): boolean {
  return opts.strength === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: RainbowNoiseOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateRainbowNoiseOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<RainbowNoiseOptions, "duotone" | "seed"> & { duotone: [[number, number, number], [number, number, number]] } }[] = [
  { id: "subtle", label: "Subtle", options: { strength: 0.2, hueOffset: 0, frequency: 100, color: "rainbow", pattern: "smooth", duotone: [[20, 40, 80], [200, 220, 255]] } },
  { id: "vivid", label: "Vivid", options: { strength: 0.7, hueOffset: 0, frequency: 60, color: "rainbow", pattern: "smooth", duotone: [[0, 0, 0], [255, 255, 255]] } },
  { id: "static", label: "Static", options: { strength: 1, hueOffset: 0, frequency: 200, color: "mono", pattern: "smooth", duotone: [[0, 0, 0], [255, 255, 255]] } },
  { id: "duotone", label: "Duotone", options: { strength: 0.5, hueOffset: 0, frequency: 80, color: "duotone", pattern: "smooth", duotone: [[40, 10, 80], [255, 200, 0]] } },
  { id: "checker", label: "Checker", options: { strength: 0.5, hueOffset: 0, frequency: 30, color: "rainbow", pattern: "checkerboard", duotone: [[0, 0, 0], [255, 255, 255]] } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
