/**
 * Image Edge Detector — pure Sobel math. No DOM/canvas access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface EdgeOptions {
  /** 0-100 — threshold below which gradient magnitude becomes 0. */
  threshold: number;
  /** 0-100 — mixes grayscale edge map with original color. */
  intensity: number;
  /** Invert edges (white background, black lines). */
  invert: boolean;
}

/** Sobel kernels. */
export const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

export const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

/** ITU-R BT.601 luma. */
export function luma(pixel: { r: number; g: number; b: number }): number {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Extract a flat luma array (width*height) from interleaved RGBA bytes. */
export function toLumaArray(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    out[p] = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
  }
  return out;
}

/** Apply Sobel at a single pixel index, returning gradient magnitude (0-255 scale). */
export function sobelMagnitude(
  luma: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let gx = 0;
  let gy = 0;
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const sx = clamp(x + kx, 0, width - 1);
      const sy = clamp(y + ky, 0, height - 1);
      const v = luma[sy * width + sx]!;
      gx += SOBEL_X[ky + 1]![kx + 1]! * v;
      gy += SOBEL_Y[ky + 1]![kx + 1]! * v;
    }
  }
  return Math.sqrt(gx * gx + gy * gy);
}

/** Map one pixel through edge detection given a precomputed luma array. */
export function edgePixel(
  luma: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  opts: EdgeOptions,
  original: RgbPixel,
): RgbPixel {
  const mag = sobelMagnitude(luma, width, height, x, y);
  const thr = (opts.threshold / 100) * 255;
  let v = mag < thr ? 0 : mag;
  v = opts.invert ? 255 - v : v;
  v = clampByte(v);
  const t = clamp(opts.intensity / 100, 0, 1);
  return {
    r: clampByte(original.r + (v - original.r) * t),
    g: clampByte(original.g + (v - original.g) * t),
    b: clampByte(original.b + (v - original.b) * t),
    a: original.a,
  };
}

export function validateEdgeOptions(opts: EdgeOptions): { ok: true } | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 100) return { error: "Threshold must be 0-100" };
  if (opts.intensity < 0 || opts.intensity > 100) return { error: "Intensity must be 0-100" };
  return { ok: true };
}
