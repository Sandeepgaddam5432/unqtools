/**
 * Image Mosaic Blend — pure logic. No DOM/canvas access.
 * Alpha-blend multiple images together with a fade factor.
 */

export interface MosaicPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

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
  const w = Math.max(0, Math.min(1, weight));
  return {
    r: Math.round(base.r * (1 - w) + top.r * w),
    g: Math.round(base.g * (1 - w) + top.g * w),
    b: Math.round(base.b * (1 - w) + top.b * w),
    a: Math.round(base.a * (1 - w) + top.a * w),
  };
}

/** Reduce N images into one by averaging pixel values. */
export function averagePixels(pixels: MosaicPixel[]): MosaicPixel {
  if (pixels.length === 0) return { r: 0, g: 0, b: 0, a: 0 };
  let r = 0, g = 0, b = 0, a = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
    a += p.a;
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
export function validateSameSize(
  sizes: { width: number; height: number }[],
): { width: number; height: number } | { error: string } {
  if (sizes.length === 0) return { error: "Need at least one image" };
  const w = sizes[0].width;
  const h = sizes[0].height;
  if (w <= 0 || h <= 0) return { error: "Image dimensions must be positive" };
  for (const s of sizes) {
    if (s.width !== w || s.height !== h) {
      return { error: "All images must share the same dimensions" };
    }
  }
  return { width: w, height: h };
}
