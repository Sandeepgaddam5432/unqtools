import { describe, it, expect } from "vitest";
import {
  parsePageRange, simulateContentBox, planCrop, planBatch, renderBatchCsv, renderReport,
  getCropPresets, computeReductionPercent, detectBlankPages, type CropJob,
} from "./logic";

describe("pdf-crop-to-content parsePageRange", () => {
  it("parses ranges", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
  });
  it("returns all for empty", () => {
    expect(parsePageRange("", 3).length).toBe(3);
  });
});

describe("pdf-crop-to-content simulateContentBox", () => {
  it("returns deterministic box per page", () => {
    const a = simulateContentBox(0, 612, 792);
    const b = simulateContentBox(0, 612, 792);
    expect(a).toEqual(b);
  });
  it("content box is within page bounds", () => {
    const c = simulateContentBox(5, 612, 792);
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(612);
    expect(c.top).toBeLessThanOrEqual(792);
  });
});

describe("pdf-crop-to-content planCrop", () => {
  const baseJob: CropJob = {
    totalPageCount: 5, pageRange: "1-5", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 10,
    simulatedContentBoxes: [
      { left: 100, bottom: 100, right: 500, top: 700 },
      { left: 50, bottom: 50, right: 600, top: 750 },
      { left: 200, bottom: 200, right: 400, top: 600 },
      { left: 100, bottom: 100, right: 500, top: 700 },
      { left: 100, bottom: 100, right: 500, top: 700 },
    ],
  };
  it("crops pages with significant margins", () => {
    const r = planCrop(baseJob);
    expect(r.pagesCropped).toBeGreaterThan(0);
  });
  it("leaves full-page content unchanged (when minCrop not met)", () => {
    const r = planCrop({
      ...baseJob,
      simulatedContentBoxes: [
        { left: 0, bottom: 0, right: 612, top: 792 },
        { left: 0, bottom: 0, right: 612, top: 792 },
        { left: 0, bottom: 0, right: 612, top: 792 },
        { left: 0, bottom: 0, right: 612, top: 792 },
        { left: 0, bottom: 0, right: 612, top: 792 },
      ],
      minCropPt: 100,
    });
    expect(r.pagesCropped).toBe(0);
  });
  it("applies keep margin around content", () => {
    const r = planCrop({ ...baseJob, keepMarginPt: 20 });
    const p = r.pages[0];
    // content was left=100, keepMargin=20 → new left = 80
    expect(p.cropOffset.left).toBeCloseTo(80, 0);
  });
  it("includes pdf-lib code", () => {
    const r = planCrop(baseJob);
    expect(r.pdfLibCode).toContain("setCropBox");
  });
  it("warns on bad margin threshold", () => {
    const r = planCrop({ ...baseJob, marginThresholdPt: -1 });
    expect(r.warnings.some((w) => w.includes("Margin threshold"))).toBe(true);
  });
  it("notes when no pages cropped", () => {
    const r = planCrop({
      ...baseJob,
      simulatedContentBoxes: Array(5).fill({ left: 0, bottom: 0, right: 612, top: 792 }),
      minCropPt: 100,
    });
    expect(r.notes.some((n) => n.includes("No pages were cropped"))).toBe(true);
  });
});

describe("pdf-crop-to-content planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const job: CropJob = {
      totalPageCount: 3, pageRange: "1-3", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 10,
      simulatedContentBoxes: [
        { left: 100, bottom: 100, right: 500, top: 700 },
        { left: 50, bottom: 50, right: 600, top: 750 },
        { left: 200, bottom: 200, right: 400, top: 600 },
      ],
    };
    expect(planBatch([job, job]).length).toBe(2);
  });
  it("renders CSV", () => {
    const job: CropJob = {
      totalPageCount: 1, pageRange: "1", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 10,
      simulatedContentBoxes: [{ left: 100, bottom: 100, right: 500, top: 700 }],
    };
    const csv = renderBatchCsv(planBatch([job]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("pdf-crop-to-content renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planCrop({
      totalPageCount: 2, pageRange: "1-2", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 10,
      simulatedContentBoxes: [
        { left: 100, bottom: 100, right: 500, top: 700 },
        { left: 50, bottom: 50, right: 600, top: 750 },
      ],
    }));
    expect(r).toContain("PDF Crop to Content Plan");
    expect(r).toContain("pdf-lib");
  });
});

describe("pdf-crop-to-content getCropPresets", () => {
  it("returns 4 presets", () => {
    expect(getCropPresets().length).toBe(4);
  });
});

describe("pdf-crop-to-content computeReductionPercent", () => {
  it("returns 0 for empty pages", () => {
    const r = planCrop({ totalPageCount: 0, pageRange: "", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 10 });
    expect(computeReductionPercent(r)).toBe(0);
  });
  it("returns positive percent for cropped pages", () => {
    const r = planCrop({
      totalPageCount: 1, pageRange: "1", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 0,
      simulatedContentBoxes: [{ left: 100, bottom: 100, right: 500, top: 700 }],
    });
    expect(computeReductionPercent(r)).toBeGreaterThan(0);
  });
});

describe("pdf-crop-to-content detectBlankPages", () => {
  it("detects blank pages", () => {
    const r = planCrop({
      totalPageCount: 3, pageRange: "1-3", marginThresholdPt: 10, minCropPt: 5, keepMarginPt: 0,
      simulatedContentBoxes: [
        { left: 0, bottom: 0, right: 2, top: 2 }, // blank
        { left: 100, bottom: 100, right: 500, top: 700 }, // not blank
        { left: 0, bottom: 0, right: 0, top: 0 }, // blank
      ],
    });
    const blanks = detectBlankPages(r);
    expect(blanks.length).toBe(2);
  });
});
