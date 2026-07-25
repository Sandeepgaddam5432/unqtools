/**
 * Image Starry Night Swirl — pure coordinate transform logic. No DOM/canvas.
 */
export interface SwirlPoint { x: number; y: number; }

export interface SwirlOptions {
  /** Center X in normalized coords [0..1]. */
  cx: number;
  /** Center Y in normalized coords [0..1]. */
  cy: number;
  /** Swirl angle in radians at center (decreases with radius). */
  angle: number;
  /** Radius of effect in normalized coords (0..1). */
  radius: number;
}

/** Distance from a center, normalized so radius maps to 1. */
export function normalizedRadius(x: number, y: number, opts: SwirlOptions, width: number, height: number): number {
  const cxp = opts.cx * width;
  const cyp = opts.cy * height;
  const r = (opts.radius * Math.min(width, height)) / 2 || 1;
  const dx = x - cxp;
  const dy = y - cyp;
  return Math.sqrt(dx * dx + dy * dy) / r;
}

/**
 * Swirl coordinate transform.
 * Returns the source pixel coordinate to sample from.
 * Uses the swirl formula:
 *   θ = angle * (1 - r/radius)^2  (smooth falloff)
 *   x' = x*cos(θ) + y*sin(θ)
 *   y' = -x*sin(θ) + y*cos(θ)
 * where (x,y) are relative to the swirl center.
 */
export function swirlMap(x: number, y: number, opts: SwirlOptions, width: number, height: number): SwirlPoint {
  const cxp = opts.cx * width;
  const cyp = opts.cy * height;
  const dx = x - cxp;
  const dy = y - cyp;
  const r = normalizedRadius(x, y, opts, width, height);
  // Smooth falloff using (1 - r²) curve: angle ramps down to 0 at radius 1.
  const falloff = Math.max(0, 1 - r * r);
  const theta = opts.angle * falloff;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: cxp + dx * cos + dy * sin,
    y: cyp - dx * sin + dy * cos,
  };
}

/** True when the mapped point lies within the image bounds. */
export function inBounds(p: SwirlPoint, width: number, height: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
}

export function validateSwirlOptions(opts: SwirlOptions): { ok: true } | { error: string } {
  if (opts.cx < 0 || opts.cx > 1) return { error: "Center X must be 0-1" };
  if (opts.cy < 0 || opts.cy > 1) return { error: "Center Y must be 0-1" };
  if (opts.radius <= 0 || opts.radius > 2) return { error: "Radius must be 0-2" };
  if (!Number.isFinite(opts.angle)) return { error: "Angle must be a finite number" };
  return { ok: true };
}
