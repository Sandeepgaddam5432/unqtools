import { describe, it, expect } from "vitest";
import {
  parsePageRange, slotToGrid, planCombine, planBatch, renderBatchCsv, renderReport,
  getCombinePresets, computeSheetCount, layoutsEqual, getPageSizes, getModeGrid,
  type CombineJob,
} from "./logic";

describe("pdf-combine-pages parsePageRange", () => {
  it("parses ranges", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
  });
  it("returns all for empty", () => {
    expect(parsePageRange("", 3).length).toBe(3);
  });
});

describe("pdf-combine-pages slotToGrid", () => {
  it("maps slot 0 to row 0 col 0 in row-major", () => {
    expect(slotToGrid(0, "4-up", "left-to-right", "row-major")).toEqual({ row: 0, col: 0 });
  });
  it("maps slot 1 to row 0 col 1 in 4-up row-major", () => {
    expect(slotToGrid(1, "4-up", "left-to-right", "row-major")).toEqual({ row: 0, col: 1 });
  });
  it("maps slot 2 to row 1 col 0 in 4-up row-major", () => {
    expect(slotToGrid(2, "4-up", "left-to-right", "row-major")).toEqual({ row: 1, col: 0 });
  });
  it("reverses columns for right-to-left", () => {
    expect(slotToGrid(1, "4-up", "right-to-left", "row-major")).toEqual({ row: 0, col: 0 });
  });
  it("column-major mapping", () => {
    expect(slotToGrid(2, "4-up", "left-to-right", "column-major")).toEqual({ row: 0, col: 1 });
  });
});

describe("pdf-combine-pages planCombine", () => {
  const baseJob: CombineJob = {
    totalPageCount: 8, pageRange: "1-8", mode: "2-up", orientation: "portrait",
    pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
    drawBorder: false, withinSheetOrder: "row-major",
  };
  it("computes 4 sheets for 8 pages at 2-up", () => {
    const r = planCombine(baseJob);
    expect(r.outputSheetCount).toBe(4);
  });
  it("computes sub-page dimensions", () => {
    const r = planCombine(baseJob);
    expect(r.subPageWidthPt).toBeGreaterThan(0);
    expect(r.subPageHeightPt).toBeGreaterThan(0);
  });
  it("4-up mode produces 2 sheets for 8 pages", () => {
    const r = planCombine({ ...baseJob, mode: "4-up" });
    expect(r.outputSheetCount).toBe(2);
  });
  it("landscape swaps dimensions", () => {
    const r = planCombine({ ...baseJob, orientation: "landscape" });
    expect(r.outputWidthPt).toBeGreaterThan(r.outputHeightPt);
  });
  it("notes empty slots on last sheet", () => {
    const r = planCombine({ ...baseJob, totalPageCount: 7, pageRange: "1-7", mode: "4-up" });
    expect(r.notes.some((n) => n.includes("empty slot"))).toBe(true);
  });
  it("notes right-to-left layout", () => {
    const r = planCombine({ ...baseJob, pageOrder: "right-to-left" });
    expect(r.notes.some((n) => n.includes("Right-to-left"))).toBe(true);
  });
  it("warns on bad spacing", () => {
    const r = planCombine({ ...baseJob, spacingPt: -10 });
    expect(r.warnings.some((w) => w.includes("Spacing"))).toBe(true);
  });
});

describe("pdf-combine-pages planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const job: CombineJob = {
      totalPageCount: 8, pageRange: "1-8", mode: "2-up", orientation: "portrait",
      pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
      drawBorder: false, withinSheetOrder: "row-major",
    };
    expect(planBatch([job, { ...job, mode: "4-up" }]).length).toBe(2);
  });
  it("renders CSV", () => {
    const job: CombineJob = {
      totalPageCount: 8, pageRange: "1-8", mode: "2-up", orientation: "portrait",
      pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
      drawBorder: false, withinSheetOrder: "row-major",
    };
    const csv = renderBatchCsv(planBatch([job]));
    expect(csv.split("\n")[0]).toContain("job_index");
  });
});

describe("pdf-combine-pages renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planCombine({
      totalPageCount: 4, pageRange: "1-4", mode: "2-up", orientation: "portrait",
      pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
      drawBorder: false, withinSheetOrder: "row-major",
    }));
    expect(r).toContain("PDF Combine (N-up) Plan");
    expect(r).toContain("Sub-page size");
  });
});

describe("pdf-combine-pages getCombinePresets", () => {
  it("returns 4 presets", () => {
    expect(getCombinePresets().length).toBe(4);
  });
});

describe("pdf-combine-pages computeSheetCount", () => {
  it("computes 4 sheets for 8 pages at 2-up", () => {
    expect(computeSheetCount(8, "2-up")).toBe(4);
  });
  it("computes 1 sheet for 8 pages at 9-up", () => {
    expect(computeSheetCount(8, "9-up")).toBe(1);
  });
  it("rounds up", () => {
    expect(computeSheetCount(5, "4-up")).toBe(2);
  });
});

describe("pdf-combine-pages layoutsEqual", () => {
  it("returns true for identical layouts", () => {
    const job: CombineJob = {
      totalPageCount: 4, pageRange: "1-4", mode: "2-up", orientation: "portrait",
      pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
      drawBorder: false, withinSheetOrder: "row-major",
    };
    expect(layoutsEqual(planCombine(job), planCombine(job))).toBe(true);
  });
  it("returns false for different modes", () => {
    const job: CombineJob = {
      totalPageCount: 4, pageRange: "1-4", mode: "2-up", orientation: "portrait",
      pageOrder: "left-to-right", spacingPt: 18, outerMarginPt: 36, outputPageSize: "letter",
      drawBorder: false, withinSheetOrder: "row-major",
    };
    expect(layoutsEqual(planCombine(job), planCombine({ ...job, mode: "4-up" }))).toBe(false);
  });
});

describe("pdf-combine-pages getPageSizes / getModeGrid", () => {
  it("returns A4 and Letter", () => {
    const s = getPageSizes();
    expect(s.a4).toBeDefined();
    expect(s.letter).toBeDefined();
  });
  it("returns mode grids", () => {
    const g = getModeGrid();
    expect(g["2-up"].cols * g["2-up"].rows).toBe(2);
    expect(g["9-up"].cols * g["9-up"].rows).toBe(9);
  });
});
