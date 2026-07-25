/**
 * Image Noise Reducer — pure median filter math. No DOM/canvas access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DenoiseOptions {
  /** Window radius (1 = 3x3, 2 = 5x5). */
  radius: number;
  /** 0-100 — blend between original (0) and filtered (100). */
  strength: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Compute median of a numeric array (does not mutate input). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Collect a window of single-channel samples around (x,y) with edge clamping. */
export function windowSamples(
  channel: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number[] {
  const out: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = clamp(x + dx, 0, width - 1);
      const sy = clamp(y + dy, 0, height - 1);
      out.push(channel[sy * width + sx]!);
    }
  }
  return out;
}

/** Apply median filter to a single pixel given channel arrays. */
export function denoisePixel(
  channels: { r: Float32Array; g: Float32Array; b: Float32Array },
  width: number,
  height: number,
  x: number,
  y: number,
  opts: DenoiseOptions,
  original: RgbPixel,
): RgbPixel {
  const r = opts.radius;
  const rMed = median(windowSamples(channels.r, width, height, x, y, r));
  const gMed = median(windowSamples(channels.g, width, height, x, y, r));
  const bMed = median(windowSamples(channels.b, width, height, x, y, r));
  const t = clamp(opts.strength / 100, 0, 1);
  const blend = (orig: number, m: number) => orig + (m - orig) * t;
  return {
    r: clampByte(blend(original.r, rMed)),
    g: clampByte(blend(original.g, gMed)),
    b: clampByte(blend(original.b, bMed)),
    a: original.a,
  };
}

/** Split interleaved RGBA bytes into separate channel float arrays. */
export function splitChannels(rgba: Uint8ClampedArray, width: number, height: number) {
  const n = width * height;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    r[p] = rgba[i]!;
    g[p] = rgba[i + 1]!;
    b[p] = rgba[i + 2]!;
  }
  return { r, g, b };
}

export function validateDenoiseOptions(opts: DenoiseOptions): { ok: true } | { error: string } {
  if (!Number.isInteger(opts.radius) || opts.radius < 1 || opts.radius > 5) return { error: "Radius must be an integer 1-5" };
  if (opts.strength < 0 || opts.strength > 100) return { error: "Strength must be 0-100" };
  return { ok: true };
}
