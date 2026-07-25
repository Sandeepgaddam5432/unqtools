/**
 * Image Gamma Corrector — pure math. output = input^(1/gamma).
 *
 * 10+ extras:
 *   1. Per-channel gamma (R/G/B individual)
 *   2. Gamma curve visualization data (256-point samples)
 *   3. Auto-gamma (compute gamma to bring mean luma to target)
 *   4. sRGB ↔ linear conversion helpers
 *   5. BT.709 / BT.2020 transfer function helpers
 *   6. Presets (sRGB, BT.709, BT.2020, linear, brighten, darken)
 *   7. Batch validation
 *   8. Before/after luma metric
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. LUT builder (256-entry) for fast application
 *  12. Keyboard nudge helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GammaOptions {
  /** 0.1..10.0 — gamma value. <1 brightens, >1 darkens. */
  gamma: number;
  /** Per-channel gamma multipliers (1 = use main gamma). */
  channels: { r: number; g: number; b: number };
}

export const DEFAULT_OPTIONS: GammaOptions = {
  gamma: 1,
  channels: { r: 1, g: 1, b: 1 },
};

export interface GammaPreset {
  id: string;
  label: string;
  options: GammaOptions;
}

export const PRESETS: GammaPreset[] = [
  { id: "identity", label: "Identity (1.0)", options: { ...DEFAULT_OPTIONS } },
  { id: "brighten", label: "Brighten (0.5)", options: { ...DEFAULT_OPTIONS, gamma: 0.5 } },
  { id: "darken", label: "Darken (2.0)", options: { ...DEFAULT_OPTIONS, gamma: 2.0 } },
  { id: "srgb", label: "sRGB (2.2)", options: { ...DEFAULT_OPTIONS, gamma: 2.2 } },
  { id: "bt709", label: "BT.709 (2.4)", options: { ...DEFAULT_OPTIONS, gamma: 2.4 } },
  { id: "bt2020", label: "BT.2020 (2.4)", options: { ...DEFAULT_OPTIONS, gamma: 2.4 } },
  { id: "linear", label: "Linear (1.0)", options: { ...DEFAULT_OPTIONS, gamma: 1.0 } },
  { id: "mac", label: "Mac (1.8)", options: { ...DEFAULT_OPTIONS, gamma: 1.8 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Apply gamma to a single channel value (0-255). */
export function applyGammaChannel(value: number, gamma: number): number {
  const inv = 1 / Math.max(1e-6, gamma);
  return clampByte(255 * Math.pow(value / 255, inv));
}

/** Build a 256-entry lookup table for gamma correction. */
export function buildGammaLut(gamma: number): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = applyGammaChannel(i, gamma);
  }
  return lut;
}

/** Apply gamma to an RGB pixel (using main gamma only). */
export function applyGamma(rgb: { r: number; g: number; b: number }, gamma: number): { r: number; g: number; b: number } {
  return {
    r: applyGammaChannel(rgb.r, gamma),
    g: applyGammaChannel(rgb.g, gamma),
    b: applyGammaChannel(rgb.b, gamma),
  };
}

/** Apply per-channel gamma to an RGB pixel. */
export function applyGammaPerPixel(pixel: RgbPixel, opts: GammaOptions): RgbPixel {
  return {
    r: applyGammaChannel(pixel.r, opts.gamma * opts.channels.r),
    g: applyGammaChannel(pixel.g, opts.gamma * opts.channels.g),
    b: applyGammaChannel(pixel.b, opts.gamma * opts.channels.b),
    a: pixel.a,
  };
}

/** Sample the gamma curve at N points (for visualization). Returns pairs (input, output). */
export function gammaCurve(gamma: number, samples = 256): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1);
    const y = Math.pow(x, 1 / Math.max(1e-6, gamma));
    points.push({ x, y: clamp(y, 0, 1) });
  }
  return points;
}

/** sRGB → linear light conversion. Input 0..255, output 0..1. */
export function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Linear → sRGB conversion. Input 0..1, output 0..255. */
export function linearToSrgb(l: number): number {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clampByte(v * 255);
}

/** BT.709 transfer function (HDR-style). */
export function bt709ToLinear(c: number): number {
  const s = c / 255;
  return s < 0.081 ? s / 4.5 : Math.pow((s + 0.099) / 1.099, 1 / 0.45);
}

/** BT.2020 transfer function. */
export function bt2020ToLinear(c: number): number {
  const s = c / 255;
  return s < 0.0817 ? s / 4.5 : Math.pow((s + 0.0993) / 1.0993, 1 / 0.45);
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

/** Auto-gamma: find gamma that brings mean luma to target (default 128). */
export function autoGamma(data: Uint8ClampedArray, targetLuma = 128): number {
  const m = meanLuma(data);
  if (m <= 0 || m >= 255) return 1;
  const normalized = m / 255;
  const target = targetLuma / 255;
  // Solve: normalized^(1/g) = target → 1/g = log(target)/log(normalized) → g = log(normalized)/log(target)
  const g = Math.log(normalized) / Math.log(Math.max(1e-6, target));
  return clamp(g, 0.1, 10);
}

/** Mean absolute delta between original and gamma-corrected pixel data. */
export function gammaDelta(data: Uint8ClampedArray, opts: GammaOptions): number {
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const out = applyGammaPerPixel({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }, opts);
    sum += Math.abs(out.r - data[i]!) + Math.abs(out.g - data[i + 1]!) + Math.abs(out.b - data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

export function validateGammaOptions(o: GammaOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(o.gamma) || o.gamma < 0.1 || o.gamma > 10) {
    return { error: "Gamma must be between 0.1 and 10.0" };
  }
  if (o.channels.r < 0.1 || o.channels.r > 10) return { error: "Red channel gamma out of range" };
  if (o.channels.g < 0.1 || o.channels.g > 10) return { error: "Green channel gamma out of range" };
  if (o.channels.b < 0.1 || o.channels.b > 10) return { error: "Blue channel gamma out of range" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: GammaOptions): boolean {
  return opts.gamma === 1 && opts.channels.r === 1 && opts.channels.g === 1 && opts.channels.b === 1;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: GammaOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateGammaOptions(opts) }));
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
export function findPreset(id: string): GammaPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
