import { describe, it, expect } from "vitest";
import {
  parsePageRange, normalizeAngle, simulateAngleDetection, planDeskew, planBatch, renderBatchCsv,
  renderReport, getDeskewPresets, rotationMatrix, rotatedBoundingBox, type DeskewJob,
} from "./logic";

describe("pdf-deskew-tool parsePageRange", () => {
  it("parses simple ranges and singles", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
  });
  it("returns all pages for empty", () => {
    expect(parsePageRange("", 3).length).toBe(3);
  });
  it("clamps to total", () => {
    expect(parsePageRange("1-100", 3)).toEqual([0, 1, 2]);
  });
});

describe("pdf-deskew-tool normalizeAngle", () => {
  it("keeps angle in [-45, 45]", () => {
    expect(normalizeAngle(10)).toBe(10);
    expect(normalizeAngle(-10)).toBe(-10);
  });
  it("normalises 100 to 10", () => {
    expect(normalizeAngle(100)).toBe(10);
  });
  it("normalises 350 to -10", () => {
    expect(normalizeAngle(350)).toBe(-10);
  });
  it("normalises 80 to -10 (90 - 80)", () => {
    expect(normalizeAngle(80)).toBe(-10);
  });
});

describe("pdf-deskew-tool simulateAngleDetection", () => {
  it("returns deterministic values for same seed", () => {
    const a = simulateAngleDetection(1);
    const b = simulateAngleDetection(1);
    expect(a.angle).toBe(b.angle);
    expect(a.confidence).toBe(b.confidence);
  });
  it("angle is in [-10, 10]", () => {
    for (let i = 1; i <= 10; i++) {
      const a = simulateAngleDetection(i);
      expect(a.angle).toBeGreaterThanOrEqual(-10);
      expect(a.angle).toBeLessThanOrEqual(10);
    }
  });
  it("confidence is in [0.5, 1.0]", () => {
    for (let i = 1; i <= 10; i++) {
      const c = simulateAngleDetection(i).confidence;
      expect(c).toBeGreaterThanOrEqual(0.5);
      expect(c).toBeLessThanOrEqual(1.0);
    }
  });
});

describe("pdf-deskew-tool planDeskew", () => {
  const baseJob: DeskewJob = {
    totalPageCount: 5, pageRange: "1-5", mode: "auto", manualAngleDeg: 0,
    maxAutoAngleDeg: 15, confidenceThreshold: 0.7,
    detectedAngles: [2, -3, 5, 0, 8], detectedConfidences: [0.95, 0.95, 0.95, 0.95, 0.95],
  };
  it("straightens all pages in auto mode", () => {
    const r = planDeskew(baseJob);
    expect(r.pagesStraightened).toBe(5);
    expect(r.pagesSkipped).toBe(0);
  });
  it("applies counter-rotation (negative of detected)", () => {
    const r = planDeskew(baseJob);
    expect(r.pages[0].appliedAngle).toBeCloseTo(-2, 2);
  });
  it("skips pages with low confidence", () => {
    const r = planDeskew({ ...baseJob, detectedConfidences: [0.5, 0.5, 0.5, 0.5, 0.5] });
    expect(r.pagesStraightened).toBe(0);
  });
  it("skips pages with angle above max", () => {
    const r = planDeskew({ ...baseJob, detectedAngles: [2, 20, 5, 0, 8], maxAutoAngleDeg: 10 });
    expect(r.pages[1].appliedAngle).toBe(0);
  });
  it("manual mode applies manualAngleDeg to all pages", () => {
    const r = planDeskew({ ...baseJob, mode: "manual", manualAngleDeg: 3 });
    r.pages.forEach((p) => expect(p.appliedAngle).toBe(-3));
  });
  it("auto-with-manual-fallback uses manual when auto rejected", () => {
    const r = planDeskew({ ...baseJob, mode: "auto-with-manual-fallback", manualAngleDeg: 2, detectedConfidences: [0.5, 0.5, 0.5, 0.5, 0.5] });
    r.pages.forEach((p) => expect(p.appliedAngle).toBe(-2));
  });
  it("includes pdf-lib code", () => {
    const r = planDeskew(baseJob);
    expect(r.pdfLibCode).toContain("setRotation");
  });
  it("warns on bad inputs", () => {
    const r = planDeskew({ ...baseJob, totalPageCount: 0 });
    expect(r.warnings.some((w) => w.includes("Total page count"))).toBe(true);
  });
});

describe("pdf-deskew-tool planBatch / renderBatchCsv", () => {
  it("plans multiple jobs", () => {
    const job: DeskewJob = {
      totalPageCount: 5, pageRange: "1-5", mode: "auto", manualAngleDeg: 0,
      maxAutoAngleDeg: 15, confidenceThreshold: 0.7,
      detectedAngles: [2, 2, 2, 2, 2], detectedConfidences: [0.95, 0.95, 0.95, 0.95, 0.95],
    };
    expect(planBatch([job, job]).length).toBe(2);
  });
  it("renders CSV", () => {
    const job: DeskewJob = {
      totalPageCount: 5, pageRange: "1-5", mode: "auto", manualAngleDeg: 0,
      maxAutoAngleDeg: 15, confidenceThreshold: 0.7,
      detectedAngles: [2, 2, 2, 2, 2], detectedConfidences: [0.95, 0.95, 0.95, 0.95, 0.95],
    };
    const csv = renderBatchCsv(planBatch([job]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("pdf-deskew-tool renderReport", () => {
  it("renders report with pdf-lib code", () => {
    const r = renderReport(planDeskew({
      totalPageCount: 3, pageRange: "1-3", mode: "auto", manualAngleDeg: 0,
      maxAutoAngleDeg: 15, confidenceThreshold: 0.7,
      detectedAngles: [2, -1, 0], detectedConfidences: [0.95, 0.95, 0.95],
    }));
    expect(r).toContain("PDF Deskew Plan");
    expect(r).toContain("pdf-lib");
  });
});

describe("pdf-deskew-tool getDeskewPresets", () => {
  it("returns 4 presets", () => {
    expect(getDeskewPresets().length).toBe(4);
  });
});

describe("pdf-deskew-tool rotationMatrix", () => {
  it("returns cos=1, sin=0 for 0 degrees", () => {
    const m = rotationMatrix(0);
    expect(m.cos).toBeCloseTo(1, 5);
    expect(m.sin).toBeCloseTo(0, 5);
  });
  it("returns cos=0, sin=1 for 90 degrees", () => {
    const m = rotationMatrix(90);
    expect(m.cos).toBeCloseTo(0, 5);
    expect(m.sin).toBeCloseTo(1, 5);
  });
});

describe("pdf-deskew-tool rotatedBoundingBox", () => {
  it("returns same dimensions for 0 degrees", () => {
    const bb = rotatedBoundingBox(100, 200, 0);
    expect(bb.width).toBeCloseTo(100, 2);
    expect(bb.height).toBeCloseTo(200, 2);
  });
  it("swaps width and height for 90 degrees", () => {
    const bb = rotatedBoundingBox(100, 200, 90);
    expect(bb.width).toBeCloseTo(200, 2);
    expect(bb.height).toBeCloseTo(100, 2);
  });
});
