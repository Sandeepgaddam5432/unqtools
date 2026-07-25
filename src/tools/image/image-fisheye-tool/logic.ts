/**
 * Image Fisheye Effect — pure math for barrel/pincushion distortion.
 * r' = r * (1 + k * r^2). k > 0 → barrel, k < 0 → pincushion.
 *
 * Extras:
 *  1. Barrel / pincushion modes (sign of strength)
 *  2. Strength -1..1
 *  3. Zoom 0..2
 *  4. Center offset
 *  5. Batch validation
 *  6. Presets (barrel / pincushion / subtle / strong)
 *  7. Identity check
 *  8. Format-preserving transparency
 *  9. Bilinear sampling
 * 10. Distortion factor
 * 11. Luma + mean delta
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type FisheyeMode = "barrel" | "pincushion";

export interface FisheyeOptions {
  strength: number;
  zoom: number;
  /** Center offset X relative to image center, -0.5..0.5. */
  offsetX: number;
  /** Center offset Y relative to image center, -0.5..0.5. */
  offsetY: number;
  mode: FisheyeMode;
}

export interface PixelCoord {
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate fisheye options. */
export function validateFisheyeOptions(opts: FisheyeOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.strength) || opts.strength < -1 || opts.strength > 1) {
    return { error: "Strength must be between -1 and 1" };
  }
  if (!Number.isFinite(opts.zoom) || opts.zoom < 0 || opts.zoom > 2) {
    return { error: "Zoom must be between 0 and 2" };
  }
  if (opts.offsetX < -0.5 || opts.offsetX > 0.5) return { error: "offsetX must be -0.5..0.5" };
  if (opts.offsetY < -0.5 || opts.offsetY > 0.5) return { error: "offsetY must be -0.5..0.5" };
  if (!["barrel", "pincushion"].includes(opts.mode)) return { error: "Invalid mode" };
  return { ok: true };
}

/** Get the effective strength (barrel positive, pincushion negative). */
export function effectiveStrength(opts: FisheyeOptions): number {
  return opts.mode === "pincushion" ? -Math.abs(opts.strength) : Math.abs(opts.strength);
}

/** Compute center coords with offset. */
export function computeCenter(width: number, height: number, opts: FisheyeOptions): { cx: number; cy: number } {
  return { cx: width / 2 + opts.offsetX * width, cy: height / 2 + opts.offsetY * height };
}

/** Map a destination pixel (dx, dy) back to the source pixel (sx, sy) for fisheye. */
export function mapPixel(dx: number, dy: number, width: number, height: number, opts: FisheyeOptions): PixelCoord {
  const { cx, cy } = computeCenter(width, height, opts);
  const nx = (dx - cx) / cx;
  const ny = (dy - cy) / cy;
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r === 0) return { x: dx, y: dy };
  const k = effectiveStrength(opts);
  const rPrime = r * (1 + k * r * r);
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

/** True when options produce a no-op. */
export function isIdentity(opts: FisheyeOptions): boolean {
  return opts.strength === 0 && opts.zoom === 1;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: FisheyeOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateFisheyeOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<FisheyeOptions, "offsetX" | "offsetY"> }[] = [
  { id: "barrel", label: "Barrel", options: { strength: 0.5, zoom: 1, mode: "barrel" } },
  { id: "pincushion", label: "Pincushion", options: { strength: 0.5, zoom: 1, mode: "pincushion" } },
  { id: "subtle", label: "Subtle", options: { strength: 0.2, zoom: 1, mode: "barrel" } },
  { id: "strong", label: "Strong", options: { strength: 0.9, zoom: 1.1, mode: "barrel" } },
  { id: "miniature", label: "Miniature", options: { strength: 0.8, zoom: 1.5, mode: "barrel" } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

/** Convert mode + strength to signed strength. */
export function signedStrength(strength: number, mode: FisheyeMode): number {
  return mode === "pincushion" ? -Math.abs(strength) : Math.abs(strength);
}

/** Compute normalized radius for a pixel given center. */
export function normalizedRadius(dx: number, dy: number, width: number, height: number, cx: number, cy: number): number {
  const nx = (dx - cx) / cx;
  const ny = (dy - cy) / cy;
  return Math.sqrt(nx * nx + ny * ny);
}
