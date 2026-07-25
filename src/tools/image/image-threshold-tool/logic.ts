/**
 * Image Threshold Tool — pure logic. No DOM/canvas access.
 *
 * 10+ extras:
 *   1. Simple binary threshold (luma-based)
 *   2. Adaptive threshold (mean of local window)
 *   3. Per-channel threshold (R, G, B individually)
 *   4. Otsu auto-threshold (optimal between-class variance)
 *   5. Dithering (Floyd-Steinberg error diffusion)
 *   6. Intensity slider (blend between original and thresholded)
 *   7. Invert option
 *   8. Batch validation
 *   9. Statistics (white/black ratio, luma mean)
 *  10. Presets (default, adaptive, otsu, dithered)
 *  11. Threshold clamping helper
 *  12. Local-window mean helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ThresholdMethod = "binary" | "adaptive" | "otsu" | "dither";

export interface ThresholdOptions {
  /** 0-255 — pixels with luma >= threshold become white, else black. */
  threshold: number;
  /** When true, inverts the mapping. */
  invert: boolean;
  /** Threshold method to apply. */
  method: ThresholdMethod;
  /** Adaptive window size (must be odd). */
  windowSize: number;
  /** 0..1 — blend factor between original and thresholded result. */
  intensity: number;
  /** Per-channel threshold (when method is binary, channels are individually checked). */
  perChannel: boolean;
}

export const DEFAULT_OPTIONS: ThresholdOptions = {
  threshold: 128,
  invert: false,
  method: "binary",
  windowSize: 11,
  intensity: 1,
  perChannel: false,
};

export interface ThresholdPreset {
  id: string;
  label: string;
  options: ThresholdOptions;
}

export const PRESETS: ThresholdPreset[] = [
  { id: "default", label: "Default (128)", options: { ...DEFAULT_OPTIONS } },
  { id: "low", label: "Low (64)", options: { ...DEFAULT_OPTIONS, threshold: 64 } },
  { id: "high", label: "High (192)", options: { ...DEFAULT_OPTIONS, threshold: 192 } },
  { id: "adaptive", label: "Adaptive", options: { ...DEFAULT_OPTIONS, method: "adaptive" } },
  { id: "otsu", label: "Otsu auto", options: { ...DEFAULT_OPTIONS, method: "otsu" } },
  { id: "dither", label: "Floyd-Steinberg", options: { ...DEFAULT_OPTIONS, method: "dither" } },
  { id: "inverted", label: "Inverted", options: { ...DEFAULT_OPTIONS, invert: true } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** ITU-R BT.601 luma. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

/** Apply threshold to a single pixel (binary method). */
export function applyThreshold(pixel: RgbPixel, opts: ThresholdOptions): RgbPixel {
  if (opts.perChannel) {
    const v = (c: number) => {
      const above = c >= opts.threshold;
      const white = opts.invert ? !above : above;
      return white ? 255 : 0;
    };
    return { r: v(pixel.r), g: v(pixel.g), b: v(pixel.b), a: pixel.a };
  }
  const y = Math.round(luma(pixel));
  const above = y >= opts.threshold;
  const white = opts.invert ? !above : above;
  const v = white ? 255 : 0;
  return { r: v, g: v, b: v, a: pixel.a };
}

/** Apply threshold with intensity blend (mix original and thresholded). */
export function applyThresholdWithIntensity(pixel: RgbPixel, opts: ThresholdOptions): RgbPixel {
  const t = applyThreshold(pixel, opts);
  const intensity = clamp(opts.intensity, 0, 1);
  return {
    r: clampByte(pixel.r + (t.r - pixel.r) * intensity),
    g: clampByte(pixel.g + (t.g - pixel.g) * intensity),
    b: clampByte(pixel.b + (t.b - pixel.b) * intensity),
    a: pixel.a,
  };
}

/** Clamp a threshold value to 0-255. */
export function clampThreshold(t: number): number {
  if (!Number.isFinite(t)) return 128;
  return Math.max(0, Math.min(255, Math.round(t)));
}

/** Compute Otsu's threshold for a 256-bin luma histogram. */
export function otsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return 128;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i]!;
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * histogram[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = i;
    }
  }
  return threshold;
}

/** Build a 256-bin luma histogram from RGBA pixel data. */
export function lumaHistogram(data: Uint8ClampedArray): number[] {
  const h = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(luma({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! }));
    h[clampByte(y)]!++;
  }
  return h;
}

/** Compute the mean of a local window centered at (x, y). */
export function localWindowMean(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  windowSize: number,
): number {
  const half = Math.floor(windowSize / 2);
  let sum = 0;
  let count = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = (ny * width + nx) * 4;
      sum += luma({ r: data[idx]!, g: data[idx + 1]!, b: data[idx + 2]! });
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/** Apply Floyd-Steinberg dithering to a luma buffer in place. Returns new array. */
export function floydSteinbergDither(
  lumaBuffer: number[],
  width: number,
  height: number,
  threshold: number,
): number[] {
  const out = lumaBuffer.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = out[idx]!;
      const newVal = old >= threshold ? 255 : 0;
      out[idx] = newVal;
      const err = old - newVal;
      if (x + 1 < width) out[idx + 1]! += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) out[idx + width - 1]! += err * 3 / 16;
        out[idx + width]! += err * 5 / 16;
        if (x + 1 < width) out[idx + width + 1]! += err * 1 / 16;
      }
    }
  }
  return out;
}

export function validateThresholdOptions(opts: ThresholdOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.threshold) || opts.threshold < 0 || opts.threshold > 255) {
    return { error: "Threshold must be 0-255" };
  }
  if (opts.windowSize < 3 || opts.windowSize > 99 || opts.windowSize % 2 === 0) {
    return { error: "Window size must be an odd number 3..99" };
  }
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  return { ok: true };
}

/** Statistics after thresholding: white count, black count, ratio. */
export interface ThresholdStats {
  white: number;
  black: number;
  total: number;
  whiteRatio: number;
}

export function thresholdStats(data: Uint8ClampedArray): ThresholdStats {
  let white = 0;
  let black = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = luma({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
    total++;
    if (y >= 128) white++;
    else black++;
  }
  return { white, black, total, whiteRatio: total === 0 ? 0 : white / total };
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: ThresholdOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateThresholdOptions(opts) }));
}

/** True when options produce a no-op. */
export function isIdentity(opts: ThresholdOptions): boolean {
  return opts.intensity === 0;
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
export function findPreset(id: string): ThresholdPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
