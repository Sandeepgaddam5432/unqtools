import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, aspectToRatio, fitContain, fitCover, computeLayout, autoLayout,
  emptyCellCount, validateImages, estimatePngBytes, formatBytes, summarizeLayout,
  toCssGrid,
} from "./logic";

const sample = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `img-${i}`, width: 400, height: 300, name: `img-${i}.jpg`, bytes: 50000,
}));

describe("aspectToRatio", () => {
  it("returns null for free", () => {
    expect(aspectToRatio("free")).toBeNull();
  });
  it("returns 1:1", () => {
    expect(aspectToRatio("1:1")).toEqual({ w: 1, h: 1 });
  });
  it("returns 16:9", () => {
    expect(aspectToRatio("16:9")).toEqual({ w: 16, h: 9 });
  });
});

describe("fitContain", () => {
  it("fits landscape into portrait box", () => {
    const r = fitContain(800, 400, 100, 200);
    expect(r.w).toBe(100);
    expect(r.h).toBe(50);
  });
  it("fits portrait into landscape box", () => {
    const r = fitContain(400, 800, 200, 100);
    expect(r.w).toBe(50);
    expect(r.h).toBe(100);
  });
  it("returns box for zero source", () => {
    const r = fitContain(0, 0, 100, 100);
    expect(r).toEqual({ w: 100, h: 100 });
  });
});

describe("fitCover", () => {
  it("covers and crops", () => {
    const r = fitCover(400, 200, 100, 100);
    expect(r.w).toBe(100);
    expect(r.h).toBe(100);
    expect(r.srcW).toBeLessThan(400);
  });
});

describe("computeLayout", () => {
  it("produces cells equal to min(total, images)", () => {
    const layout = computeLayout(sample(5), { ...DEFAULT_PARAMS, rows: 2, cols: 3 });
    expect(layout.cells.length).toBe(5);
  });
  it("computes canvas dimensions", () => {
    const layout = computeLayout(sample(9), DEFAULT_PARAMS);
    expect(layout.canvasWidth).toBeGreaterThan(0);
    expect(layout.canvasHeight).toBeGreaterThan(0);
  });
  it("cells span all rows and cols", () => {
    const layout = computeLayout(sample(9), { ...DEFAULT_PARAMS, rows: 3, cols: 3 });
    expect(layout.cells.length).toBe(9);
  });
  it("respects spacing", () => {
    const layout1 = computeLayout(sample(4), { ...DEFAULT_PARAMS, spacing: 4, rows: 2, cols: 2 });
    const layout2 = computeLayout(sample(4), { ...DEFAULT_PARAMS, spacing: 16, rows: 2, cols: 2 });
    expect(layout2.canvasWidth).toBeGreaterThan(layout1.canvasWidth);
  });
});

describe("autoLayout", () => {
  it("single image → 1×1", () => {
    expect(autoLayout(1)).toEqual({ rows: 1, cols: 1 });
  });
  it("9 images → 3×3 for 1:1 target", () => {
    expect(autoLayout(9, "1:1")).toEqual({ rows: 3, cols: 3 });
  });
  it("4 images → 2×2", () => {
    expect(autoLayout(4, "1:1")).toEqual({ rows: 2, cols: 2 });
  });
  it("zero → 0×0", () => {
    expect(autoLayout(0)).toEqual({ rows: 0, cols: 0 });
  });
});

describe("emptyCellCount", () => {
  it("computes empties", () => {
    expect(emptyCellCount(sample(7), { ...DEFAULT_PARAMS, rows: 3, cols: 3 })).toBe(2);
  });
  it("zero when full", () => {
    expect(emptyCellCount(sample(9), { ...DEFAULT_PARAMS, rows: 3, cols: 3 })).toBe(0);
  });
});

describe("validateImages", () => {
  it("accepts valid images", () => {
    expect(validateImages(sample(3)).ok).toBe(true);
  });
  it("rejects empty list", () => {
    expect(validateImages([]).ok).toBe(false);
  });
  it("rejects bad dimensions", () => {
    expect(validateImages([{ id: "x", width: 0, height: 0, name: "x.jpg", bytes: 0 }]).ok).toBe(false);
  });
});

describe("estimatePngBytes & formatBytes", () => {
  it("scales with dimensions", () => {
    expect(estimatePngBytes(512, 512)).toBeGreaterThan(estimatePngBytes(64, 64));
  });
  it("formats", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("summarizeLayout", () => {
  it("contains grid info", () => {
    const layout = computeLayout(sample(9), DEFAULT_PARAMS);
    const s = summarizeLayout(layout, sample(9));
    expect(s).toContain("3×3");
    expect(s).toContain("Canvas:");
  });
});

describe("toCssGrid", () => {
  it("generates CSS template", () => {
    const layout = computeLayout(sample(4), { ...DEFAULT_PARAMS, rows: 2, cols: 2 });
    const css = toCssGrid(layout);
    expect(css).toContain("repeat(2, 1fr)");
  });
});
