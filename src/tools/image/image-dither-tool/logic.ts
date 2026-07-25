/**
 * Image Dither Tool — pure helpers for Floyd-Steinberg, ordered, random dither.
 */
export type DitherMode = "floyd-steinberg" | "ordered" | "random";

export interface DitherOptions {
  mode: DitherMode;
  /** Number of output levels per channel (2-16). */
  levels: number;
}

/** 4x4 Bayer ordered dither matrix. */
export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Quantize a channel value to N levels (0-255). */
export function quantize(value: number, levels: number): number {
  const step = 255 / Math.max(1, levels - 1);
  return Math.round(Math.round(value / step) * step);
}

/** Find closest palette color (simple levels-based). */
export function findClosest(value: number, levels: number): number {
  return Math.max(0, Math.min(255, quantize(value, levels)));
}

/** Floyd-Steinberg error diffusion weights. */
export const FLOYD_STEINBERG_WEIGHTS = {
  right: 7 / 16,
  bottomLeft: 3 / 16,
  bottom: 5 / 16,
  bottomRight: 1 / 16,
};

/** Threshold map for a 4x4 Bayer matrix, normalized to 0-1. */
export function bayerThreshold(x: number, y: number): number {
  const v = BAYER_4X4[y % 4]![x % 4]!;
  return (v + 0.5) / 16;
}

/** Compute the dithered value for a single channel using ordered dithering. */
export function orderedDither(value: number, x: number, y: number, levels: number): number {
  const t = bayerThreshold(x, y);
  const step = 255 / Math.max(1, levels - 1);
  const adjusted = value + step * (t - 0.5);
  return findClosest(adjusted, levels);
}

/** Compute random dither offset for a channel. */
export function randomDither(value: number, noise: number, levels: number): number {
  const adjusted = value + (noise - 0.5) * (255 / Math.max(1, levels - 1));
  return findClosest(adjusted, levels);
}

export function validateDitherOptions(o: DitherOptions): { ok: true } | { error: string } {
  if (!["floyd-steinberg", "ordered", "random"].includes(o.mode)) return { error: "Unknown mode" };
  if (!Number.isInteger(o.levels) || o.levels < 2 || o.levels > 16) return { error: "Levels must be 2-16" };
  return { ok: true };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
