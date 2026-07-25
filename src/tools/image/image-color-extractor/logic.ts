/**
 * Image Color Extractor — pure logic. No DOM access.
 *
 * Implements a lightweight k-means color quantization. The UI samples pixels
 * from a canvas ImageData and calls `quantize()` on the resulting RGB array.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

export interface Swatch {
  /** Centroid color. */
  color: RgbPixel;
  /** Fraction of pixels in this cluster (0-1). */
  weight: number;
  /** HEX representation. */
  hex: string;
}

export interface QuantizeOptions {
  /** Number of clusters. */
  k: number;
  /** Maximum iterations. */
  maxIterations: number;
  /** Deterministic seed (initial centroids picked deterministically). */
  seed?: number;
}

/** Convert RGB to HEX. */
export function rgbToHex({ r, g, b }: RgbPixel): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Simple seeded PRNG for deterministic init. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Square Euclidean distance between two RGB colors. */
export function colorDistanceSquared(a: RgbPixel, b: RgbPixel): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Run k-means clustering on a sample of pixels. */
export function quantize(pixels: RgbPixel[], opts: QuantizeOptions): Swatch[] | { error: string } {
  if (pixels.length === 0) return { error: "No pixels to quantize" };
  if (opts.k <= 0) return { error: "k must be positive" };
  if (opts.k > pixels.length) return { error: "k larger than pixel count" };

  const rng = makeRng(opts.seed ?? 1);
  // Initialize centroids by sampling k distinct pixels uniformly at random.
  const centroids: RgbPixel[] = [];
  const used = new Set<number>();
  while (centroids.length < opts.k) {
    const idx = Math.floor(rng() * pixels.length);
    if (used.has(idx)) continue;
    used.add(idx);
    centroids.push({ ...pixels[idx]! });
  }

  const assignments = new Array<number>(pixels.length).fill(0);
  for (let iter = 0; iter < opts.maxIterations; iter++) {
    let changed = false;
    // Assign each pixel to the nearest centroid.
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistanceSquared(pixels[i]!, centroids[c]!);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;
    // Recompute centroids.
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i]!;
      sums[c]!.r += pixels[i]!.r;
      sums[c]!.g += pixels[i]!.g;
      sums[c]!.b += pixels[i]!.b;
      sums[c]!.n += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c]!.n > 0) {
        centroids[c] = {
          r: sums[c]!.r / sums[c]!.n,
          g: sums[c]!.g / sums[c]!.n,
          b: sums[c]!.b / sums[c]!.n,
        };
      }
    }
  }

  // Build swatches sorted by weight (descending).
  const counts = new Array<number>(opts.k).fill(0);
  for (let i = 0; i < assignments.length; i++) counts[assignments[i]!]++;
  const swatches: Swatch[] = centroids.map((color, idx) => ({
    color: { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) },
    weight: counts[idx]! / pixels.length,
    hex: rgbToHex({ r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) }),
  }));
  swatches.sort((a, b) => b.weight - a.weight);
  return swatches;
}

/** Sample N pixels uniformly from a larger pixel array. */
export function samplePixels(pixels: RgbPixel[], target: number): RgbPixel[] {
  if (pixels.length <= target) return pixels;
  const step = pixels.length / target;
  const out: RgbPixel[] = [];
  for (let i = 0; i < target; i++) {
    out.push(pixels[Math.floor(i * step)]!);
  }
  return out;
}
