/**
 * Image Watercolor — pure logic. No DOM / canvas access.
 *
 * Combines mean-shift style color smoothing (softens edges) with a
 * local color-spread term that expands the dominant chroma into neighbors.
 */
export interface WatercolorOptions {
  /** Smoothing window radius in pixels. */
  radius: number;
  /** Color spread factor 0..1. */
  spread: number;
  /** Edge softening factor 0..1. */
  soften: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate watercolor options. */
export function validateWatercolor(opts: WatercolorOptions): WatercolorOptions | { error: string } {
  if (opts.radius < 0 || opts.radius > 20) return { error: "Radius must be 0..20" };
  if (opts.spread < 0 || opts.spread > 1) return { error: "Spread must be 0..1" };
  if (opts.soften < 0 || opts.soften > 1) return { error: "Soften must be 0..1" };
  return { radius: Math.round(opts.radius), spread: opts.spread, soften: opts.soften };
}

/** Average color in a window. */
export function windowAverage(
  pixels: Uint8ClampedArray | number[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      r += pixels[i]!; g += pixels[i + 1]!; b += pixels[i + 2]!; n++;
    }
  }
  return n === 0 ? [0, 0, 0] : [r / n, g / n, b / n];
}

/** Blend a pixel toward a target by amount (soften factor). */
export function blendSoft(
  pixel: [number, number, number, number],
  target: [number, number, number],
  amount: number,
): [number, number, number, number] {
  const a = clamp(amount, 0, 1);
  return [
    clampByte(pixel[0] + (target[0] - pixel[0]) * a),
    clampByte(pixel[1] + (target[1] - pixel[1]) * a),
    clampByte(pixel[2] + (target[2] - pixel[2]) * a),
    pixel[3],
  ];
}

/** Compute color spread weight from distance to window edge (1=center, 0=edge). */
export function spreadWeight(distance: number, radius: number): number {
  if (radius <= 0) return 1;
  return clamp(1 - distance / radius, 0, 1);
}
