import { describe, it, expect } from "vitest";
import {
  perPixelDiff, computeStats, diffHistogram, buildHeatmapImage, computeOverlayAlpha,
  sideBySideLayout, renderReport, runDiff, runBatch, aggregateBatchStats,
  jetHeatmap, grayHeatmap, validateBuffers, diffMagnitude, heatmapToBase64PngStub,
  type ImageBuffer,
} from "./logic";

function buf(width: number, height: number, fill: number[]): ImageBuffer {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0] ?? 0;
    data[i + 1] = fill[1] ?? 0;
    data[i + 2] = fill[2] ?? 0;
    data[i + 3] = fill[3] ?? 255;
  }
  return { width, height, data };
}

function solid(width: number, height: number, r: number, g: number, b: number, a = 255): ImageBuffer {
  return buf(width, height, [r, g, b, a]);
}

describe("image-diff-compare validateBuffers", () => {
  it("returns null for matching dimensions", () => {
    expect(validateBuffers(solid(2, 2, 0, 0, 0), solid(2, 2, 0, 0, 0))).toBeNull();
  });
  it("returns error for dimension mismatch", () => {
    expect(validateBuffers(solid(2, 2, 0, 0, 0), solid(3, 3, 0, 0, 0))).toMatch(/Dimension mismatch/);
  });
});

describe("image-diff-compare perPixelDiff", () => {
  it("computes per-pixel absolute differences", () => {
    const a = solid(2, 2, 10, 20, 30);
    const b = solid(2, 2, 40, 10, 60);
    const diff = perPixelDiff(a, b);
    expect(diff[0]).toBe(30);
    expect(diff[1]).toBe(10);
    expect(diff[2]).toBe(30);
    expect(diff[3]).toBe(0);
  });
  it("throws on dimension mismatch", () => {
    expect(() => perPixelDiff(solid(2, 2, 0, 0, 0), solid(4, 4, 0, 0, 0))).toThrow();
  });
  it("respects ignoreAlpha flag", () => {
    const a = solid(1, 1, 0, 0, 0, 100);
    const b = solid(1, 1, 0, 0, 0, 200);
    const withAlpha = perPixelDiff(a, b);
    const noAlpha = perPixelDiff(a, b, { ignoreAlpha: true });
    expect(withAlpha[3]).toBe(100);
    expect(noAlpha[3]).toBe(0);
  });
});

describe("image-diff-compare diffMagnitude", () => {
  it("returns a magnitude per pixel", () => {
    const diff = perPixelDiff(solid(1, 1, 100, 0, 0), solid(1, 1, 0, 0, 0));
    const mag = diffMagnitude(diff);
    expect(mag.length).toBe(1);
    expect(mag[0]).toBeGreaterThan(0);
  });
});

describe("image-diff-compare computeStats", () => {
  it("computes mean and max for identical images", () => {
    const a = solid(2, 2, 50, 50, 50);
    const diff = perPixelDiff(a, a);
    const stats = computeStats(diff, 4);
    expect(stats.mean.r).toBe(0);
    expect(stats.max.r).toBe(0);
    expect(stats.changedPixels).toBe(0);
    expect(stats.differencePercent).toBe(0);
  });
  it("computes changedPixels with threshold", () => {
    const a = solid(1, 2, 0, 0, 0);
    const b = solid(1, 2, 100, 100, 100);
    const diff = perPixelDiff(a, b);
    const stats = computeStats(diff, 2, 50);
    expect(stats.changedPixels).toBe(2);
    expect(stats.changedPercent).toBe(100);
  });
  it("computes nonzero max for different images", () => {
    const a = solid(1, 1, 0, 0, 0);
    const b = solid(1, 1, 200, 100, 50);
    const diff = perPixelDiff(a, b);
    const stats = computeStats(diff, 1);
    expect(stats.max.r).toBe(200);
    expect(stats.max.g).toBe(100);
    expect(stats.max.b).toBe(50);
  });
});

describe("image-diff-compare diffHistogram", () => {
  it("produces 256 buckets summing to pixel count", () => {
    const a = solid(4, 4, 0, 0, 0);
    const b = solid(4, 4, 100, 100, 100);
    const diff = perPixelDiff(a, b);
    const hist = diffHistogram(diff);
    expect(hist.length).toBe(256);
    const total = hist.reduce((s, v) => s + v, 0);
    expect(total).toBe(16);
  });
});

describe("image-diff-compare buildHeatmapImage", () => {
  it("produces an RGBA buffer of correct size", () => {
    const a = solid(2, 2, 0, 0, 0);
    const b = solid(2, 2, 100, 100, 100);
    const diff = perPixelDiff(a, b);
    const heat = buildHeatmapImage(diff, 2, 2);
    expect(heat.length).toBe(16);
    // Alpha always 255 for heatmap pixels
    expect(heat[3]).toBe(255);
  });
  it("black pixels when diff is zero", () => {
    const a = solid(1, 1, 0, 0, 0);
    const diff = perPixelDiff(a, a);
    const heat = buildHeatmapImage(diff, 1, 1, jetHeatmap);
    expect(heat[0]).toBe(0); // jet at t=0 → [0,0,255]
    expect(heat[2]).toBe(255);
  });
});

describe("image-diff-compare heatmaps", () => {
  it("jetHeatmap returns red at t=1", () => {
    const [r, g, b] = jetHeatmap(1);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
  it("grayHeatmap returns white at t=1", () => {
    const [r, g, b] = grayHeatmap(1);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
  it("jetHeatmap clamps values outside [0,1]", () => {
    const [r1] = jetHeatmap(-1);
    const [r2] = jetHeatmap(2);
    expect(r1).toBe(0);
    expect(r2).toBe(255);
  });
});

describe("image-diff-compare computeOverlayAlpha", () => {
  it("returns 0 for identical images", () => {
    const a = solid(2, 2, 50, 50, 50);
    const diff = perPixelDiff(a, a);
    expect(computeOverlayAlpha(diff)).toBe(0);
  });
  it("returns 1 for fully different images", () => {
    const a = solid(1, 1, 0, 0, 0);
    const b = solid(1, 1, 255, 255, 255);
    const diff = perPixelDiff(a, b);
    expect(computeOverlayAlpha(diff)).toBeCloseTo(1, 1);
  });
});

describe("image-diff-compare sideBySideLayout", () => {
  it("computes total dimensions and rects", () => {
    const l = sideBySideLayout(100, 50, 10);
    expect(l.totalWidth).toBe(210);
    expect(l.totalHeight).toBe(50);
    expect(l.left.w).toBe(100);
    expect(l.right.x).toBe(110);
  });
});

describe("image-diff-compare renderReport", () => {
  it("includes stats in the report", () => {
    const a = solid(2, 2, 0, 0, 0);
    const b = solid(2, 2, 100, 100, 100);
    const diff = perPixelDiff(a, b);
    const stats = computeStats(diff, 4);
    const report = renderReport(a, b, stats, { threshold: 10 });
    expect(report).toContain("Image Diff Compare Report");
    expect(report).toContain("Threshold: 10");
    expect(report).toContain("Changed pixels");
  });
});

describe("image-diff-compare runDiff", () => {
  it("returns a full DiffResult", () => {
    const a = solid(2, 2, 0, 0, 0);
    const b = solid(2, 2, 200, 200, 200);
    const r = runDiff({ a, b, opts: { threshold: 50 } });
    expect(r.stats.changedPixels).toBe(4);
    expect(r.diff.length).toBe(16);
    expect(r.heatmap.length).toBe(16);
    expect(r.histogram.length).toBe(256);
    expect(r.overlayAlpha).toBeGreaterThan(0);
  });
});

describe("image-diff-compare runBatch / aggregateBatchStats", () => {
  it("runs multiple jobs", () => {
    const jobs = [
      { a: solid(1, 1, 0, 0, 0), b: solid(1, 1, 50, 50, 50) },
      { a: solid(1, 1, 0, 0, 0), b: solid(1, 1, 100, 100, 100) },
    ];
    const results = runBatch(jobs);
    expect(results.length).toBe(2);
    const agg = aggregateBatchStats(results);
    expect(agg.count).toBe(2);
    expect(agg.maxDifference).toBeGreaterThan(0);
  });
  it("handles error jobs gracefully", () => {
    const results = runBatch([{ a: solid(1, 1, 0, 0, 0), b: solid(2, 2, 0, 0, 0) }]);
    expect(results[0].warnings.length).toBeGreaterThan(0);
    expect(results[0].stats.totalPixels).toBe(0);
  });
});

describe("image-diff-compare heatmapToBase64PngStub", () => {
  it("returns a tagged stub string", () => {
    const a = solid(1, 1, 0, 0, 0);
    const diff = perPixelDiff(a, a);
    const stub = heatmapToBase64PngStub(diff, 1, 1);
    expect(stub).toMatch(/^HEATMAP:1x1:/);
  });
});
