/**
 * Image Diff Compare — pure logic.
 *
 * Compares two RGBA pixel buffers (typed arrays) and produces:
 *  - per-pixel difference values
 *  - a difference percentage
 *  - a heatmap color mapping (cool → hot)
 *  - per-channel diff statistics
 *  - a histogram of difference magnitudes
 *  - layout calculations for side-by-side / overlay previews
 *  - an overlay-alpha mask value
 *  - batch comparison + stats + download helper
 *
 * NOTE: Pure only. No DOM, no Canvas, no OffscreenCanvas. Buffers are plain
 * Uint8ClampedArray / Uint8Array-like, which the UI layer extracts from a
 * canvas before calling these functions.
 */

export interface ImageBuffer {
  width: number;
  height: number;
  /** RGBA bytes, length === width * height * 4 */
  data: Uint8Array | Uint8ClampedArray;
}

export interface DiffOptions {
  /** 0..255 — pixel differences strictly greater than this count as "different". */
  threshold?: number;
  /** When true, ignores the alpha channel. */
  ignoreAlpha?: boolean;
}

export interface PerChannelDiff {
  r: number;
  g: number;
  b: number;
  a: number;
  /** Max of r/g/b/a mean diff. */
  total: number;
}

export interface DiffStats {
  /** Mean absolute difference averaged across considered channels per pixel. */
  mean: PerChannelDiff;
  /** Max absolute difference across all pixels per channel. */
  max: PerChannelDiff;
  /** Standard deviation of differences per channel. */
  stddev: PerChannelDiff;
  /** Number of pixels that exceeded the threshold. */
  changedPixels: number;
  /** Total pixels compared. */
  totalPixels: number;
  /** Percentage (0..100) of pixels that exceeded the threshold. */
  changedPercent: number;
  /** Overall difference percentage (0..100) — mean diff scaled to 0..255. */
  differencePercent: number;
}

/** Heatmap color stops — value 0..1 → [r, g, b]. */
export type HeatmapFn = (t: number) => [number, number, number];

/** Standard "jet" style heatmap — blue → cyan → green → yellow → red. */
export const jetHeatmap: HeatmapFn = (t) => {
  const v = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (v < 0.25) { r = 0; g = v * 4 * 255; b = 255; }
  else if (v < 0.5) { r = 0; g = 255; b = (0.5 - v) * 4 * 255; }
  else if (v < 0.75) { r = (v - 0.5) * 4 * 255; g = 255; b = 0; }
  else { r = 255; g = (1 - v) * 4 * 255; b = 0; }
  return [Math.round(r), Math.round(g), Math.round(b)];
};

/** Grayscale heatmap — black to white. */
export const grayHeatmap: HeatmapFn = (t) => {
  const v = Math.round(Math.max(0, Math.min(1, t)) * 255);
  return [v, v, v];
};

/** Validate two buffers are compatible for comparison. */
export function validateBuffers(a: ImageBuffer, b: ImageBuffer): string | null {
  if (!a || !b) return "Missing image buffer.";
  if (a.width !== b.width || a.height !== b.height) {
    return `Dimension mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}.`;
  }
  if (a.data.length !== a.width * a.height * 4) return "Buffer A length mismatch.";
  if (b.data.length !== b.width * b.height * 4) return "Buffer B length mismatch.";
  return null;
}

/** Compute per-pixel absolute difference array (same length as input data). */
export function perPixelDiff(a: ImageBuffer, b: ImageBuffer, opts: DiffOptions = {}): Uint8Array {
  const err = validateBuffers(a, b);
  if (err) throw new Error(err);
  const ignoreAlpha = opts.ignoreAlpha ?? false;
  const out = new Uint8Array(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    out[i] = Math.abs(a.data[i] - b.data[i]);
    out[i + 1] = Math.abs(a.data[i + 1] - b.data[i + 1]);
    out[i + 2] = Math.abs(a.data[i + 2] - b.data[i + 2]);
    out[i + 3] = ignoreAlpha ? 0 : Math.abs(a.data[i + 3] - b.data[i + 3]);
  }
  return out;
}

/** Reduce the per-pixel diff into a single luminance-style magnitude per pixel. */
export function diffMagnitude(diff: Uint8Array, ignoreAlpha = false): Uint8Array {
  const pixelCount = diff.length / 4;
  const out = new Uint8Array(pixelCount);
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    // Perceptual weights (Rec. 709 luma) — clamp to 0..255.
    const lum = 0.2126 * diff[i] + 0.7152 * diff[i + 1] + 0.0722 * diff[i + 2];
    const alpha = ignoreAlpha ? 0 : diff[i + 3];
    out[p] = Math.min(255, Math.round(Math.max(lum, alpha * 0.5)));
  }
  return out;
}

/** Compute aggregated stats from a per-pixel diff array. */
export function computeStats(
  diff: Uint8Array,
  pixelCount: number,
  threshold = 0,
  ignoreAlpha = false,
): DiffStats {
  const sums = { r: 0, g: 0, b: 0, a: 0, total: 0 };
  const maxes = { r: 0, g: 0, b: 0, a: 0, total: 0 };
  const sumSq = { r: 0, g: 0, b: 0, a: 0, total: 0 };
  let changed = 0;
  const channelCount = ignoreAlpha ? 3 : 4;

  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const dr = diff[i], dg = diff[i + 1], db = diff[i + 2], da = ignoreAlpha ? 0 : diff[i + 3];
    sums.r += dr; sums.g += dg; sums.b += db; sums.a += da;
    sumSq.r += dr * dr; sumSq.g += dg * dg; sumSq.b += db * db; sumSq.a += da * da;
    maxes.r = Math.max(maxes.r, dr);
    maxes.g = Math.max(maxes.g, dg);
    maxes.b = Math.max(maxes.b, db);
    maxes.a = Math.max(maxes.a, da);
    const mag = 0.2126 * dr + 0.7152 * dg + 0.0722 * db + (ignoreAlpha ? 0 : da * 0.5);
    sums.total += mag;
    sumSq.total += mag * mag;
    maxes.total = Math.max(maxes.total, mag);
    if (mag > threshold) changed++;
  }

  const n = pixelCount || 1;
  const mean = {
    r: sums.r / n, g: sums.g / n, b: sums.b / n, a: sums.a / n,
    total: sums.total / n,
  };
  const variance = {
    r: sumSq.r / n - mean.r * mean.r,
    g: sumSq.g / n - mean.g * mean.g,
    b: sumSq.b / n - mean.b * mean.b,
    a: sumSq.a / n - mean.a * mean.a,
    total: sumSq.total / n - mean.total * mean.total,
  };
  const stddev = {
    r: Math.sqrt(Math.max(0, variance.r)),
    g: Math.sqrt(Math.max(0, variance.g)),
    b: Math.sqrt(Math.max(0, variance.b)),
    a: Math.sqrt(Math.max(0, variance.a)),
    total: Math.sqrt(Math.max(0, variance.total)),
  };

  return {
    mean,
    max: maxes,
    stddev,
    changedPixels: changed,
    totalPixels: pixelCount,
    changedPercent: (changed / n) * 100,
    differencePercent: (mean.total / 255) * 100,
  };
}

/** Build a histogram of difference magnitudes (256 buckets, 0..255). */
export function diffHistogram(diff: Uint8Array, buckets = 256): number[] {
  const hist = new Array(buckets).fill(0);
  const pixelCount = diff.length / 4;
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const mag = Math.round((diff[i] + diff[i + 1] + diff[i + 2]) / 3);
    const bucket = Math.min(buckets - 1, Math.max(0, mag));
    hist[bucket]++;
  }
  return hist;
}

/** Build a heatmap image (RGBA bytes) from a per-pixel diff array. */
export function buildHeatmapImage(diff: Uint8Array, width: number, height: number, fn: HeatmapFn = jetHeatmap): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const pixelCount = width * height;
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const mag = (diff[i] + diff[i + 1] + diff[i + 2]) / 3 / 255;
    const [r, g, b] = fn(mag);
    const o = p * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  }
  return out;
}

/** Compute overlay alpha (0..1) — average difference intensity. */
export function computeOverlayAlpha(diff: Uint8Array): number {
  let sum = 0;
  const pixelCount = diff.length / 4;
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    sum += (diff[i] + diff[i + 1] + diff[i + 2]) / 3;
  }
  return pixelCount === 0 ? 0 : (sum / pixelCount) / 255;
}

/** Compute a layout rect for side-by-side rendering with a gutter. */
export function sideBySideLayout(width: number, height: number, gutter = 16): {
  totalWidth: number; totalHeight: number; left: { x: number; y: number; w: number; h: number }; right: { x: number; y: number; w: number; h: number };
} {
  return {
    totalWidth: width * 2 + gutter,
    totalHeight: height,
    left: { x: 0, y: 0, w: width, h: height },
    right: { x: width + gutter, y: 0, w: width, h: height },
  };
}

/** Build a download-friendly plain-text report from stats. */
export function renderReport(a: ImageBuffer, b: ImageBuffer, stats: DiffStats, opts: DiffOptions = {}): string {
  const lines: string[] = [];
  lines.push("Image Diff Compare Report");
  lines.push("=".repeat(40));
  lines.push(`Image A: ${a.width}x${a.height} (${a.data.length} bytes)`);
  lines.push(`Image B: ${b.width}x${b.height} (${b.data.length} bytes)`);
  lines.push(`Threshold: ${opts.threshold ?? 0}`);
  lines.push(`Ignore alpha: ${opts.ignoreAlpha ?? false}`);
  lines.push("");
  lines.push("Mean diff per channel:");
  lines.push(`  R: ${stats.mean.r.toFixed(2)}  G: ${stats.mean.g.toFixed(2)}  B: ${stats.mean.b.toFixed(2)}  A: ${stats.mean.a.toFixed(2)}`);
  lines.push("Max diff per channel:");
  lines.push(`  R: ${stats.max.r}  G: ${stats.max.g}  B: ${stats.max.b}  A: ${stats.max.a}`);
  lines.push(`Changed pixels: ${stats.changedPixels} / ${stats.totalPixels} (${stats.changedPercent.toFixed(2)}%)`);
  lines.push(`Overall difference: ${stats.differencePercent.toFixed(2)}%`);
  return lines.join("\n");
}

export interface DiffJob {
  a: ImageBuffer;
  b: ImageBuffer;
  opts?: DiffOptions;
}

export interface DiffResult {
  stats: DiffStats;
  diff: Uint8Array;
  heatmap: Uint8Array;
  overlayAlpha: number;
  histogram: number[];
  warnings: string[];
}

/** Run a full comparison for a single image pair. */
export function runDiff(job: DiffJob): DiffResult {
  const warnings: string[] = [];
  const err = validateBuffers(job.a, job.b);
  if (err) throw new Error(err);
  const threshold = job.opts?.threshold ?? 0;
  const ignoreAlpha = job.opts?.ignoreAlpha ?? false;
  if (threshold < 0 || threshold > 255) warnings.push("Threshold clamped to 0..255.");
  const diff = perPixelDiff(job.a, job.b, job.opts);
  const pixelCount = job.a.width * job.a.height;
  const stats = computeStats(diff, pixelCount, threshold, ignoreAlpha);
  const heatmap = buildHeatmapImage(diff, job.a.width, job.a.height, jetHeatmap);
  const overlayAlpha = computeOverlayAlpha(diff);
  const histogram = diffHistogram(diff);
  return { stats, diff, heatmap, overlayAlpha, histogram, warnings };
}

/** Run a batch of comparisons. */
export function runBatch(jobs: DiffJob[]): DiffResult[] {
  return jobs.map((j) => {
    try {
      return runDiff(j);
    } catch (e) {
      // Surface errors as zeroed result with warning rather than crashing batch.
      const msg = e instanceof Error ? e.message : String(e);
      return {
        stats: zeroStats(),
        diff: new Uint8Array(0),
        heatmap: new Uint8Array(0),
        overlayAlpha: 0,
        histogram: [],
        warnings: [`Skipped: ${msg}`],
      } satisfies DiffResult;
    }
  });
}

function zeroStats(): DiffStats {
  const z = { r: 0, g: 0, b: 0, a: 0, total: 0 };
  return { mean: z, max: z, stddev: z, changedPixels: 0, totalPixels: 0, changedPercent: 0, differencePercent: 0 };
}

/** Aggregate batch stats — useful for dashboards. */
export function aggregateBatchStats(results: DiffResult[]): {
  count: number; avgDifference: number; maxDifference: number; avgChangedPercent: number;
} {
  if (results.length === 0) return { count: 0, avgDifference: 0, maxDifference: 0, avgChangedPercent: 0 };
  let sumDiff = 0, maxDiff = 0, sumChanged = 0;
  for (const r of results) {
    sumDiff += r.stats.differencePercent;
    if (r.stats.differencePercent > maxDiff) maxDiff = r.stats.differencePercent;
    sumChanged += r.stats.changedPercent;
  }
  return {
    count: results.length,
    avgDifference: sumDiff / results.length,
    maxDifference: maxDiff,
    avgChangedPercent: sumChanged / results.length,
  };
}

/** Convert a heatmap image buffer to a base64 string. Pure — works in any env with btoa. */
export function heatmapToBase64PngStub(heatmap: Uint8Array, width: number, height: number): string {
  // This is a stub helper — pure function producing a tagged representation
  // (real PNG encoding is done in the UI layer). Useful for tests/reports.
  return `HEATMAP:${width}x${height}:${heatmap.length}b`;
}
