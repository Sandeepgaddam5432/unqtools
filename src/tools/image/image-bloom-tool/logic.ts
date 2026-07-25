/**
 * Image Bloom Tool — pure logic. No DOM / canvas access.
 *
 * Computes brightness threshold masks and the Gaussian-equivalent blur
 * sigma used by the UI's canvas pass for a soft glow effect.
 */
export interface BloomOptions {
  /** Brightness threshold 0..255. Pixels brighter than this contribute to bloom. */
  threshold: number;
  /** Bloom intensity 0..1. */
  intensity: number;
  /** Blur radius in pixels. */
  radius: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Validate and sanitize bloom options. */
export function validateBloom(opts: BloomOptions): BloomOptions | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 255) return { error: "Threshold must be 0..255" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  if (opts.radius < 0 || opts.radius > 100) return { error: "Radius must be 0..100" };
  return { threshold: clamp(opts.threshold, 0, 255), intensity: opts.intensity, radius: Math.round(opts.radius) };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Returns true if pixel passes the brightness threshold. */
export function passesThreshold(r: number, g: number, b: number, threshold: number): boolean {
  return luma(r, g, b) >= threshold;
}

/** Effective sigma for box-blur approximation with given radius & 3 passes. */
export function effectiveSigma(radius: number): number {
  if (radius <= 0) return 0;
  return (2 * radius + 1) * Math.sqrt(3 / 12);
}

/** Blend a pixel with the bloom (additive, intensity-scaled). */
export function addBloom(
  pixel: [number, number, number, number],
  bloom: [number, number, number],
  intensity: number,
): [number, number, number, number] {
  const a = clamp(intensity, 0, 1);
  return [
    clampByte(pixel[0] + bloom[0] * a),
    clampByte(pixel[1] + bloom[1] * a),
    clampByte(pixel[2] + bloom[2] * a),
    pixel[3],
  ];
}

const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
