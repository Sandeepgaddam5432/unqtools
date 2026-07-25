/**
 * Image Neon Glow — pure logic. No DOM / canvas access.
 *
 * Sobel edge detection + per-pixel color glow (radial falloff around edges).
 */
export interface NeonOptions {
  /** Edge threshold 0..255. */
  threshold: number;
  /** Glow radius in pixels. */
  radius: number;
  /** Glow color [r,g,b]. */
  color: [number, number, number];
  /** Glow intensity 0..1. */
  intensity: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

export const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
export const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/** Validate neon options. */
export function validateNeon(opts: NeonOptions): NeonOptions | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 255) return { error: "Threshold must be 0..255" };
  if (opts.radius < 0 || opts.radius > 30) return { error: "Radius must be 0..30" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  if (opts.color.some((c) => c < 0 || c > 255)) return { error: "Color channels must be 0..255" };
  return { threshold: opts.threshold, radius: Math.round(opts.radius), color: opts.color, intensity: opts.intensity };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply a 3×3 kernel. */
export function applyKernel(gray: number[], x: number, y: number, w: number, h: number, kernel: number[]): number {
  let sum = 0, k = 0;
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

/** Sobel edge magnitude. */
export function sobelMag(gray: number[], x: number, y: number, w: number, h: number): number {
  const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
  const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
  return Math.sqrt(gx * gx + gy * gy);
}

/** Distance falloff for the glow. */
export function glowFalloff(distance: number, radius: number): number {
  if (radius <= 0) return distance === 0 ? 1 : 0;
  const r = distance / radius;
  return Math.exp(-r * r);
}

/** Blend edge-glow color onto a base pixel. */
export function blendNeon(
  base: [number, number, number, number],
  color: [number, number, number],
  amount: number,
): [number, number, number, number] {
  const a = clamp(amount, 0, 1);
  return [
    clampByte(base[0] + color[0] * a),
    clampByte(base[1] + color[1] * a),
    clampByte(base[2] + color[2] * a),
    base[3],
  ];
}

/** True if edge magnitude passes threshold. */
export function isEdge(magnitude: number, threshold: number): boolean {
  return magnitude >= threshold;
}
