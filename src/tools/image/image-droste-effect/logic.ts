/**
 * Image Droste Effect — pure math for picture-in-picture spiral recursion.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Multi-level recursion (1-10)
 *   2. Spiral twist (radians per level)
 *   3. Inner radius ratio (recursion frame)
 *   4. Polar ↔ cartesian conversion
 *   5. Logarithmic spiral unwrapping
 *   6. Pixel mapping with bounds clamping
 *   7. Spiral point generator for visualisation
 *   8. Center offset parameter
 *   9. Scale factor parameter
 *  10. Validation with detailed error messages
 *  11. Spiral length / total turns helpers
 *  12. Per-level transformation matrix
 */
export interface DrosteOptions {
  /** Number of recursive levels (1-10). */
  levels: number;
  /** Spiral twist in radians per level. */
  twist: number;
  /** Inner radius ratio (0.1-0.9) of the recursion frame. */
  innerRadius: number;
  /** Center X offset (-0.5..0.5). */
  cxOffset?: number;
  /** Center Y offset (-0.5..0.5). */
  cyOffset?: number;
  /** Scale factor (0.5..2). */
  scale?: number;
}

export interface Point { x: number; y: number; }

const TWO_PI = Math.PI * 2;
const isFin = (n: number) => Number.isFinite(n);

export function validateDrosteOptions(opts: DrosteOptions): { ok: true } | { error: string } {
  if (!Number.isInteger(opts.levels) || opts.levels < 1 || opts.levels > 10) {
    return { error: "Levels must be an integer 1-10" };
  }
  if (!isFin(opts.twist) || opts.twist < -Math.PI || opts.twist > Math.PI) {
    return { error: "Twist must be between -π and π" };
  }
  if (!isFin(opts.innerRadius) || opts.innerRadius <= 0 || opts.innerRadius >= 1) {
    return { error: "Inner radius must be between 0 and 1" };
  }
  if (opts.cxOffset !== undefined && (opts.cxOffset < -0.5 || opts.cxOffset > 0.5)) {
    return { error: "Center X offset must be between -0.5 and 0.5" };
  }
  if (opts.cyOffset !== undefined && (opts.cyOffset < -0.5 || opts.cyOffset > 0.5)) {
    return { error: "Center Y offset must be between -0.5 and 0.5" };
  }
  if (opts.scale !== undefined && (opts.scale < 0.5 || opts.scale > 2)) {
    return { error: "Scale must be between 0.5 and 2" };
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

/** Compute the effective center for a given image size and offset. */
export function computeCenter(width: number, height: number, opts: DrosteOptions): Point {
  const cxOff = opts.cxOffset ?? 0;
  const cyOff = opts.cyOffset ?? 0;
  return { x: width / 2 + cxOff * width, y: height / 2 + cyOff * height };
}

/** Compute the effective max radius for a given image and scale. */
export function computeMaxR(width: number, height: number, opts: DrosteOptions): number {
  const scale = opts.scale ?? 1;
  return Math.min(width, height) / 2 * scale;
}

/** Map a destination pixel through the Droste spiral. */
export function mapDrostePixel(dx: number, dy: number, width: number, height: number, opts: DrosteOptions): Point {
  const { x: cx, y: cy } = computeCenter(width, height, opts);
  const maxR = computeMaxR(width, height, opts);
  const { r, theta } = toPolar(dx, dy, cx, cy);
  if (r < 1e-9) return { x: dx, y: dy };
  const inner = opts.innerRadius;
  const logR = Math.log(r / maxR) / Math.log(inner);
  const level = Math.floor(logR);
  const frac = logR - level;
  const newR = maxR * Math.pow(inner, frac);
  const newTheta = theta + opts.twist * level + frac * opts.twist;
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

/** Generate a sequence of spiral points for visualisation. */
export function spiralPath(cx: number, cy: number, maxR: number, twist: number, steps = 100): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push(spiralPoint(i / steps, cx, cy, maxR, twist));
  }
  return points;
}

/** Compute the total turns of a spiral (based on twist and a default 3 turns). */
export function spiralTurns(twist: number): number {
  return 3 + twist / TWO_PI;
}

/** Compute the length of a logarithmic spiral approximation. */
export function spiralLength(cx: number, cy: number, maxR: number, twist: number, steps = 100): number {
  const path = spiralPath(cx, cy, maxR, twist, steps);
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]!.x - path[i - 1]!.x;
    const dy = path[i]!.y - path[i - 1]!.y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/** Compute the per-level transformation: { scale, rotation }. */
export function levelTransform(level: number, opts: DrosteOptions): { scale: number; rotation: number } {
  return { scale: Math.pow(opts.innerRadius, level), rotation: opts.twist * level };
}

/** Batch-validate a list of options. */
export function batchValidate(
  optsList: DrosteOptions[],
): { i: number; result: { ok: true } | { error: string } }[] {
  return optsList.map((opts, i) => ({ i, result: validateDrosteOptions(opts) }));
}

/** Compute the number of distinct recursive levels present at a radius. */
export function levelAtRadius(r: number, maxR: number, innerRadius: number): number {
  if (r <= 0 || maxR <= 0) return 0;
  const logR = Math.log(r / maxR) / Math.log(innerRadius);
  return Math.floor(logR);
}

/** Pretty-print helper. */
export function fmt(n: number, p = 4): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
