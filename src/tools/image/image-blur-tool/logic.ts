/**
 * Image Blur Tool — pure logic. No DOM access.
 *
 * Implements a 3-pass box-blur approximation of Gaussian blur. The UI runs
 * the actual pixel pass over a Uint8ClampedArray; this module computes the
 * configuration and per-pixel offsets.
 */
export interface BlurOptions {
  /** Blur radius in pixels (0 = no-op, recommended max 50). */
  radius: number;
  /** Number of box-blur passes (3 ≈ Gaussian). */
  passes: number;
}

/** Compute effective blur parameters from raw inputs. */
export function computeBlurParams(opts: BlurOptions): BlurOptions | { error: string } {
  const radius = Math.round(opts.radius);
  if (radius < 0) return { error: "Radius must be non-negative" };
  if (radius > 200) return { error: "Radius too large (max 200)" };
  const passes = Math.max(1, Math.min(opts.passes, 5));
  return { radius, passes };
}

/** Compute the horizontal sample offsets for a single row pass. */
export function horizontalOffsets(radius: number): number[] {
  const offsets: number[] = [];
  for (let i = -radius; i <= radius; i++) offsets.push(i + 0);
  return offsets;
}

/** Compute the standard deviation equivalent for a box-blur stack. */
export function effectiveSigma(radius: number, passes: number): number {
  if (radius <= 0) return 0;
  // For n passes of box blur with width w=(2r+1), σ ≈ w * sqrt(n / 12).
  const w = 2 * radius + 1;
  return w * Math.sqrt(passes / 12);
}

/** Validate that an image dimension is acceptable for blurring. */
export function validateDimensions(width: number, height: number): { ok: true } | { error: string } {
  if (width <= 0 || height <= 0) return { error: "Image dimensions must be positive" };
  if (width * height > 50_000_000) return { error: "Image too large to blur in-browser" };
  return { ok: true };
}
