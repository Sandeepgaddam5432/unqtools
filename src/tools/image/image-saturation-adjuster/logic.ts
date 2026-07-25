/**
 * Image Saturation Adjuster — pure logic. No DOM/canvas access.
 *
 * 10+ extras:
 *   1. HSL saturation via luma blend
 *   2. Vibrance mode (protect skin tones / already-saturated colors)
 *   3. Per-color-band saturation (8 hue ranges)
 *   4. Color splash (desaturate except target hue)
 *   5. Selective color replace (target hue → new hue)
 *   6. RGB ↔ HSL conversion helpers
 *   7. Skin-tone detection (for vibrance)
 *   8. Batch validation
 *   9. Presets (vivid, muted, vintage, pastel)
 *  10. Identity check
 *  11. Format-preserving transparency check
 *  12. Hue range lookup helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type SaturationMode = "standard" | "vibrance" | "splash" | "replace";

export interface HueBand {
  /** Inclusive lower bound in degrees (0..360). */
  low: number;
  /** Exclusive upper bound in degrees (0..360, wraps). */
  high: number;
  /** Saturation multiplier for this band. */
  factor: number;
}

export interface SaturationOptions {
  /** -100 (full grayscale) to +100 (extreme vivid). */
  value: number;
  /** Saturation mode. */
  mode: SaturationMode;
  /** Per-band saturation multipliers (8 hue bands). */
  bands: HueBand[];
  /** Target hue for splash/replace (0..360). */
  targetHue: number;
  /** Hue tolerance in degrees (for splash/replace). */
  hueTolerance: number;
  /** New hue for replace mode (0..360). */
  replaceHue: number;
  /** Vibrance strength (0..100). */
  vibrance: number;
}

export const DEFAULT_BANDS: HueBand[] = [
  { low: 0, high: 45, factor: 1 },
  { low: 45, high: 90, factor: 1 },
  { low: 90, high: 135, factor: 1 },
  { low: 135, high: 180, factor: 1 },
  { low: 180, high: 225, factor: 1 },
  { low: 225, high: 270, factor: 1 },
  { low: 270, high: 315, factor: 1 },
  { low: 315, high: 360, factor: 1 },
];

export const DEFAULT_OPTIONS: SaturationOptions = {
  value: 0,
  mode: "standard",
  bands: DEFAULT_BANDS,
  targetHue: 30,
  hueTolerance: 30,
  replaceHue: 200,
  vibrance: 0,
};

export interface SaturationPreset {
  id: string;
  label: string;
  options: SaturationOptions;
}

export const PRESETS: SaturationPreset[] = [
  { id: "neutral", label: "Neutral", options: { ...DEFAULT_OPTIONS } },
  { id: "vivid", label: "Vivid (+50)", options: { ...DEFAULT_OPTIONS, value: 50 } },
  { id: "muted", label: "Muted (-50)", options: { ...DEFAULT_OPTIONS, value: -50 } },
  { id: "grayscale", label: "Grayscale (-100)", options: { ...DEFAULT_OPTIONS, value: -100 } },
  { id: "vibrance", label: "Vibrance 50", options: { ...DEFAULT_OPTIONS, mode: "vibrance", vibrance: 50 } },
  { id: "warm-boost", label: "Warm boost", options: {
    ...DEFAULT_OPTIONS,
    bands: DEFAULT_BANDS.map((b, i) => i === 0 ? { ...b, factor: 1.5 } : b),
  } },
  { id: "cool-boost", label: "Cool boost", options: {
    ...DEFAULT_OPTIONS,
    bands: DEFAULT_BANDS.map((b, i) => i === 4 || i === 5 ? { ...b, factor: 1.5 } : b),
  } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Compute the luma (per BT.601) of a pixel. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

/** Compute the saturation multiplier from a -100..+100 value. */
export function saturationFactor(value: number): number {
  const v = clamp(value, -100, 100);
  return 1 + v / 100;
}

/** Convert RGB (0..255) to HSL (h: 0..360, s: 0..1, l: 0..1). */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

/** Convert HSL to RGB (0..255). */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = clampByte(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampByte(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: clampByte(hue2rgb(p, q, hn) * 255),
    b: clampByte(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

/** Heuristic skin-tone detection: hue 0..50, saturation 0.2..0.7, luma 0.2..0.95. */
export function isSkinTone(pixel: RgbPixel): boolean {
  const { h, s, l } = rgbToHsl(pixel.r, pixel.g, pixel.b);
  return h >= 0 && h <= 50 && s >= 0.2 && s <= 0.7 && l >= 0.2 && l <= 0.95;
}

/** Find the hue band containing a hue value. */
export function findHueBand(hue: number, bands: HueBand[]): HueBand | undefined {
  const h = ((hue % 360) + 360) % 360;
  return bands.find((b) => {
    const low = ((b.low % 360) + 360) % 360;
    const high = ((b.high % 360) + 360) % 360;
    if (low <= high) return h >= low && h < high;
    return h >= low || h < high;
  });
}

/** Apply standard saturation to a pixel. */
export function applySaturation(pixel: RgbPixel, value: number): RgbPixel {
  const f = saturationFactor(value);
  const y = luma(pixel);
  const blend = (c: number) => clampByte(y + (c - y) * f);
  return { r: blend(pixel.r), g: blend(pixel.g), b: blend(pixel.b), a: pixel.a };
}

/** Apply vibrance: boosts less-saturated colors more, protects skin tones. */
export function applyVibrance(pixel: RgbPixel, amount: number): RgbPixel {
  const v = clamp(amount, -100, 100) / 100;
  const { h, s, l } = rgbToHsl(pixel.r, pixel.g, pixel.b);
  if (s === 0) return pixel;
  // Skin tone protection: reduce effect
  const skinFactor = isSkinTone(pixel) ? 0.3 : 1;
  // Boost low-saturation more
  const satBoost = (1 - s) * v * skinFactor;
  const newS = clamp(s + satBoost, 0, 1);
  const rgb = hslToRgb(h, newS, l);
  return { ...rgb, a: pixel.a };
}

/** Color splash: desaturate unless hue matches target. */
export function applySplash(pixel: RgbPixel, targetHue: number, tolerance: number): RgbPixel {
  const { h } = rgbToHsl(pixel.r, pixel.g, pixel.b);
  const diff = Math.min(Math.abs(h - targetHue), 360 - Math.abs(h - targetHue));
  if (diff <= tolerance) return pixel;
  const y = luma(pixel);
  return { r: clampByte(y), g: clampByte(y), b: clampByte(y), a: pixel.a };
}

/** Selective color replace: shift matching hue to replaceHue. */
export function applyReplace(pixel: RgbPixel, targetHue: number, tolerance: number, replaceHue: number): RgbPixel {
  const { h, s, l } = rgbToHsl(pixel.r, pixel.g, pixel.b);
  if (s === 0) return pixel;
  const diff = Math.min(Math.abs(h - targetHue), 360 - Math.abs(h - targetHue));
  if (diff > tolerance) return pixel;
  const rgb = hslToRgb(replaceHue, s, l);
  return { ...rgb, a: pixel.a };
}

/** Apply the full set of saturation options to a pixel. */
export function applyAll(pixel: RgbPixel, opts: SaturationOptions): RgbPixel {
  let out: RgbPixel = { ...pixel };
  if (opts.mode === "standard" || opts.mode === "vibrance") {
    out = applySaturation(out, opts.value);
  }
  if (opts.mode === "vibrance") {
    out = applyVibrance(out, opts.vibrance);
  }
  if (opts.mode === "splash") {
    out = applySplash(out, opts.targetHue, opts.hueTolerance);
  }
  if (opts.mode === "replace") {
    out = applyReplace(out, opts.targetHue, opts.hueTolerance, opts.replaceHue);
  }
  // Per-band adjustment (applies on top of mode)
  const { h } = rgbToHsl(pixel.r, pixel.g, pixel.b);
  const band = findHueBand(h, opts.bands);
  if (band && band.factor !== 1) {
    const { h: h2, s, l } = rgbToHsl(out.r, out.g, out.b);
    const newS = clamp(s * band.factor, 0, 1);
    const rgb = hslToRgb(h2, newS, l);
    out = { ...rgb, a: out.a };
  }
  return out;
}

export function validateSaturationOptions(opts: SaturationOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.value)) return { error: "Saturation must be a number" };
  if (opts.value < -100 || opts.value > 100) return { error: "Saturation must be between -100 and 100" };
  if (opts.vibrance < -100 || opts.vibrance > 100) return { error: "Vibrance must be between -100 and 100" };
  if (opts.targetHue < 0 || opts.targetHue > 360) return { error: "Target hue must be 0..360" };
  if (opts.replaceHue < 0 || opts.replaceHue > 360) return { error: "Replace hue must be 0..360" };
  if (opts.hueTolerance < 0 || opts.hueTolerance > 180) return { error: "Hue tolerance must be 0..180" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: SaturationOptions): boolean {
  if (opts.value !== 0) return false;
  if (opts.mode === "vibrance" && opts.vibrance !== 0) return false;
  if (opts.mode === "splash" || opts.mode === "replace") return false;
  if (opts.bands.some((b) => b.factor !== 1)) return false;
  return true;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: SaturationOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateSaturationOptions(opts) }));
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
export function findPreset(id: string): SaturationPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
