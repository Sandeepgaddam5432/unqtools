/**
 * Image CLAHE Tool — pure logic. No DOM/canvas access.
 * Contrast Limited Adaptive Histogram Equalization.
 */
export interface RgbPixel { r: number; g: number; b: number; a: number; }

export interface ClaheOptions {
  /** Clip limit 1-100 — higher = more contrast. */
  clipLimit: number;
  /** Tile size (pixels). Must divide image evenly when used per-tile. */
  tileSize: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Build a 256-bin intensity histogram from luminance values. */
export function buildHistogram(luminances: number[]): number[] {
  const hist = new Array<number>(256).fill(0);
  for (const v of luminances) hist[clamp(Math.round(v), 0, 255)]!++;
  return hist;
}

/** Clip histogram at clipLimit and redistribute excess uniformly. */
export function clipHistogram(hist: number[], clipLimit: number): number[] {
  const out = hist.slice();
  // clipLimit is interpreted as average count × multiplier
  const total = hist.reduce((s, v) => s + v, 0) || 1;
  const avg = total / 256;
  const limit = Math.max(1, Math.round(avg * clamp(clipLimit, 1, 100) / 10));
  let excess = 0;
  for (let i = 0; i < 256; i++) {
    if (out[i]! > limit) {
      excess += out[i]! - limit;
      out[i] = limit;
    }
  }
  const perBin = Math.floor(excess / 256);
  let rem = excess - perBin * 256;
  for (let i = 0; i < 256; i++) out[i]! += perBin;
  if (rem > 0) {
    const step = Math.max(1, Math.floor(256 / rem));
    for (let i = 0; i < 256 && rem > 0; i += step) { out[i]!++; rem--; }
  }
  return out;
}

/** Build cumulative distribution function from histogram. */
export function buildCdf(hist: number[]): number[] {
  const cdf = new Array<number>(256).fill(0);
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    cdf[i] = acc;
  }
  return cdf;
}

/** Map an input luminance (0-255) via a CDF to an output value (0-255). */
export function equalizeLuma(luma: number, cdf: number[], totalPixels: number): number {
  if (totalPixels <= 0) return luma;
  const idx = clamp(Math.round(luma), 0, 255);
  const cdfMin = cdf.find((v) => v > 0) ?? 0;
  const num = cdf[idx]! - cdfMin;
  const den = totalPixels - cdfMin || 1;
  return clamp(((num / den) * 255), 0, 255);
}

export function toLuma(p: RgbPixel): number {
  return 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
}

/** Apply equalized luma to a pixel, preserving hue/saturation by scaling channels. */
export function applyLuma(p: RgbPixel, newLuma: number): RgbPixel {
  const oldLuma = toLuma(p) || 1;
  const scale = newLuma / oldLuma;
  return { r: clampByte(p.r * scale), g: clampByte(p.g * scale), b: clampByte(p.b * scale), a: p.a };
}

export function validateClaheOptions(opts: ClaheOptions): { ok: true } | { error: string } {
  if (opts.clipLimit < 1 || opts.clipLimit > 100) return { error: "Clip limit must be 1-100" };
  if (opts.tileSize < 8 || opts.tileSize > 1024) return { error: "Tile size must be 8-1024" };
  return { ok: true };
}
