/**
 * Image Oil Paint — pure logic. No DOM / canvas access.
 *
 * For each output pixel, find the most common color in a brush-sized
 * neighborhood (color quantization binning reduces variation).
 */
export interface OilOptions {
  /** Brush radius in pixels. */
  radius: number;
  /** Number of color levels per channel (quantization). */
  levels: number;
}

/** Validate oil paint options. */
export function validateOil(opts: OilOptions): OilOptions | { error: string } {
  if (opts.radius < 0 || opts.radius > 30) return { error: "Radius must be 0..30" };
  if (opts.levels < 2 || opts.levels > 64) return { error: "Levels must be 2..64" };
  return { radius: Math.round(opts.radius), levels: Math.round(opts.levels) };
}

/** Quantize a channel value to N levels. */
export function quantize(value: number, levels: number): number {
  const step = 256 / levels;
  const q = Math.floor(value / step) * step;
  return Math.min(255, Math.round(q + step / 2));
}

/** Quantize an RGB triple. */
export function quantizeRgb(r: number, g: number, b: number, levels: number): [number, number, number] {
  return [quantize(r, levels), quantize(g, levels), quantize(b, levels)];
}

/** Pack a quantized RGB triple into a single integer key. */
export function packRgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/** Find the most frequent color in a brush-sized neighborhood. */
export function dominantColor(
  pixels: Uint8ClampedArray | number[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  levels: number,
): [number, number, number] {
  const counts = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      const [qr, qg, qb] = quantizeRgb(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, levels);
      const key = packRgb(qr, qg, qb);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { count: 1, r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! });
    }
  }
  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const v of counts.values()) if (!best || v.count > best.count) best = v;
  return best ? [best.r, best.g, best.b] : [0, 0, 0];
}
