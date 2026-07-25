/**
 * Image Threshold Tool — pure threshold math. No DOM/canvas access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ThresholdOptions {
  /** 0-255 — pixels with luma >= threshold become white, else black. */
  threshold: number;
  /** When true, inverts the mapping. */
  invert: boolean;
}

/** ITU-R BT.601 luma. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

/** Apply threshold to a single pixel. */
export function applyThreshold(
  pixel: RgbPixel,
  opts: ThresholdOptions,
): RgbPixel {
  const y = Math.round(luma(pixel));
  const above = y >= opts.threshold;
  const white = opts.invert ? !above : above;
  const v = white ? 255 : 0;
  return { r: v, g: v, b: v, a: pixel.a };
}

/** Clamp a threshold value to 0-255. */
export function clampThreshold(t: number): number {
  if (!Number.isFinite(t)) return 128;
  return Math.max(0, Math.min(255, Math.round(t)));
}

export function validateThresholdOptions(opts: ThresholdOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.threshold) || opts.threshold < 0 || opts.threshold > 255) {
    return { error: "Threshold must be 0-255" };
  }
  return { ok: true };
}
