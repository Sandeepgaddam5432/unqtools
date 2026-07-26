/**
 * Image Histogram Viewer — pure logic.
 * Computes RGB + luminance histograms, statistics, clipping, cumulative distribution,
 * and equalization mapping. Pure functions take raw pixel data (RGBA Uint8ClampedArray).
 */

export interface HistogramData {
  r: number[]; // 256 buckets
  g: number[];
  b: number[];
  luminance: number[];
  total: number;
}

export interface HistogramStats {
  mean: { r: number; g: number; b: number; luminance: number };
  median: { r: number; g: number; b: number; luminance: number };
  std: { r: number; g: number; b: number; luminance: number };
  min: { r: number; g: number; b: number; luminance: number };
  max: { r: number; g: number; b: number; luminance: number };
  mode: { r: number; g: number; b: number; luminance: number };
}

export interface ClippingInfo {
  shadowClipping: { r: number; g: number; b: number; luminance: number }; // count of pixels at 0
  highlightClipping: { r: number; g: number; b: number; luminance: number }; // count of pixels at 255
  shadowPct: { r: number; g: number; b: number; luminance: number };
  highlightPct: { r: number; g: number; b: number; luminance: number };
  thresholdShadow: number;
  thresholdHighlight: number;
}

/** Compute RGB + luminance histograms from raw pixel data. */
export function computeHistogram(pixels: Uint8ClampedArray | Uint8Array): HistogramData {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);
  let total = 0;
  // Luminance formula (Rec. 709)
  for (let i = 0; i < pixels.length; i += 4) {
    const R = pixels[i];
    const G = pixels[i + 1];
    const B = pixels[i + 2];
    const A = pixels[i + 3];
    if (A === 0) continue;
    r[R]++;
    g[G]++;
    b[B]++;
    // Rec. 709 luminance
    const l = Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B);
    luminance[Math.min(255, Math.max(0, l))]++;
    total++;
  }
  return { r, g, b, luminance, total };
}

/** Compute statistics for each channel. */
export function computeStats(hist: HistogramData): HistogramStats {
  const stats = (channel: number[]): { mean: number; median: number; std: number; min: number; max: number; mode: number } => {
    let sum = 0;
    let totalPixels = 0;
    let min = -1;
    let max = -1;
    let modeValue = 0;
    let modeCount = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * channel[i];
      totalPixels += channel[i];
      if (channel[i] > 0 && min === -1) min = i;
      if (channel[i] > 0) max = i;
      if (channel[i] > modeCount) {
        modeCount = channel[i];
        modeValue = i;
      }
    }
    const mean = totalPixels > 0 ? sum / totalPixels : 0;
    // Median
    let cum = 0;
    let median = 0;
    const half = totalPixels / 2;
    for (let i = 0; i < 256; i++) {
      cum += channel[i];
      if (cum >= half) {
        median = i;
        break;
      }
    }
    // Std dev
    let variance = 0;
    for (let i = 0; i < 256; i++) {
      variance += channel[i] * (i - mean) ** 2;
    }
    variance = totalPixels > 0 ? variance / totalPixels : 0;
    return {
      mean: Math.round(mean * 100) / 100,
      median,
      std: Math.round(Math.sqrt(variance) * 100) / 100,
      min: min === -1 ? 0 : min,
      max: max === -1 ? 0 : max,
      mode: modeValue,
    };
  };
  const rs = stats(hist.r);
  const gs = stats(hist.g);
  const bs = stats(hist.b);
  const ls = stats(hist.luminance);
  return {
    mean: { r: rs.mean, g: gs.mean, b: bs.mean, luminance: ls.mean },
    median: { r: rs.median, g: gs.median, b: bs.median, luminance: ls.median },
    std: { r: rs.std, g: gs.std, b: bs.std, luminance: ls.std },
    min: { r: rs.min, g: gs.min, b: bs.min, luminance: ls.min },
    max: { r: rs.max, g: gs.max, b: bs.max, luminance: ls.max },
    mode: { r: rs.mode, g: gs.mode, b: bs.mode, luminance: ls.mode },
  };
}

/** Detect clipping at the extremes (shadows = 0, highlights = 255). */
export function detectClipping(hist: HistogramData, thresholdShadow = 5, thresholdHighlight = 250): ClippingInfo {
  const pct = (count: number) => (hist.total > 0 ? (count / hist.total) * 100 : 0);
  const channelClip = (channel: number[]) => {
    let shadow = 0;
    let highlight = 0;
    for (let i = 0; i <= thresholdShadow; i++) shadow += channel[i];
    for (let i = thresholdHighlight; i < 256; i++) highlight += channel[i];
    return { count: shadow, highlightCount: highlight };
  };
  const r = channelClip(hist.r);
  const g = channelClip(hist.g);
  const b = channelClip(hist.b);
  const l = channelClip(hist.luminance);
  return {
    shadowClipping: { r: r.count, g: g.count, b: b.count, luminance: l.count },
    highlightClipping: { r: r.highlightCount, g: g.highlightCount, b: b.highlightCount, luminance: l.highlightCount },
    shadowPct: {
      r: Math.round(pct(r.count) * 100) / 100,
      g: Math.round(pct(g.count) * 100) / 100,
      b: Math.round(pct(b.count) * 100) / 100,
      luminance: Math.round(pct(l.count) * 100) / 100,
    },
    highlightPct: {
      r: Math.round(pct(r.highlightCount) * 100) / 100,
      g: Math.round(pct(g.highlightCount) * 100) / 100,
      b: Math.round(pct(b.highlightCount) * 100) / 100,
      luminance: Math.round(pct(l.highlightCount) * 100) / 100,
    },
    thresholdShadow,
    thresholdHighlight,
  };
}

/** Cumulative distribution function (CDF) for a channel. */
export function computeCDF(channel: number[]): number[] {
  const cdf = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < 256; i++) total += channel[i];
  if (total === 0) return cdf;
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += channel[i];
    cdf[i] = cum / total;
  }
  return cdf;
}

/** Compute histogram equalization lookup table for one channel. */
export function equalizeLUT(channel: number[]): number[] {
  const cdf = computeCDF(channel);
  // Find cdf_min (first non-zero)
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }
  const lut = new Array(256).fill(0);
  const denom = 1 - cdfMin;
  for (let i = 0; i < 256; i++) {
    let v: number;
    if (denom === 0) {
      // All values concentrated in one bin — map non-zero to 255
      v = cdf[i] > 0 ? 255 : 0;
    } else {
      v = Math.round(((cdf[i] - cdfMin) / denom) * 255);
    }
    lut[i] = Math.min(255, Math.max(0, v));
  }
  return lut;
}

/** Apply a LUT to raw pixel data. Returns new array. */
export function applyLUT(pixels: Uint8ClampedArray | Uint8Array, lutR: number[], lutG: number[], lutB: number[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i] = lutR[pixels[i]];
    out[i + 1] = lutG[pixels[i + 1]];
    out[i + 2] = lutB[pixels[i + 2]];
    out[i + 3] = pixels[i + 3];
  }
  return out;
}

/** Apply histogram equalization to all RGB channels. Returns new pixel data. */
export function equalizeHistogram(pixels: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const hist = computeHistogram(pixels);
  const lutR = equalizeLUT(hist.r);
  const lutG = equalizeLUT(hist.g);
  const lutB = equalizeLUT(hist.b);
  return applyLUT(pixels, lutR, lutG, lutB);
}

/** Compute image entropy (bits per pixel) for the luminance channel. */
export function computeEntropy(hist: HistogramData): number {
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    const p = hist.luminance[i] / hist.total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 100) / 100;
}

/** Compute contrast ratio: std dev of luminance / mean luminance. */
export function computeContrastRatio(hist: HistogramData): number {
  const stats = computeStats(hist);
  if (stats.mean.luminance === 0) return 0;
  return Math.round((stats.std.luminance / stats.mean.luminance) * 100) / 100;
}

/** Detect exposure: -1 = under, 0 = correct, +1 = over. */
export function detectExposure(hist: HistogramData): { value: number; label: string } {
  const stats = computeStats(hist);
  const mean = stats.mean.luminance;
  if (mean < 80) return { value: -1, label: "Underexposed" };
  if (mean > 200) return { value: 1, label: "Overexposed" };
  return { value: 0, label: "Well-exposed" };
}

/** Compute color balance: average R/G/B values. */
export function colorBalance(hist: HistogramData): { r: number; g: number; b: number; warmTint: number } {
  const stats = computeStats(hist);
  const warmTint = Math.round(((stats.mean.r - stats.mean.b) / 255) * 100);
  return {
    r: Math.round(stats.mean.r),
    g: Math.round(stats.mean.g),
    b: Math.round(stats.mean.b),
    warmTint,
  };
}

/** Downsample histogram to N buckets (e.g. for compact display). */
export function downsample(channel: number[], buckets: number): number[] {
  if (buckets >= 256) return channel.slice();
  const out = new Array(buckets).fill(0);
  const bucketSize = 256 / buckets;
  for (let i = 0; i < 256; i++) {
    const idx = Math.min(buckets - 1, Math.floor(i / bucketSize));
    out[idx] += channel[i];
  }
  return out;
}

/** Find the peak value across all channels (for y-axis scaling). */
export function peakValue(hist: HistogramData, excludeExtremes = false): number {
  const max = (channel: number[]): number => {
    let m = 0;
    for (let i = 0; i < 256; i++) {
      if (excludeExtremes && (i === 0 || i === 255)) continue;
      if (channel[i] > m) m = channel[i];
    }
    return m;
  };
  return Math.max(max(hist.r), max(hist.g), max(hist.b), max(hist.luminance));
}

/** Convert histogram to a normalized 0-1 scale for visualization. */
export function normalizeForDisplay(channel: number[], peak: number): number[] {
  if (peak === 0) return new Array(256).fill(0);
  return channel.map((v) => v / peak);
}

/** Compute dynamic range: difference between darkest and lightest non-clipped values. */
export function dynamicRange(hist: HistogramData): { stops: number; ev: number } {
  const stats = computeStats(hist);
  const darkest = Math.max(1, stats.min.luminance);
  const lightest = Math.min(254, stats.max.luminance);
  if (lightest <= darkest) return { stops: 0, ev: 0 };
  const stops = Math.log2(lightest / darkest);
  return { stops: Math.round(stops * 100) / 100, ev: Math.round(stops * 100) / 100 };
}

/** Sample a histogram from a small subset of pixels (for performance on large images). */
export function sampleHistogram(pixels: Uint8ClampedArray | Uint8Array, sampleEvery = 4): HistogramData {
  const sampled: number[] = [];
  for (let i = 0; i < pixels.length; i += 4 * sampleEvery) {
    sampled.push(pixels[i]);
    sampled.push(pixels[i + 1]);
    sampled.push(pixels[i + 2]);
    sampled.push(pixels[i + 3]);
  }
  return computeHistogram(new Uint8ClampedArray(sampled));
}

/** Summary report: combine all analyses into a single object. */
export function fullAnalysis(pixels: Uint8ClampedArray | Uint8Array): {
  histogram: HistogramData;
  stats: HistogramStats;
  clipping: ClippingInfo;
  entropy: number;
  contrast: number;
  exposure: { value: number; label: string };
  colorBalance: { r: number; g: number; b: number; warmTint: number };
  dynamicRange: { stops: number; ev: number };
} {
  const histogram = computeHistogram(pixels);
  return {
    histogram,
    stats: computeStats(histogram),
    clipping: detectClipping(histogram),
    entropy: computeEntropy(histogram),
    contrast: computeContrastRatio(histogram),
    exposure: detectExposure(histogram),
    colorBalance: colorBalance(histogram),
    dynamicRange: dynamicRange(histogram),
  };
}
