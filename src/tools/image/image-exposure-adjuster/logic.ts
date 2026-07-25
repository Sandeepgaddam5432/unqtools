/**
 * Image Exposure Adjuster — pure logic. No DOM/canvas access.
 *
 * 10+ extras:
 *   1. Exposure formula (factor = 2^stops)
 *   2. Highlight protection (compress highlights)
 *   3. Shadow protection (lift shadows)
 *   4. Gamma curve post-application
 *   5. Histogram data computation (256-bin RGB)
 *   6. Auto-exposure (mean-luma target)
 *   7. Batch validation
 *   8. Presets (-2, -1, 0, +1, +2 stops, auto)
 *   9. Before/after delta metric
 *  10. EV formatting
 *  11. Per-channel exposure (RGB individual)
 *  12. Identity check
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ExposureOptions {
  /** -5..+5 — exposure stops. */
  stops: number;
  /** Per-channel stop multipliers (1 = no change). */
  channels: { r: number; g: number; b: number };
  /** -100..+100 — highlight protection. */
  highlightProtection: number;
  /** -100..+100 — shadow protection. */
  shadowProtection: number;
  /** 0.1..3.0 — gamma applied after exposure. */
  gamma: number;
}

export const DEFAULT_OPTIONS: ExposureOptions = {
  stops: 0,
  channels: { r: 1, g: 1, b: 1 },
  highlightProtection: 0,
  shadowProtection: 0,
  gamma: 1,
};

export interface ExposurePreset {
  id: string;
  label: string;
  options: ExposureOptions;
}

export const PRESETS: ExposurePreset[] = [
  { id: "minus2", label: "-2 stops", options: { ...DEFAULT_OPTIONS, stops: -2 } },
  { id: "minus1", label: "-1 stop", options: { ...DEFAULT_OPTIONS, stops: -1 } },
  { id: "neutral", label: "Neutral", options: { ...DEFAULT_OPTIONS, stops: 0 } },
  { id: "plus1", label: "+1 stop", options: { ...DEFAULT_OPTIONS, stops: 1 } },
  { id: "plus2", label: "+2 stops", options: { ...DEFAULT_OPTIONS, stops: 2 } },
  { id: "warm", label: "Warm (+R, -B)", options: { ...DEFAULT_OPTIONS, stops: 0.3, channels: { r: 1.1, g: 1, b: 0.9 } } },
  { id: "cool", label: "Cool (-R, +B)", options: { ...DEFAULT_OPTIONS, stops: 0.3, channels: { r: 0.9, g: 1, b: 1.1 } } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Convert stops to a multiplicative exposure factor. */
export function stopsToFactor(stops: number): number {
  return Math.pow(2, stops);
}

/** Apply exposure to a single channel value (no highlight/shadow protection). */
export function applyExposureChannel(value: number, stops: number): number {
  return clampByte(value * stopsToFactor(stops));
}

/** Apply exposure to an RGB pixel (basic, no per-channel or protection). */
export function applyExposure(rgb: { r: number; g: number; b: number }, stops: number): { r: number; g: number; b: number } {
  const f = stopsToFactor(stops);
  return { r: clampByte(rgb.r * f), g: clampByte(rgb.g * f), b: clampByte(rgb.b * f) };
}

/** Highlight protection: compress values above 200 toward 255 smoothly. */
export function highlightProtect(value: number, amount: number): number {
  if (amount === 0) return value;
  const a = clamp(amount, -100, 100) / 100;
  if (value <= 200) return value;
  const t = (value - 200) / 55;
  // Positive amount compresses (reduces), negative expands (boosts).
  const compressed = 200 + 55 * t * (1 - a);
  return compressed;
}

/** Shadow protection: lift values below 56. */
export function shadowProtect(value: number, amount: number): number {
  if (amount === 0) return value;
  const a = clamp(amount, -100, 100) / 100;
  if (value >= 56) return value;
  const t = value / 56;
  // Positive amount lifts shadows, negative deepens.
  return 56 * t + a * (1 - t) * 56;
}

/** Apply gamma to a 0..255 channel value. */
export function applyGamma(value: number, gamma: number): number {
  const g = gamma <= 0 ? 1 : gamma;
  const normalized = value / 255;
  return clampByte(Math.pow(normalized, 1 / g) * 255);
}

/** Apply the full set of exposure adjustments to a pixel. */
export function applyAll(pixel: RgbPixel, opts: ExposureOptions): RgbPixel {
  const baseF = stopsToFactor(opts.stops);
  const r0 = pixel.r * baseF * opts.channels.r;
  const g0 = pixel.g * baseF * opts.channels.g;
  const b0 = pixel.b * baseF * opts.channels.b;
  const r1 = highlightProtect(r0, opts.highlightProtection);
  const g1 = highlightProtect(g0, opts.highlightProtection);
  const b1 = highlightProtect(b0, opts.highlightProtection);
  const r2 = shadowProtect(r1, opts.shadowProtection);
  const g2 = shadowProtect(g1, opts.shadowProtection);
  const b2 = shadowProtect(b1, opts.shadowProtection);
  return {
    r: applyGamma(r2, opts.gamma),
    g: applyGamma(g2, opts.gamma),
    b: applyGamma(b2, opts.gamma),
    a: pixel.a,
  };
}

export function validateExposureOptions(o: ExposureOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(o.stops) || o.stops < -5 || o.stops > 5) {
    return { error: "Stops must be between -5 and +5" };
  }
  if (o.channels.r < 0 || o.channels.r > 4) return { error: "Red channel multiplier out of range" };
  if (o.channels.g < 0 || o.channels.g > 4) return { error: "Green channel multiplier out of range" };
  if (o.channels.b < 0 || o.channels.b > 4) return { error: "Blue channel multiplier out of range" };
  if (o.highlightProtection < -100 || o.highlightProtection > 100) return { error: "Highlight protection must be -100..+100" };
  if (o.shadowProtection < -100 || o.shadowProtection > 100) return { error: "Shadow protection must be -100..+100" };
  if (o.gamma <= 0 || o.gamma > 4) return { error: "Gamma must be > 0 and <= 4" };
  return { ok: true };
}

/** Convert stops to EV (exposure value) string for display. */
export function formatStops(stops: number): string {
  const sign = stops > 0 ? "+" : "";
  return `${sign}${stops.toFixed(2)} EV`;
}

/** Compute a 256-bin histogram for R, G, B channels from pixel data. */
export function computeHistogram(data: Uint8ClampedArray): { r: number[]; g: number[]; b: number[] } {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    r[data[i]!]++;
    g[data[i + 1]!]++;
    b[data[i + 2]!]++;
  }
  return { r, g, b };
}

/** Mean luma of a pixel buffer. */
export function meanLuma(data: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

/** Auto-exposure: compute stops to bring mean luma to target (default 128). */
export function autoExposure(data: Uint8ClampedArray, targetLuma = 128): number {
  const m = meanLuma(data);
  if (m <= 0) return 0;
  const ratio = targetLuma / m;
  return Math.log2(ratio);
}

/** Mean absolute delta between original and adjusted pixel data. */
export function exposureDelta(data: Uint8ClampedArray, opts: ExposureOptions): number {
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const out = applyAll({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }, opts);
    sum += Math.abs(out.r - data[i]!) + Math.abs(out.g - data[i + 1]!) + Math.abs(out.b - data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: ExposureOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateExposureOptions(opts) }));
}

/** True when options produce a no-op. */
export function isIdentity(opts: ExposureOptions): boolean {
  return (
    opts.stops === 0 &&
    opts.channels.r === 1 &&
    opts.channels.g === 1 &&
    opts.channels.b === 1 &&
    opts.highlightProtection === 0 &&
    opts.shadowProtection === 0 &&
    opts.gamma === 1
  );
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 1 : 0.05;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): ExposurePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
