/**
 * Image Round Corners — pure corner-radius math. No DOM/canvas access.
 */
export interface RoundedOptions {
  /** Corner radius in pixels. */
  radius: number;
  /** 0-100 anti-aliasing softness. */
  feather: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Clamp radius to a maximum of half the smaller image dimension. */
export function clampRadius(radius: number, width: number, height: number): number {
  const max = Math.min(width, height) / 2;
  return clamp(radius, 0, max);
}

/** Compute alpha (0-1) for a pixel at (x,y) given a clamped radius and feather. */
export function cornerAlpha(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  feather: number,
): number {
  if (radius <= 0) return 1;
  // Find nearest corner center
  const cx = x < width / 2 ? radius : width - 1 - radius;
  const cy = y < height / 2 ? radius : height - 1 - radius;
  // Only consider corner regions
  const inCornerX = x < radius || x > width - 1 - radius;
  const inCornerY = y < radius || y > height - 1 - radius;
  if (!inCornerX || !inCornerY) return 1;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const inner = radius - feather;
  if (dist <= inner) return 1;
  if (dist >= radius) return 0;
  return 1 - (dist - inner) / (radius - inner);
}

/** Apply rounded corner alpha to a pixel's alpha channel. */
export function applyRounded(
  alpha: number,
  factor: number,
): number {
  return clampByte(alpha * factor);
}

export function validateRoundedOptions(opts: RoundedOptions, width: number, height: number): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.radius) || opts.radius < 0) return { error: "Radius must be a non-negative number" };
  if (opts.radius > Math.min(width, height) / 2) return { error: "Radius too large for this image" };
  if (opts.feather < 0 || opts.feather > 100) return { error: "Feather must be 0-100" };
  return { ok: true };
}
