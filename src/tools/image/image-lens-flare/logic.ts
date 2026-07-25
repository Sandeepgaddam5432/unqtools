/**
 * Image Lens Flare Effect — pure logic. No DOM / canvas access.
 *
 * Computes flare position, intensity falloff, halo color blending, and the
 * ghost reflection positions used by the UI's canvas pass.
 */
export interface FlareOptions {
  /** Flare x as a fraction of width (0..1). */
  fx: number;
  /** Flare y as a fraction of height (0..1). */
  fy: number;
  /** Intensity 0..1. */
  intensity: number;
  /** Flare color [r,g,b] (0..255). */
  color: [number, number, number];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate flare options; returns sanitized options or error. */
export function validateFlare(opts: FlareOptions): FlareOptions | { error: string } {
  if (!Number.isFinite(opts.fx) || !Number.isFinite(opts.fy)) return { error: "Position must be finite" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be between 0 and 1" };
  if (opts.color.some((c) => c < 0 || c > 255)) return { error: "Color channels must be 0..255" };
  return { fx: clamp(opts.fx, 0, 1), fy: clamp(opts.fy, 0, 1), intensity: opts.intensity, color: opts.color };
}

/** Distance-based intensity falloff (Gaussian-like). */
export function falloff(distance: number, radius: number): number {
  if (radius <= 0) return distance === 0 ? 1 : 0;
  const r = distance / radius;
  return Math.exp(-r * r);
}

/** Blend a pixel with the flare color by amount. */
export function blendFlare(
  pixel: [number, number, number, number],
  color: [number, number, number],
  amount: number,
): [number, number, number, number] {
  const a = clamp(amount, 0, 1);
  return [
    clampByte(pixel[0] + (color[0] - pixel[0]) * a),
    clampByte(pixel[1] + (color[1] - pixel[1]) * a),
    clampByte(pixel[2] + (color[2] - pixel[2]) * a),
    pixel[3],
  ];
}

/** Compute ghost reflection positions along the line through center (0..1 normalized). */
export function ghostPositions(fx: number, fy: number, count: number): Array<{ x: number; y: number; scale: number }> {
  const cx = 0.5, cy = 0.5;
  const dx = cx - fx, dy = cy - fy;
  const out: Array<{ x: number; y: number; scale: number }> = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    out.push({ x: fx + dx * 2 * t, y: fy + dy * 2 * t, scale: 0.6 + 0.4 * Math.sin(t * Math.PI) });
  }
  return out;
}
