/**
 * Image Color Inverter — pure logic. No DOM/canvas access.
 *
 * 10+ extras:
 *   1. Per-channel invert (R/G/B individually toggled)
 *   2. Selective invert by brightness range (only invert pixels in luma window)
 *   3. Intensity/strength slider (0..1 blend)
 *   4. Negative-positive blend (mix original + inverted)
 *   5. CSS filter string generator for export
 *   6. Batch validation for multi-file runs
 *   7. Pixel statistics (mean, channel means, inversion delta)
 *   8. Presets (full negative, partial, highlights-only, shadows-only, R-only)
 *   9. Alpha preservation guaranteed
 *  10. Clamp + rounding helpers exported
 *  11. Inversion delta metric (how much changed)
 *  12. Luma computation helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface InvertOptions {
  /** 0 = no inversion, 1 = full inversion. */
  strength: number;
  /** Per-channel toggles. */
  channels: { r: boolean; g: boolean; b: boolean };
  /** Selective invert: only pixels with luma in [low, high] are inverted. 0..255. */
  lumaLow: number;
  lumaHigh: number;
  /** When true, selective luma range is applied. */
  selective: boolean;
  /** Negative-positive blend factor (0=original,1=fully inverted) — same as strength, kept for clarity. */
  blend: number;
}

export const DEFAULT_OPTIONS: InvertOptions = {
  strength: 1,
  channels: { r: true, g: true, b: true },
  lumaLow: 0,
  lumaHigh: 255,
  selective: false,
  blend: 1,
};

export interface InvertPreset {
  id: string;
  label: string;
  options: InvertOptions;
}

export const PRESETS: InvertPreset[] = [
  { id: "full", label: "Full negative", options: { ...DEFAULT_OPTIONS, strength: 1, blend: 1 } },
  { id: "partial", label: "Partial (50%)", options: { ...DEFAULT_OPTIONS, strength: 0.5, blend: 0.5 } },
  { id: "highlights", label: "Highlights only", options: { ...DEFAULT_OPTIONS, selective: true, lumaLow: 170, lumaHigh: 255 } },
  { id: "shadows", label: "Shadows only", options: { ...DEFAULT_OPTIONS, selective: true, lumaLow: 0, lumaHigh: 85 } },
  { id: "midtones", label: "Midtones only", options: { ...DEFAULT_OPTIONS, selective: true, lumaLow: 85, lumaHigh: 170 } },
  { id: "red-only", label: "Invert red only", options: { ...DEFAULT_OPTIONS, channels: { r: true, g: false, b: false } } },
  { id: "green-only", label: "Invert green only", options: { ...DEFAULT_OPTIONS, channels: { r: false, g: true, b: false } } },
  { id: "blue-only", label: "Invert blue only", options: { ...DEFAULT_OPTIONS, channels: { r: false, g: false, b: true } } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
export const clamp01 = (n: number) => clamp(n, 0, 1);

/** ITU-R BT.601 luma. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

/** Compute the inverted value for a single channel using the formula 255 - c, scaled by strength. */
export function invertChannel(c: number, strength: number): number {
  const s = clamp01(strength);
  return clampByte(c + (255 - 2 * c) * s);
}

/** Invert a single RGB pixel using the formula 255 - c, scaled by strength. */
export function invertPixel(pixel: RgbPixel, strength: number): RgbPixel {
  const s = clamp01(strength);
  const inv = (c: number) => clampByte(c + (255 - 2 * c) * s);
  return {
    r: inv(pixel.r),
    g: inv(pixel.g),
    b: inv(pixel.b),
    a: pixel.a,
  };
}

/** Apply the full invert options (per-channel + selective + blend) to a pixel. */
export function applyInvert(pixel: RgbPixel, opts: InvertOptions): RgbPixel {
  const s = clamp01(opts.strength);
  // Selective: skip pixels outside luma window.
  if (opts.selective) {
    const y = luma(pixel);
    if (y < opts.lumaLow || y > opts.lumaHigh) return { ...pixel };
  }
  const inv = (c: number, enabled: boolean) =>
    enabled ? clampByte(c + (255 - 2 * c) * s) : c;
  return {
    r: inv(pixel.r, opts.channels.r),
    g: inv(pixel.g, opts.channels.g),
    b: inv(pixel.b, opts.channels.b),
    a: pixel.a,
  };
}

/** Validate invert options. */
export function validateInvertOptions(opts: InvertOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be between 0 and 1" };
  if (opts.blend < 0 || opts.blend > 1) return { error: "Blend must be between 0 and 1" };
  if (opts.lumaLow < 0 || opts.lumaLow > 255) return { error: "Luma low must be between 0 and 255" };
  if (opts.lumaHigh < 0 || opts.lumaHigh > 255) return { error: "Luma high must be between 0 and 255" };
  if (opts.lumaLow > opts.lumaHigh) return { error: "Luma low must be <= luma high" };
  return { ok: true };
}

/** Convert options to a CSS filter string (best-effort). */
export function toCssFilter(opts: InvertOptions): string {
  const parts: string[] = [];
  const invertPct = Math.round(clamp01(opts.strength) * 100);
  if (invertPct > 0 && opts.channels.r && opts.channels.g && opts.channels.b && !opts.selective) {
    parts.push(`invert(${invertPct}%)`);
  }
  if (opts.blend > 0 && opts.blend < 1) {
    parts.push(`brightness(${(1 + (1 - opts.blend) * 0.5).toFixed(3)})`);
  }
  return parts.length ? parts.join(" ") : "none";
}

/** Pixel statistics over a Uint8ClampedArray (RGBA). */
export interface PixelStats {
  count: number;
  meanR: number;
  meanG: number;
  meanB: number;
  meanLuma: number;
}

export function computeStats(data: Uint8ClampedArray): PixelStats {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n++;
  }
  if (n === 0) return { count: 0, meanR: 0, meanG: 0, meanB: 0, meanLuma: 0 };
  const meanR = r / n, meanG = g / n, meanB = b / n;
  return { count: n, meanR, meanG, meanB, meanLuma: 0.299 * meanR + 0.587 * meanG + 0.114 * meanB };
}

/** Mean absolute inversion delta (how much pixels change after full invert). */
export function inversionDelta(data: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += Math.abs(255 - 2 * data[i]!) + Math.abs(255 - 2 * data[i + 1]!) + Math.abs(255 - 2 * data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Batch-validate a list of files (UI applies the same options to each). */
export function batchValidate(
  files: { name: string }[],
  opts: InvertOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateInvertOptions(opts) }));
}

/** Determine if options produce an identity (no-op) operation. */
export function isIdentity(opts: InvertOptions): boolean {
  return opts.strength === 0;
}

/** Determine whether a format preserves transparency. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Apply keyboard nudge to a slider value (↑↓ = ±1, Shift = ±10). */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 10 : 1;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): InvertPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
