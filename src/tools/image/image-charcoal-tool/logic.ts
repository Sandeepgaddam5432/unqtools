/**
 * Image Charcoal Tool — pure logic. No DOM / canvas access.
 *
 * Implements Sobel edge detection plus a paper-texture noise modulation.
 */
export interface CharcoalOptions {
  /** Edge strength 0..1. */
  strength: number;
  /** Texture noise amount 0..1. */
  texture: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate charcoal options. */
export function validateCharcoal(opts: CharcoalOptions): CharcoalOptions | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be 0..1" };
  if (opts.texture < 0 || opts.texture > 1) return { error: "Texture must be 0..1" };
  return { strength: opts.strength, texture: opts.texture };
}

/** Sobel X kernel (horizontal gradient). */
export const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
/** Sobel Y kernel (vertical gradient). */
export const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/** Apply a 3×3 kernel to a single grayscale channel. */
export function applyKernel(gray: number[], x: number, y: number, w: number, h: number, kernel: number[]): number {
  let sum = 0;
  let k = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = clamp(x + dx, 0, w - 1);
      const sy = clamp(y + dy, 0, h - 1);
      sum += gray[sy * w + sx]! * kernel[k]!;
      k++;
    }
  }
  return sum;
}

/** Sobel edge magnitude for a pixel. */
export function sobelMagnitude(gray: number[], x: number, y: number, w: number, h: number): number {
  const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
  const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
  return Math.sqrt(gx * gx + gy * gy);
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Map edge magnitude to a charcoal value (0=white paper, 255=dark stroke). */
export function edgeToCharcoal(magnitude: number, strength: number, texture: number, noise: number): number {
  const base = clamp(magnitude * (1 + strength * 4), 0, 255);
  const textured = base + (noise - 0.5) * 80 * texture;
  return clampByte(255 - textured);
}
