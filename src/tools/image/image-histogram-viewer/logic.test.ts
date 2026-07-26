import { describe, it, expect } from "vitest";
import {
  computeHistogram,
  computeStats,
  detectClipping,
  computeCDF,
  equalizeLUT,
  applyLUT,
  equalizeHistogram,
  computeEntropy,
  computeContrastRatio,
  detectExposure,
  colorBalance,
  downsample,
  peakValue,
  normalizeForDisplay,
  dynamicRange,
  sampleHistogram,
  fullAnalysis,
} from "./logic";

function makePixels(values: number[][]): Uint8ClampedArray {
  // values: [[r,g,b], [r,g,b], ...]
  const arr: number[] = [];
  for (const [r, g, b] of values) {
    arr.push(r, g, b, 255);
  }
  return new Uint8ClampedArray(arr);
}

describe("computeHistogram", () => {
  it("counts pixels per bin", () => {
    const pixels = makePixels([[0, 0, 0], [255, 255, 255]]);
    const h = computeHistogram(pixels);
    expect(h.r[0]).toBe(1);
    expect(h.r[255]).toBe(1);
    expect(h.total).toBe(2);
  });
  it("skips fully transparent pixels", () => {
    const arr = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
    const h = computeHistogram(arr);
    expect(h.total).toBe(1);
  });
  it("computes luminance using Rec. 709", () => {
    const pixels = makePixels([[255, 255, 255]]);
    const h = computeHistogram(pixels);
    expect(h.luminance[255]).toBe(1);
  });
});

describe("computeStats", () => {
  it("computes mean correctly", () => {
    const pixels = makePixels([[0, 0, 0], [128, 128, 128], [255, 255, 255]]);
    const h = computeHistogram(pixels);
    const s = computeStats(h);
    // Mean of 0, 128, 255 ≈ 127.67
    expect(s.mean.r).toBeCloseTo(127.67, 0);
  });
  it("finds median", () => {
    const pixels = makePixels([[0, 0, 0], [50, 50, 50], [100, 100, 100], [200, 200, 200], [255, 255, 255]]);
    const h = computeHistogram(pixels);
    const s = computeStats(h);
    expect(s.median.r).toBe(100);
  });
  it("finds min and max", () => {
    const pixels = makePixels([[10, 10, 10], [200, 200, 200]]);
    const h = computeHistogram(pixels);
    const s = computeStats(h);
    expect(s.min.r).toBe(10);
    expect(s.max.r).toBe(200);
  });
  it("finds mode", () => {
    const pixels = makePixels([[50, 50, 50], [50, 50, 50], [200, 200, 200]]);
    const h = computeHistogram(pixels);
    const s = computeStats(h);
    expect(s.mode.r).toBe(50);
  });
  it("computes standard deviation", () => {
    const pixels = makePixels([[0, 0, 0], [255, 255, 255]]);
    const h = computeHistogram(pixels);
    const s = computeStats(h);
    expect(s.std.r).toBeGreaterThan(120);
  });
});

describe("detectClipping", () => {
  it("detects shadow clipping at 0", () => {
    const pixels = makePixels([[0, 0, 0], [0, 0, 0], [128, 128, 128]]);
    const h = computeHistogram(pixels);
    const c = detectClipping(h, 5, 250);
    expect(c.shadowClipping.r).toBe(2);
    expect(c.shadowPct.r).toBeCloseTo(66.67, 0);
  });
  it("detects highlight clipping at 255", () => {
    const pixels = makePixels([[255, 255, 255], [255, 255, 255], [128, 128, 128]]);
    const h = computeHistogram(pixels);
    const c = detectClipping(h);
    expect(c.highlightClipping.r).toBe(2);
  });
  it("respects custom thresholds", () => {
    const pixels = makePixels([[10, 10, 10], [128, 128, 128]]);
    const h = computeHistogram(pixels);
    const c = detectClipping(h, 20, 240);
    expect(c.shadowClipping.r).toBe(1);
  });
});

describe("computeCDF", () => {
  it("cumulatively sums", () => {
    const channel = [10, 20, 30, 0, 0];
    const padded = [...channel, ...new Array(251).fill(0)];
    const cdf = computeCDF(padded);
    expect(cdf[0]).toBeCloseTo(10 / 60, 2);
    expect(cdf[2]).toBeCloseTo(1, 2);
  });
  it("returns zeros for empty channel", () => {
    const cdf = computeCDF(new Array(256).fill(0));
    expect(cdf[100]).toBe(0);
  });
});

describe("equalizeLUT", () => {
  it("maps darkest non-zero to 0", () => {
    const channel = new Array(256).fill(0);
    channel[10] = 10;
    channel[200] = 10;
    const lut = equalizeLUT(channel);
    expect(lut[10]).toBeLessThan(50);
    expect(lut[200]).toBeGreaterThan(200);
  });
  it("spreads values across 0-255", () => {
    const channel = new Array(256).fill(0);
    channel[100] = 50;
    const lut = equalizeLUT(channel);
    expect(lut[100]).toBe(255);
  });
});

describe("applyLUT & equalizeHistogram", () => {
  it("applies LUT to pixels", () => {
    const pixels = makePixels([[0, 0, 0], [255, 255, 255]]);
    const lutR = new Array(256).fill(0).map((_, i) => 255 - i);
    const lutG = lutR;
    const lutB = lutR;
    const out = applyLUT(pixels, lutR, lutG, lutB);
    expect(out[0]).toBe(255); // 0 → 255
    expect(out[4]).toBe(0); // 255 → 0
  });
  it("equalizeHistogram produces output of same length", () => {
    const pixels = makePixels([[10, 20, 30], [200, 210, 220]]);
    const out = equalizeHistogram(pixels);
    expect(out.length).toBe(pixels.length);
  });
});

describe("computeEntropy", () => {
  it("returns 0 for uniform image", () => {
    const pixels = makePixels([[100, 100, 100], [100, 100, 100]]);
    const h = computeHistogram(pixels);
    expect(computeEntropy(h)).toBe(0);
  });
  it("returns higher entropy for varied image", () => {
    const pixels = makePixels([
      [0, 0, 0], [50, 50, 50], [100, 100, 100], [150, 150, 150], [200, 200, 200], [255, 255, 255],
    ]);
    const h = computeHistogram(pixels);
    expect(computeEntropy(h)).toBeGreaterThan(1);
  });
});

describe("computeContrastRatio", () => {
  it("returns 0 for flat image", () => {
    const pixels = makePixels([[100, 100, 100], [100, 100, 100]]);
    const h = computeHistogram(pixels);
    expect(computeContrastRatio(h)).toBe(0);
  });
  it("returns positive for high-contrast image", () => {
    const pixels = makePixels([[0, 0, 0], [255, 255, 255]]);
    const h = computeHistogram(pixels);
    expect(computeContrastRatio(h)).toBeGreaterThan(0.5);
  });
});

describe("detectExposure", () => {
  it("detects underexposure", () => {
    const pixels = makePixels([[10, 10, 10], [20, 20, 20]]);
    const h = computeHistogram(pixels);
    expect(detectExposure(h).value).toBe(-1);
  });
  it("detects overexposure", () => {
    const pixels = makePixels([[240, 240, 240], [250, 250, 250]]);
    const h = computeHistogram(pixels);
    expect(detectExposure(h).value).toBe(1);
  });
  it("detects well-exposed", () => {
    const pixels = makePixels([[100, 100, 100], [150, 150, 150]]);
    const h = computeHistogram(pixels);
    expect(detectExposure(h).value).toBe(0);
  });
});

describe("colorBalance", () => {
  it("computes average color", () => {
    const pixels = makePixels([[200, 100, 50]]);
    const h = computeHistogram(pixels);
    const cb = colorBalance(h);
    expect(cb.r).toBe(200);
    expect(cb.g).toBe(100);
    expect(cb.b).toBe(50);
  });
  it("computes warm tint (R-B)", () => {
    const pixels = makePixels([[200, 100, 50]]);
    const h = computeHistogram(pixels);
    const cb = colorBalance(h);
    expect(cb.warmTint).toBeGreaterThan(0); // warm
  });
});

describe("downsample", () => {
  it("reduces buckets", () => {
    const channel = new Array(256).fill(0);
    channel[0] = 5;
    channel[128] = 3;
    const ds = downsample(channel, 4);
    expect(ds.length).toBe(4);
    expect(ds[0]).toBe(5);
  });
});

describe("peakValue & normalizeForDisplay", () => {
  it("finds peak", () => {
    const channel = new Array(256).fill(0);
    channel[100] = 50;
    const h = { r: channel, g: channel, b: channel, luminance: channel, total: 50 };
    expect(peakValue(h)).toBe(50);
  });
  it("normalizes to 0-1", () => {
    const channel = new Array(256).fill(0);
    channel[100] = 50;
    const norm = normalizeForDisplay(channel, 50);
    expect(norm[100]).toBeCloseTo(1, 2);
  });
});

describe("dynamicRange", () => {
  it("computes stops between darkest and lightest", () => {
    const pixels = makePixels([[10, 10, 10], [200, 200, 200]]);
    const h = computeHistogram(pixels);
    const dr = dynamicRange(h);
    expect(dr.stops).toBeGreaterThan(4);
  });
});

describe("sampleHistogram", () => {
  it("samples every Nth pixel", () => {
    const pixels = makePixels([
      [0, 0, 0], [50, 50, 50], [100, 100, 100], [150, 150, 150], [200, 200, 200], [255, 255, 255],
    ]);
    const h = sampleHistogram(pixels, 2);
    expect(h.total).toBe(3); // samples 3 of 6
  });
});

describe("fullAnalysis", () => {
  it("combines all analyses", () => {
    const pixels = makePixels([[0, 0, 0], [128, 128, 128], [255, 255, 255]]);
    const a = fullAnalysis(pixels);
    expect(a.histogram.total).toBe(3);
    expect(a.stats.mean.r).toBeGreaterThan(0);
    expect(a.exposure.value).toBe(0);
    expect(a.colorBalance.r).toBeGreaterThan(0);
  });
});
