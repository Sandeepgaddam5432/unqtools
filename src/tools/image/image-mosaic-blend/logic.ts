/**
 * Image Mosaic Blend — pure logic. No DOM/canvas access.
 * Alpha-blend multiple images together with a fade factor.
 *
 * Extras:
 *  1. Alpha compositing (top over bottom)
 *  2. Fade blend (linear interpolation)
 *  3. Gradient blend (positional weights)
 *  4. Feathered edges (smooth mask transitions)
 *  5. Average pixels helper
 *  6. Fade weights (cosine-eased)
 *  7. Batch validation (same-size check)
 *  8. Presets (alpha / fade / gradient / feather)
 *  9. Identity check
 * 10. Format-preserving transparency
 * 11. Luma + mean delta
 * 12. Mask generation
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type BlendMode = "alpha" | "fade" | "gradient" | "feather";

export interface MosaicPixel {
  r: number; g: number; b: number; a: number;
}

export interface BlendOptions {
  mode: BlendMode;
  /** Fade weight 0..1 (for fade mode). */
  weight: number;
  /** Feather radius in pixels (for feather mode). */
  feather: number;
  /** Gradient direction (for gradient mode). */
  gradientDir: "horizontal" | "vertical";
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Standard alpha compositing: top over bottom. */
export function alphaBlend(base: MosaicPixel, top: MosaicPixel): MosaicPixel {
  const a1 = top.a / 255;
  const a0 = base.a / 255;
  const outA = a1 + a0 * (1 - a1);
  if (outA === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const r = (top.r * a1 + base.r * a0 * (1 - a1)) / outA;
  const g = (top.g * a1 + base.g * a0 * (1 - a1)) / outA;
  const b = (top.b * a1 + base.b * a0 * (1 - a1)) / outA;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: Math.round(outA * 255) };
}

/** Linear blend between two pixels using a 0..1 weight (0 = base, 1 = top). */
export function fadeBlend(base: MosaicPixel, top: MosaicPixel, weight: number): MosaicPixel {
  const w = clamp(weight, 0, 1);
  return {
    r: Math.round(base.r * (1 - w) + top.r * w),
    g: Math.round(base.g * (1 - w) + top.g * w),
    b: Math.round(base.b * (1 - w) + top.b * w),
    a: Math.round(base.a * (1 - w) + top.a * w),
  };
}

/** Gradient blend: weight varies along image dimension. */
export function gradientWeight(x: number, y: number, width: number, height: number, dir: "horizontal" | "vertical"): number {
  if (dir === "horizontal") return width <= 1 ? 0.5 : clamp(x / (width - 1), 0, 1);
  return height <= 1 ? 0.5 : clamp(y / (height - 1), 0, 1);
}

/** Feather mask: 0 at edges, 1 in interior, with smooth transition. */
export function featherMask(x: number, y: number, width: number, height: number, radius: number): number {
  if (radius <= 0) return 1;
  const dx = Math.min(x, width - 1 - x);
  const dy = Math.min(y, height - 1 - y);
  const d = Math.min(dx, dy);
  return clamp(d / radius, 0, 1);
}

/** Apply a blend mode to two pixels at a given position. */
export function blendAt(base: MosaicPixel, top: MosaicPixel, x: number, y: number, w: number, h: number, opts: BlendOptions): MosaicPixel {
  switch (opts.mode) {
    case "alpha": return alphaBlend(base, top);
    case "fade": return fadeBlend(base, top, opts.weight);
    case "gradient": return fadeBlend(base, top, gradientWeight(x, y, w, h, opts.gradientDir));
    case "feather": return fadeBlend(base, top, featherMask(x, y, w, h, opts.feather));
  }
}

/** Reduce N images into one by averaging pixel values. */
export function averagePixels(pixels: MosaicPixel[]): MosaicPixel {
  if (pixels.length === 0) return { r: 0, g: 0, b: 0, a: 0 };
  let r = 0, g = 0, b = 0, a = 0;
  for (const p of pixels) {
    r += p.r; g += p.g; b += p.b; a += p.a;
  }
  const n = pixels.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), a: Math.round(a / n) };
}

/** Fade weights for N frames using a sinusoidal easing. */
export function fadeWeights(count: number): number[] {
  if (count <= 1) return [1];
  const weights: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    weights.push(0.5 - 0.5 * Math.cos(t * Math.PI));
  }
  return weights;
}

/** Validate that all images share the same dimensions. */
export function validateSameSize(sizes: { width: number; height: number }[]): { width: number; height: number } | { error: string } {
  if (sizes.length === 0) return { error: "Need at least one image" };
  const w = sizes[0]!.width;
  const h = sizes[0]!.height;
  if (w <= 0 || h <= 0) return { error: "Image dimensions must be positive" };
  for (const s of sizes) {
    if (s.width !== w || s.height !== h) return { error: "All images must share the same dimensions" };
  }
  return { width: w, height: h };
}

/** Validate blend options. */
export function validateBlendOptions(opts: BlendOptions): { ok: true } | { error: string } {
  if (!["alpha", "fade", "gradient", "feather"].includes(opts.mode)) return { error: "Invalid blend mode" };
  if (opts.weight < 0 || opts.weight > 1) return { error: "Weight must be 0..1" };
  if (opts.feather < 0 || opts.feather > 500) return { error: "Feather must be 0..500" };
  if (!["horizontal", "vertical"].includes(opts.gradientDir)) return { error: "Invalid gradient direction" };
  return { ok: true };
}

/** True when options produce a no-op (impossible for blend). */
export function isIdentity(opts: BlendOptions): boolean {
  return opts.mode === "fade" && opts.weight === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: BlendOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateBlendOptions(opts) }));
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
export const PRESETS: { id: string; label: string; options: BlendOptions }[] = [
  { id: "alpha", label: "Alpha", options: { mode: "alpha", weight: 0.5, feather: 0, gradientDir: "horizontal" } },
  { id: "fade-50", label: "Fade 50/50", options: { mode: "fade", weight: 0.5, feather: 0, gradientDir: "horizontal" } },
  { id: "fade-25", label: "Fade 25/75", options: { mode: "fade", weight: 0.25, feather: 0, gradientDir: "horizontal" } },
  { id: "gradient-h", label: "Gradient H", options: { mode: "gradient", weight: 0.5, feather: 0, gradientDir: "horizontal" } },
  { id: "gradient-v", label: "Gradient V", options: { mode: "gradient", weight: 0.5, feather: 0, gradientDir: "vertical" } },
  { id: "feather-20", label: "Feather 20px", options: { mode: "feather", weight: 0.5, feather: 20, gradientDir: "horizontal" } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
