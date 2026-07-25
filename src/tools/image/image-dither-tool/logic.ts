/**
 * Image Dither Tool — pure helpers for dithering algorithms.
 *
 * Algorithms:
 *   1. Floyd-Steinberg (7-3-5-1 error diffusion)
 *   2. Atkinson (1/8 to 6 neighbors)
 *   3. Jarvis-Judice-Ninke (JJN, 12 neighbors)
 *   4. Stucki (12 neighbors, similar to JJN)
 *   5. Bayer ordered (4x4)
 *   6. Random dither
 *   7. Threshold (binary)
 *
 * Extras: color palette, output format, batch validation, stats,
 *         pixel transforms, luminance, palette helpers.
 */
export type DitherMode = "floyd-steinberg" | "atkinson" | "jarvis" | "stucki" | "bayer" | "random" | "threshold";

export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface DitherOptions {
  mode: DitherMode;
  /** Number of output levels per channel (2-16). */
  levels: number;
  /** Threshold for binary mode (0-255). */
  threshold: number;
  /** Optional color palette name; "mono" = grayscale, otherwise palette lookup. */
  palette: string;
}

/** 4x4 Bayer ordered dither matrix. */
export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Floyd-Steinberg error diffusion weights. */
export const FLOYD_STEINBERG_WEIGHTS = {
  right: 7 / 16, bottomLeft: 3 / 16, bottom: 5 / 16, bottomRight: 1 / 16,
};

/** Atkinson diffusion weights (each is 1/8). */
export const ATKINSON_WEIGHT = 1 / 8;

/** Color palettes. */
export const PALETTES: Record<string, [number, number, number][]> = {
  mono: [[0, 0, 0], [255, 255, 255]],
  cga: [[0, 0, 0], [85, 255, 255], [255, 85, 255], [255, 255, 255]],
  gameboy: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
  c64: [[0, 0, 0], [255, 255, 255], [136, 0, 0], [170, 68, 0]],
  nes: [[0, 0, 0], [188, 188, 188], [248, 56, 0], [255, 255, 255]],
  sepia: [[64, 38, 18], [128, 88, 50], [192, 152, 110], [255, 230, 190]],
  rgb: [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Quantize a channel value to N levels (0-255). */
export function quantize(value: number, levels: number): number {
  const step = 255 / Math.max(1, levels - 1);
  return Math.round(Math.round(value / step) * step);
}

/** Find closest palette color (simple levels-based). */
export function findClosest(value: number, levels: number): number {
  return clampByte(quantize(value, levels));
}

/** Find nearest palette color index. */
export function nearestPaletteColor(palette: [number, number, number][], r: number, g: number, b: number): [number, number, number] {
  let best = palette[0]!;
  let bestD = Infinity;
  for (const c of palette) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Threshold map for a 4x4 Bayer matrix, normalized to 0-1. */
export function bayerThreshold(x: number, y: number): number {
  const v = BAYER_4X4[y % 4]![x % 4]!;
  return (v + 0.5) / 16;
}

/** Compute the dithered value for a single channel using ordered dithering. */
export function orderedDither(value: number, x: number, y: number, levels: number): number {
  const t = bayerThreshold(x, y);
  const step = 255 / Math.max(1, levels - 1);
  return findClosest(value + step * (t - 0.5), levels);
}

/** Compute random dither offset for a channel. */
export function randomDither(value: number, noise: number, levels: number): number {
  const step = 255 / Math.max(1, levels - 1);
  return findClosest(value + (noise - 0.5) * step, levels);
}

/** Threshold dither: pixel becomes 0 or 255 based on luminance. */
export function thresholdDither(r: number, g: number, b: number, threshold: number): [number, number, number] {
  const v = luma(r, g, b) >= threshold ? 255 : 0;
  return [v, v, v];
}

/** Diffuse error to neighbor at (x+dx, y+dy) using Float32 buffer. */
function diffuse(buf: Float32Array, w: number, h: number, x: number, y: number, dx: number, dy: number, err: number, weight: number) {
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
  const j = (ny * w + nx) * 3;
  buf[j]! += err * weight;
  buf[j + 1]! += err * weight;
  buf[j + 2]! += err * weight;
}

/** Run error diffusion using a kernel of [dx, dy, weight] entries. */
export function errorDiffusion(
  buf: Float32Array, w: number, h: number,
  levels: number, kernel: [number, number, number][],
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const old = buf[j + c]!;
        const nw = clampByte(quantize(old, levels));
        buf[j + c] = nw;
        const err = old - nw;
        for (const [dx, dy, weight] of kernel) {
          diffuse(buf, w, h, x, y, dx, dy, err, weight);
        }
      }
    }
  }
}

/** Build Floyd-Steinberg kernel. */
export function floydSteinbergKernel(): [number, number, number][] {
  return [[1, 0, FLOYD_STEINBERG_WEIGHTS.right], [-1, 1, FLOYD_STEINBERG_WEIGHTS.bottomLeft], [0, 1, FLOYD_STEINBERG_WEIGHTS.bottom], [1, 1, FLOYD_STEINBERG_WEIGHTS.bottomRight]];
}

/** Build Atkinson kernel (6 neighbors, each 1/8). */
export function atkinsonKernel(): [number, number, number][] {
  return [[1, 0, ATKINSON_WEIGHT], [2, 0, ATKINSON_WEIGHT], [-1, 1, ATKINSON_WEIGHT], [0, 1, ATKINSON_WEIGHT], [1, 1, ATKINSON_WEIGHT], [0, 2, ATKINSON_WEIGHT]];
}

/** Build Jarvis-Judice-Ninke kernel (12 neighbors). */
export function jarvisKernel(): [number, number, number][] {
  const w = 1 / 48;
  return [
    [1, 0, 7 * w], [2, 0, 5 * w],
    [-2, 1, 3 * w], [-1, 1, 5 * w], [0, 1, 7 * w], [1, 1, 5 * w], [2, 1, 3 * w],
    [-2, 2, 1 * w], [-1, 2, 3 * w], [0, 2, 5 * w], [1, 2, 3 * w], [2, 2, 1 * w],
  ];
}

/** Build Stucki kernel (12 neighbors). */
export function stuckiKernel(): [number, number, number][] {
  const w = 1 / 42;
  return [
    [1, 0, 8 * w], [2, 0, 4 * w],
    [-2, 1, 2 * w], [-1, 1, 4 * w], [0, 1, 8 * w], [1, 1, 4 * w], [2, 1, 2 * w],
    [-2, 2, 1 * w], [-1, 2, 2 * w], [0, 2, 4 * w], [1, 2, 2 * w], [2, 2, 1 * w],
  ];
}

export function validateDitherOptions(o: DitherOptions): { ok: true } | { error: string } {
  const validModes: DitherMode[] = ["floyd-steinberg", "atkinson", "jarvis", "stucki", "bayer", "random", "threshold"];
  if (!validModes.includes(o.mode)) return { error: "Unknown mode" };
  if (!Number.isInteger(o.levels) || o.levels < 2 || o.levels > 16) return { error: "Levels must be 2-16" };
  if (o.threshold < 0 || o.threshold > 255) return { error: "Threshold must be 0-255" };
  if (!PALETTES[o.palette]) return { error: "Unknown palette" };
  return { ok: true };
}

/** Compute distribution stats: ratio of "on" (≥128) pixels. */
export function ditherStats(px: Uint8ClampedArray): { onRatio: number; meanLuma: number } {
  let on = 0, sum = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const y = luma(px[i]!, px[i + 1]!, px[i + 2]!);
    if (y >= 128) on++;
    sum += y; n++;
  }
  return { onRatio: n === 0 ? 0 : on / n, meanLuma: n === 0 ? 0 : sum / n };
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: DitherOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateDitherOptions(opts) }));
}

/** True when options produce a no-op (impossible here, always false). */
export function isIdentity(_opts: DitherOptions): boolean {
  return false;
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Get palette list. */
export function getPalette(name: string): [number, number, number][] {
  return PALETTES[name] ?? PALETTES.mono;
}
