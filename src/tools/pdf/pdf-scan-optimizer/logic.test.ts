import { describe, it, expect } from "vitest";
import {
  parsePageRange, otsuThreshold, simulatePageStats, planScanOptimize, planBatch, renderBatchCsv,
  renderReport, getScanPresets, aggregateInkCoverage, computeCompressionRatio, type ScanJob,
} from "./logic";

describe("pdf-scan-optimizer parsePageRange", () => {
  it("parses ranges", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
  });
  it("returns all for empty", () => {
    expect(parsePageRange("", 3).length).toBe(3);
  });
});

describe("pdf-scan-optimizer otsuThreshold", () => {
  it("returns threshold in 0–255", () => {
    const hist = Array(256).fill(0).map((_, i) => (i < 128 ? 10 : 5));
    const t = otsuThreshold(hist);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(255);
  });
  it("returns 128 for empty histogram", () => {
    expect(otsuThreshold(Array(256).fill(0))).toBe(128);
  });
  it("finds bimodal split around 128", () => {
    const hist = Array(256).fill(0).map((_, i) => (i < 128 ? 100 : 100));
    const t = otsuThreshold(hist);
    expect(t).toBeGreaterThanOrEqual(125);
    expect(t).toBeLessThanOrEqual(131);
  });
});

describe("pdf-scan-optimizer simulatePageStats", () => {
  it("returns deterministic stats", () => {
    const a = simulatePageStats(0);
    const b = simulatePageStats(0);
    expect(a).toEqual(b);
  });
  it("returns valid ranges", () => {
    const s = simulatePageStats(5);
    expect(s.meanIntensity).toBeGreaterThanOrEqual(0);
    expect(s.meanIntensity).toBeLessThanOrEqual(255);
    expect(s.inkCoverage).toBeGreaterThanOrEqual(0);
    expect(s.inkCoverage).toBeLessThanOrEqual(1);
  });
});

describe("pdf-scan-optimizer planScanOptimize", () => {
  const baseJob: ScanJob = {
    totalPageCount: 5, pageRange: "1-5", binarization: "otsu", fixedThreshold: 128,
    deskew: true, maxDeskewDeg: 10, removeBlank: true, blankInkThreshold: 0.02, compression: "ccitt-g4",
    simulatedStats: [
      { meanIntensity: 200, inkCoverage: 0.15, skewDeg: 2 },
      { meanIntensity: 245, inkCoverage: 0.01, skewDeg: 0 }, // blank
      { meanIntensity: 180, inkCoverage: 0.25, skewDeg: -3 },
      { meanIntensity: 240, inkCoverage: 0.005, skewDeg: 1 }, // blank
      { meanIntensity: 190, inkCoverage: 0.10, skewDeg: 4 },
    ],
  };
  it("detects blank pages", () => {
    const r = planScanOptimize(baseJob);
    expect(r.pages.filter((p) => p.isBlank).length).toBe(2);
  });
  it("removes blank pages when removeBlank is true", () => {
    const r = planScanOptimize(baseJob);
    expect(r.pagesRemoved).toBe(2);
    expect(r.pagesKept).toBe(3);
  });
  it("keeps blank pages when removeBlank is false", () => {
    const r = planScanOptimize({ ...baseJob, removeBlank: false });
    expect(r.pagesRemoved).toBe(0);
    expect(r.pagesKept).toBe(5);
  });
  it("computes per-page threshold based on binarization", () => {
    const r = planScanOptimize(baseJob);
    expect(r.pages[0].threshold).toBeGreaterThan(0);
  });
  it("warns when skew exceeds max", () => {
    const r = planScanOptimize({ ...baseJob, maxDeskewDeg: 1, simulatedStats: [{ meanIntensity: 200, inkCoverage: 0.15, skewDeg: 5 }] });
    expect(r.pages[0].warnings.some((w) => w.includes("Skew"))).toBe(true);
  });
  it("computes estimated size based on compression", () => {
    const r = planScanOptimize(baseJob);
    expect(r.totalEstimatedBytes).toBeGreaterThan(0);
    const r2 = planScanOptimize({ ...baseJob, compression: "none" });
    expect(r2.totalEstimatedBytes).toBeGreaterThan(r.totalEstimatedBytes);
  });
  it("notes blank page removal", () => {
    const r = planScanOptimize(baseJob);
    expect(r.notes.some((n) => n.includes("blank page"))).toBe(true);
  });
  it("includes pdf-lib code", () => {
    const r = planScanOptimize(baseJob);
    expect(r.pdfLibCode).toContain("pdf-lib");
  });
});

describe("pdf-scan-optimizer planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const job: ScanJob = {
      totalPageCount: 3, pageRange: "1-3", binarization: "otsu", fixedThreshold: 128,
      deskew: true, maxDeskewDeg: 10, removeBlank: true, blankInkThreshold: 0.02, compression: "ccitt-g4",
    };
    expect(planBatch([job, { ...job, compression: "lzw" }]).length).toBe(2);
  });
  it("renders CSV", () => {
    const job: ScanJob = {
      totalPageCount: 1, pageRange: "1", binarization: "otsu", fixedThreshold: 128,
      deskew: true, maxDeskewDeg: 10, removeBlank: false, blankInkThreshold: 0.02, compression: "ccitt-g4",
    };
    const csv = renderBatchCsv(planBatch([job]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("pdf-scan-optimizer renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planScanOptimize({
      totalPageCount: 2, pageRange: "1-2", binarization: "otsu", fixedThreshold: 128,
      deskew: true, maxDeskewDeg: 10, removeBlank: true, blankInkThreshold: 0.02, compression: "ccitt-g4",
    }));
    expect(r).toContain("PDF Scan Optimizer Plan");
    expect(r).toContain("pdf-lib");
  });
});

describe("pdf-scan-optimizer getScanPresets", () => {
  it("returns 4 presets", () => {
    expect(getScanPresets().length).toBe(4);
  });
});

describe("pdf-scan-optimizer aggregateInkCoverage", () => {
  it("computes average ink coverage", () => {
    const r = planScanOptimize({
      totalPageCount: 3, pageRange: "1-3", binarization: "otsu", fixedThreshold: 128,
      deskew: true, maxDeskewDeg: 10, removeBlank: false, blankInkThreshold: 0.02, compression: "ccitt-g4",
      simulatedStats: [
        { meanIntensity: 200, inkCoverage: 0.1, skewDeg: 0 },
        { meanIntensity: 200, inkCoverage: 0.2, skewDeg: 0 },
        { meanIntensity: 200, inkCoverage: 0.3, skewDeg: 0 },
      ],
    });
    expect(aggregateInkCoverage(r)).toBeCloseTo(0.2, 5);
  });
});

describe("pdf-scan-optimizer computeCompressionRatio", () => {
  it("returns 1 for empty pages", () => {
    const r = planScanOptimize({ totalPageCount: 0, pageRange: "", binarization: "otsu", fixedThreshold: 128, deskew: true, maxDeskewDeg: 10, removeBlank: false, blankInkThreshold: 0.02, compression: "ccitt-g4" });
    expect(computeCompressionRatio(r)).toBe(1);
  });
  it("returns > 1 for compressed content", () => {
    const r = planScanOptimize({
      totalPageCount: 1, pageRange: "1", binarization: "otsu", fixedThreshold: 128,
      deskew: true, maxDeskewDeg: 10, removeBlank: false, blankInkThreshold: 0.02, compression: "ccitt-g4",
      simulatedStats: [{ meanIntensity: 200, inkCoverage: 0.15, skewDeg: 0 }],
    });
    expect(computeCompressionRatio(r)).toBeGreaterThan(1);
  });
});
