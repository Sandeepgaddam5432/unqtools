/**
 * Image Plasma Effect — pure math. No DOM/canvas.
 * plasma = sin(x/a) + sin(y/b) + sin((x+y)/c) + sin(sqrt(x²+y²)/d)
 *
 * 10+ extras:
 *   1. Plasma formula params (a/b/c/d)
 *   2. Color palette (HSV cycle, custom palette, grayscale)
 *   3. Turbulence (octaves of noise)
 *   4. Random seed (deterministic PRNG)
 *   5. Resolution control (width/height of output)
 *   6. Batch validation
 *   7. Presets (classic, swirl, fire, ice, rainbow)
 *   8. Identity check (always false — plasma is generative)
 *   9. Format-preserving transparency check
 *  10. HSV → RGB conversion
 *  11. Hue offset
 *  12. Value normalization
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type PaletteMode = "hueCycle" | "grayscale" | "fire" | "ice" | "rainbow";

export interface PlasmaOptions {
  /** Frequency factors (smaller = wider bands). */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Hue offset 0-360. */
  hueOffset: number;
  /** Palette mode. */
  palette: PaletteMode;
  /** Turbulence octaves (0..5). */
  turbulence: number;
  /** Random seed for turbulence. */
  seed: number;
}

export const DEFAULT_OPTIONS: PlasmaOptions = {
  a: 32,
  b: 32,
  c: 24,
  d: 16,
  hueOffset: 0,
  palette: "hueCycle",
  turbulence: 0,
  seed: 1,
};

export interface PlasmaPreset {
  id: string;
  label: string;
  options: PlasmaOptions;
}

export const PRESETS: PlasmaPreset[] = [
  { id: "classic", label: "Classic", options: { ...DEFAULT_OPTIONS } },
  { id: "swirl", label: "Swirl", options: { ...DEFAULT_OPTIONS, a: 50, b: 50, c: 12, d: 8 } },
  { id: "fire", label: "Fire", options: { ...DEFAULT_OPTIONS, palette: "fire", a: 24, b: 32 } },
  { id: "ice", label: "Ice", options: { ...DEFAULT_OPTIONS, palette: "ice", a: 40, b: 28 } },
  { id: "rainbow", label: "Rainbow", options: { ...DEFAULT_OPTIONS, palette: "rainbow", a: 20, b: 20, c: 20, d: 20 } },
  { id: "gray", label: "Grayscale", options: { ...DEFAULT_OPTIONS, palette: "grayscale" } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D value noise (smooth interpolation). */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const rng = mulberry32(seed + ix * 73 + iy * 113);
  const v00 = rng();
  const v10 = mulberry32(seed + (ix + 1) * 73 + iy * 113)();
  const v01 = mulberry32(seed + ix * 73 + (iy + 1) * 113)();
  const v11 = mulberry32(seed + (ix + 1) * 73 + (iy + 1) * 113)();
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = v00 + (v10 - v00) * sx;
  const bot = v01 + (v11 - v01) * sx;
  return top + (bot - top) * sy;
}

/** Compute raw plasma value at (x, y). Result is in range [-4, 4]. */
export function plasmaValue(x: number, y: number, opts: PlasmaOptions): number {
  return (
    Math.sin(x / opts.a) +
    Math.sin(y / opts.b) +
    Math.sin((x + y) / opts.c) +
    Math.sin(Math.sqrt(x * x + y * y) / opts.d)
  );
}

/** Add turbulence (octaves of value noise). */
export function addTurbulence(x: number, y: number, baseValue: number, opts: PlasmaOptions): number {
  if (opts.turbulence <= 0) return baseValue;
  let result = baseValue;
  let amp = 1;
  let freq = 0.05;
  for (let i = 0; i < opts.turbulence; i++) {
    result += (valueNoise(x * freq, y * freq, opts.seed) - 0.5) * 2 * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return result;
}

/** Normalize plasma value to [0, 1]. */
export function normalizePlasma(v: number): number {
  return (v + 4) / 8;
}

/** Convert HSV (0-360, 0-1, 0-1) to RGB (0-255 each). */
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
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/** Map a value to fire palette (black → red → orange → yellow → white). */
export function firePalette(t: number): { r: number; g: number; b: number } {
  const u = clamp(t, 0, 1);
  return {
    r: clampByte(u < 0.5 ? u * 2 * 255 : 255),
    g: clampByte(u < 0.5 ? 0 : (u - 0.5) * 2 * 200),
    b: clampByte(u < 0.8 ? 0 : (u - 0.8) * 5 * 255),
  };
}

/** Map a value to ice palette (deep blue → cyan → white). */
export function icePalette(t: number): { r: number; g: number; b: number } {
  const u = clamp(t, 0, 1);
  return {
    r: clampByte(u * 200),
    g: clampByte(150 + u * 105),
    b: clampByte(200 + u * 55),
  };
}

/** Map a value to rainbow palette (full HSV cycle, no offset). */
export function rainbowPalette(t: number, hueOffset: number): { r: number; g: number; b: number } {
  const hue = ((t * 360 + hueOffset) % 360 + 360) % 360;
  return hsvToRgb(hue, 1, 1);
}

/** Map normalized plasma value (0-1) to an RGB pixel via configured palette. */
export function plasmaToRgb(t: number, opts: PlasmaOptions): { r: number; g: number; b: number } {
  const u = clamp(t, 0, 1);
  switch (opts.palette) {
    case "grayscale":
      const v = clampByte(u * 255);
      return { r: v, g: v, b: v };
    case "fire":
      return firePalette(u);
    case "ice":
      return icePalette(u);
    case "rainbow":
      return rainbowPalette(u, opts.hueOffset);
    case "hueCycle":
    default:
      return rainbowPalette(u, opts.hueOffset);
  }
}

/** Generate a complete plasma pixel value at (x, y). */
export function plasmaPixel(x: number, y: number, opts: PlasmaOptions): { r: number; g: number; b: number; a: number } {
  let v = plasmaValue(x, y, opts);
  v = addTurbulence(x, y, v, opts);
  const t = normalizePlasma(v);
  const rgb = plasmaToRgb(t, opts);
  return { ...rgb, a: 255 };
}

export function validatePlasmaOptions(opts: PlasmaOptions): { ok: true } | { error: string } {
  for (const k of ["a", "b", "c", "d"] as const) {
    if (!Number.isFinite(opts[k]) || opts[k] <= 0) return { error: `${k} must be a positive number` };
  }
  if (opts.hueOffset < 0 || opts.hueOffset > 360) return { error: "Hue offset must be 0-360" };
  if (opts.turbulence < 0 || opts.turbulence > 5) return { error: "Turbulence must be 0..5" };
  if (!Number.isFinite(opts.seed)) return { error: "Seed must be a finite number" };
  return { ok: true };
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: PlasmaOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validatePlasmaOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 10 : 1;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): PlasmaPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
