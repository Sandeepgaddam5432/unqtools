/**
 * Image Fisheye Effect — pure math for barrel/pincushion distortion.
 * r' = r * (1 + k * r^2). k > 0 → barrel, k < 0 → pincushion.
 */
export interface FisheyeOptions {
  /** -1..1 — distortion strength. Positive = barrel, negative = pincushion. */
  strength: number;
  /** 0..1 — zoom to keep edges inside frame. */
  zoom: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Validate fisheye options. */
export function validateFisheyeOptions(opts: FisheyeOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.strength) || opts.strength < -1 || opts.strength > 1) {
    return { error: "Strength must be between -1 and 1" };
  }
  if (!Number.isFinite(opts.zoom) || opts.zoom < 0 || opts.zoom > 2) {
    return { error: "Zoom must be between 0 and 2" };
  }
  return { ok: true };
}

/**
 * Map a destination pixel (dx, dy) back to the source pixel (sx, sy) that
 * should be sampled to produce the fisheye effect at (dx, dy).
 * Normalized coordinates are in [-1, 1] relative to image center.
 */
export function mapPixel(dx: number, dy: number, width: number, height: number, opts: FisheyeOptions): PixelCoord {
  const cx = width / 2;
  const cy = height / 2;
  const nx = (dx - cx) / cx;
  const ny = (dy - cy) / cy;
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r === 0) return { x: dx, y: dy };
  // r' = r * (1 + k * r^2)
  const rPrime = r * (1 + opts.strength * r * r);
  const scale = rPrime / r / Math.max(opts.zoom, 1e-6);
  const sx = clamp(nx * scale * cx + cx, 0, width - 1);
  const sy = clamp(ny * scale * cy + cy, 0, height - 1);
  return { x: sx, y: sy };
}

/** Compute the distortion factor (rPrime / r) at a given normalized radius. */
export function distortionFactor(r: number, strength: number): number {
  if (r === 0) return 1;
  return 1 + strength * r * r;
}

/** Bilinear sample of a flat RGBA array. */
export function bilinearSample(rgba: Uint8ClampedArray, w: number, h: number, x: number, y: number): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (clamp(y0, 0, h - 1) * w + clamp(x0, 0, w - 1)) * 4;
  const i10 = (clamp(y0, 0, h - 1) * w + clamp(x1, 0, w - 1)) * 4;
  const i01 = (clamp(y1, 0, h - 1) * w + clamp(x0, 0, w - 1)) * 4;
  const i11 = (clamp(y1, 0, h - 1) * w + clamp(x1, 0, w - 1)) * 4;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = rgba[i00 + c]! * (1 - fx) + rgba[i10 + c]! * fx;
    const bot = rgba[i01 + c]! * (1 - fx) + rgba[i11 + c]! * fx;
    out[c] = Math.round(top * (1 - fy) + bot * fy);
  }
  return out;
}
