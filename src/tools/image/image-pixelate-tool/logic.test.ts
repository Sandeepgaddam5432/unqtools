import { describe, it, expect } from "vitest";
import { clampBlockSize, computeBlockCount, blockBounds, averageBlock, validatePixelateOptions } from "./logic";

describe("clampBlockSize", () => {
  it("returns the size when in range", () => {
    expect(clampBlockSize(8, 100, 100)).toBe(8);
  });
  it("clamps to 1 minimum", () => {
    expect(clampBlockSize(0, 100, 100)).toBe(1);
  });
  it("clamps to image max dimension", () => {
    expect(clampBlockSize(500, 100, 100)).toBe(100);
  });
  it("floors decimals", () => {
    expect(clampBlockSize(8.7, 100, 100)).toBe(8);
  });
});

describe("computeBlockCount", () => {
  it("returns ceil(w/bs) and ceil(h/bs)", () => {
    expect(computeBlockCount(100, 100, 8)).toEqual({ cols: 13, rows: 13 });
  });
  it("handles exact division", () => {
    expect(computeBlockCount(100, 50, 10)).toEqual({ cols: 10, rows: 5 });
  });
  it("handles block size 1", () => {
    expect(computeBlockCount(10, 10, 1)).toEqual({ cols: 10, rows: 10 });
  });
});

describe("blockBounds", () => {
  it("returns full block for interior", () => {
    expect(blockBounds(0, 0, 8, 100, 100)).toEqual({ x0: 0, y0: 0, x1: 8, y1: 8 });
  });
  it("clamps at image edge", () => {
    expect(blockBounds(12, 12, 8, 100, 100)).toEqual({ x0: 96, y0: 96, x1: 100, y1: 100 });
  });
});

describe("averageBlock", () => {
  it("averages block pixels", () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,  100, 100, 100, 255,
      200, 200, 200, 255,  255, 255, 255, 255,
    ]);
    const avg = averageBlock(rgba, 2, { x0: 0, y0: 0, x1: 2, y1: 2 });
    expect(avg.r).toBe(Math.round((0 + 100 + 200 + 255) / 4));
    expect(avg.a).toBe(255);
  });
  it("returns zeros for empty block", () => {
    expect(averageBlock(new Uint8ClampedArray(0), 0, { x0: 0, y0: 0, x1: 0, y1: 0 })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
  it("handles single pixel block", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 40]);
    expect(averageBlock(rgba, 1, { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual({ r: 10, g: 20, b: 30, a: 40 });
  });
});

describe("validatePixelateOptions", () => {
  it("accepts valid block size", () => {
    expect(validatePixelateOptions({ blockSize: 8 }, 100, 100)).toEqual({ ok: true });
  });
  it("rejects block size < 1", () => {
    expect(validatePixelateOptions({ blockSize: 0 }, 100, 100)).toHaveProperty("error");
  });
  it("rejects block size larger than image", () => {
    expect(validatePixelateOptions({ blockSize: 200 }, 100, 100)).toHaveProperty("error");
  });
});
