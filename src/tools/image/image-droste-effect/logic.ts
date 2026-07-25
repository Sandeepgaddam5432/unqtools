/**
 * Image Droste Effect — pure math for picture-in-picture spiral recursion.
 * Maps a destination pixel to a source pixel by walking logarithmic spiral.
 */
export interface DrosteOptions {
  /** Number of recursive levels (1-10). */
  levels: number;
  /** Spiral twist in radians per level. */
  twist: number;
  /** Inner radius ratio (0.1-0.9) of the recursion frame. */
  innerRadius: number;
}

export interface Point { x: number; y: number; }

const TWO_PI = Math.PI * 2;

export function validateDrosteOptions(opts: DrosteOptions): { ok: true } | { error: string } {
  if (!Number.isInteger(opts.levels) || opts.levels < 1 || opts.levels > 10) {
    return { error: "Levels must be an integer 1-10" };
  }
  if (!Number.isFinite(opts.twist) || opts.twist < -Math.PI || opts.twist > Math.PI) {
    return { error: "Twist must be between -π and π" };
  }
  if (!Number.isFinite(opts.innerRadius) || opts.innerRadius <= 0 || opts.innerRadius >= 1) {
    return { error: "Inner radius must be between 0 and 1" };
  }
  return { ok: true };
}

/** Convert cartesian to polar { r, theta } around origin (cx, cy). */
export function toPolar(x: number, y: number, cx: number, cy: number): { r: number; theta: number } {
  const dx = x - cx;
  const dy = y - cy;
  return { r: Math.sqrt(dx * dx + dy * dy), theta: Math.atan2(dy, dx) };
}

/** Convert polar to cartesian around origin (cx, cy). */
export function toCartesian(r: number, theta: number, cx: number, cy: number): Point {
  return { x: r * Math.cos(theta) + cx, y: r * Math.sin(theta) + cy };
}

/**
 * Map a destination pixel through the Droste spiral. Returns the source pixel
 * to sample. Uses logarithmic radius unwrapping with optional twist.
 */
export function mapDrostePixel(dx: number, dy: number, width: number, height: number, opts: DrosteOptions): Point {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy);
  const { r, theta } = toPolar(dx, dy, cx, cy);
  // Guard: center pixel maps to itself
  if (r < 1e-9) return { x: dx, y: dy };
  const inner = opts.innerRadius;
  // log of radius ratio for unwrapping
  const logR = Math.log(r / maxR) / Math.log(inner);
  const level = Math.floor(logR);
  const frac = logR - level;
  // Unwrap radius
  const newR = maxR * Math.pow(inner, frac);
  // Apply twist + rotation per level
  const newTheta = theta + opts.twist * level + frac * opts.twist;
  // Clamp the source within image bounds
  let sx = newR * Math.cos(newTheta) + cx;
  let sy = newR * Math.sin(newTheta) + cy;
  if (sx < 0) sx = 0; else if (sx >= width) sx = width - 1;
  if (sy < 0) sy = 0; else if (sy >= height) sy = height - 1;
  return { x: sx, y: sy };
}

/** Compute the next spiral point at a given fraction t (0..1). */
export function spiralPoint(t: number, cx: number, cy: number, maxR: number, twist: number): Point {
  const theta = t * TWO_PI * 3 + twist * t;
  const r = maxR * Math.exp(-t * Math.log(2));
  return toCartesian(r, theta, cx, cy);
}
