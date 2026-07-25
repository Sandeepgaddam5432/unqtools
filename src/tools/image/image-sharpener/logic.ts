/**
 * Image Sharpener — pure logic. No DOM access.
 *
 * Implements a standard 3×3 sharpening convolution kernel with an adjustable
 * strength. The kernel is computed from strength using:
 *
 *   center = 1 + 4 * strength
 *   neighbors = -strength
 *
 * The UI runs the actual convolution over a Uint8ClampedArray; this module
 * provides the testable kernel builder + helpers.
 */
export interface SharpenOptions {
  /** 0 = no sharpening, 1 = strong. */
  strength: number;
}

/** A 3×3 convolution kernel (row-major). */
export type Kernel3x3 = [number, number, number, number, number, number, number, number, number];

/** Build a 3×3 sharpen kernel from a strength value. */
export function buildSharpenKernel(strength: number): Kernel3x3 {
  const s = clamp(strength, 0, 5);
  const center = 1 + 4 * s;
  // Normalize -0 to +0 so the kernel has a stable representation.
  const neighbor = -s + 0;
  return [0, neighbor, 0, neighbor, center, neighbor, 0, neighbor, 0];
}

/** Validate sharpen options. */
export function validateSharpenOptions(opts: SharpenOptions): { ok: true } | { error: string } {
  if (opts.strength < 0 || opts.strength > 5) return { error: "Strength must be between 0 and 5" };
  return { ok: true };
}

/** Apply a 3×3 kernel to a single pixel value with edge clamping. */
export function applyKernel(
  values: number[], // length 9, row-major
  kernel: Kernel3x3,
): number {
  let sum = 0;
  let ksum = 0;
  for (let i = 0; i < 9; i++) {
    sum += values[i]! * kernel[i]!;
    ksum += kernel[i]!;
  }
  if (ksum === 0) ksum = 1;
  return Math.round(sum / ksum);
}

/** Clamp + round a value to a byte. */
export function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
